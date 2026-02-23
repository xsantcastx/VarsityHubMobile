import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { verifyAppleToken } from '../lib/appleAuth.js';
import { debugLog } from '../lib/debugLog.js';
import { getAppBaseUrl } from '../lib/env.js';
import {
    isSendGridConfigured,
    sendCoachOnboardingEmail,
    sendFanWelcomeEmail,
    sendLoginFromNewDeviceEmail,
    sendPasswordChangedEmail,
    sendPasswordResetEmail,
    sendUserConfirmationEmail,
    sendVerificationEmail
} from '../lib/email.js';
import { signJwt, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { isEmailAdmin } from '../middleware/requireAdmin.js';

export const authRouter = Router();

const isTestEnv = process.env.NODE_ENV === 'test';

// Rate limiting for sensitive auth endpoints (skipped when NODE_ENV=test for integration tests)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `${req.ip}-${email}`;
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many password reset attempts. Please try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  keyGenerator: (req) => req.body?.email || req.ip,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
});

// Rate limiting for OAuth endpoints (Google, Apple)
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
});

// simple in-memory rate limiting for verification send: 1/30s, 5/hour per user
const verifyRate: Map<string, { last: number; count: number; hourStart: number }> = new Map();
// Brute force protection for code entry: track failed attempts
const verifyAttempts: Map<string, { count: number; lockedUntil: number | null }> = new Map();
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const GOOGLE_ALLOWED_AUDIENCES = (process.env.GOOGLE_ALLOWED_AUDIENCES || process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_AUDIENCE || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().optional(),
  // Rookie is a coach plan, not a role
  role: z.enum(['fan', 'coach']).optional(),
});

authRouter.post('/register', registrationLimiter, async (req, res) => {
  const start = Date.now();
  debugLog('[register] Incoming request');
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, password, display_name, role } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  
  // Prevent duplicate accounts - check if email already exists
  // Users can create multiple accounts with different emails, but not duplicate the same email
  debugLog('[register] Checking for existing user');
  let exists;
  try {
    exists = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  } catch (e) {
    console.error('[register] prisma findUnique error:', e);
    return res.status(500).json({ error: 'Database unavailable' });
  }
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const password_hash = await bcrypt.hash(password, 10);
  // Use cryptographically secure random for verification codes
  const code = String(crypto.randomInt(100000, 1000000));
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const userRole = role || 'fan';
  
  // Set admin flag for the main admin account
  const adminEmails = (process.env.ADMIN_EMAILS || 'emilmancero@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(sanitizedEmail);
  const initialPreferences = { 
    role: userRole, 
    onboarding_completed: false,
    ...(isAdmin && { is_admin: true })
  };
  
  debugLog('[register] Creating user record');
  let user;
  try {
    user = await prisma.user.create({ 
    data: { 
      email: sanitizedEmail, 
      password_hash, 
      display_name, 
      email_verified: false, 
      email_verification_code: code, 
      email_verification_expires: exp,
      preferences: initialPreferences
    } 
  });
  } catch (e) {
    console.error('[register] prisma create error:', e);
    return res.status(500).json({ error: 'Failed to create user' });
  }
  const access_token = signJwt({ id: user.id, is_admin: isAdmin });
  const refresh_token = signRefreshToken(user.id);
  try { 
    debugLog('[email] Sending verification email to:', email);
    const emailSend = sendVerificationEmail(email, code, display_name || sanitizedEmail.split('@')[0]);
    const EMAIL_TIMEOUT_MS = 5000;
    const timed = await Promise.race([
      emailSend,
      new Promise((resolve) => setTimeout(resolve, EMAIL_TIMEOUT_MS, 'timeout'))
    ]);
    if (timed === 'timeout') {
      console.warn('[email] sendVerificationEmail timed out; continuing');
    } else if (timed === false) {
      console.warn('[email] Verification email skipped (SendGrid not configured)');
    } else {
      debugLog('[email] Verification email sent successfully');
    }
  } catch (e) { 
    console.error('[email] Email send failed:', e);
    req.log?.warn?.({ err: e }, 'Email send failed; returning code in dev'); 
  }
  
  // Send user confirmation email
  try {
    await sendUserConfirmationEmail({
      to: email,
      userName: display_name || sanitizedEmail.split('@')[0],
      confirmationLink: `${getAppBaseUrl()}/onboarding`,
      expiresIn: '30 days',
    }).catch((err: Error) => {
      console.error('[email] User confirmation email failed:', err);
    });
  } catch (e) {
    console.error('[email] User confirmation email error:', e);
  }
  const sendGridReady = isSendGridConfigured();
  const shouldReturnDevCode = process.env.NODE_ENV !== 'production' || !sendGridReady;
  const payload: any = { access_token, refresh_token, user: { ...sanitizeUser(user), is_admin: isAdmin } };
  if (shouldReturnDevCode) {
    payload.dev_verification_code = code;
    if (!sendGridReady) {
      payload.email_hint = 'SendGrid not configured—code returned directly.';
    }
  }
  debugLog('[register] Completed in', Date.now() - start, 'ms');
  return res.status(201).json(payload);
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  
  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.permanent_ban) return res.status(403).json({ error: 'Account banned' });
  if (user.suspension_until && new Date(user.suspension_until) > new Date()) {
    return res.status(403).json({ error: 'Account suspended', until: user.suspension_until });
  }
  if (user.banned) return res.status(403).json({ error: 'Account banned' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  
  // NEW DEVICE DETECTION: Check User-Agent and IP for suspicious login
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                    (req.headers['x-real-ip'] as string) || 
                    req.socket.remoteAddress || 
                    'unknown';
  
  // Use SHA-256 for device fingerprinting (non-cryptographic identity)
  const deviceFingerprint = crypto.createHash('sha256')
    .update(`${userAgent}|${ipAddress}`)
    .digest('hex');
  
  const lastLogins = ((user as any)?.preferences?.last_logins || []) as Array<{
    fingerprint: string;
    timestamp: string;
    ip: string;
    userAgent: string;
  }>;
  
  const isKnownDevice = lastLogins.some(login => login.fingerprint === deviceFingerprint);
  
  if (!isKnownDevice && user.email) {
    // New device detected - send alert email
    const loginDate = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short'
    });
    
    // Extract device info from user agent
    const deviceInfo = userAgent.includes('Mobile') ? 'Mobile Device' : 
                      userAgent.includes('Tablet') ? 'Tablet' : 
                      'Desktop Computer';
    const browserInfo = userAgent.includes('Chrome') ? 'Chrome' :
                       userAgent.includes('Safari') ? 'Safari' :
                       userAgent.includes('Firefox') ? 'Firefox' :
                       'Unknown Browser';
    
    await sendLoginFromNewDeviceEmail({
      to: user.email,
      userName: user.display_name || user.email.split('@')[0],
      deviceType: `${deviceInfo} - ${browserInfo}`,
      deviceLocation: ipAddress !== 'unknown' ? ipAddress : 'Unknown location',
      loginDate: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Chicago',
      }),
      loginTime: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
      }),
      ipAddress: ipAddress !== 'unknown' ? ipAddress : 'Unknown',
      secureAccountLink: `${getAppBaseUrl()}/settings/security`,
      changePasswordLink: `${getAppBaseUrl()}/settings/password`,
      contactSupportLink: `${getAppBaseUrl()}/support`,
    }).catch((err: Error) => {
      console.error('[auth] Failed to send new device login email:', err);
    });
  }
  
  // Update last logins history (keep last 5 devices)
  const updatedLogins = [
    { fingerprint: deviceFingerprint, timestamp: new Date().toISOString(), ip: ipAddress, userAgent },
    ...lastLogins.filter(l => l.fingerprint !== deviceFingerprint).slice(0, 4)
  ];
  
  // ADMIN BYPASS: Admin accounts skip onboarding
  const isAdmin = isEmailAdmin(sanitizedEmail);
  
  // Only update onboarding_completed if user is new or missing the flag
  const currentPrefs = (user as any)?.preferences || {};
  const needsPreferenceUpdate = currentPrefs.onboarding_completed === undefined || 
                                currentPrefs.onboarding_completed === null ||
                                JSON.stringify(currentPrefs.last_logins || []) !== JSON.stringify(updatedLogins);
  
  let updatedUser = user;
  if (needsPreferenceUpdate) {
    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: mergePreferences(currentPrefs, { 
          onboarding_completed: true,
          last_logins: updatedLogins 
        }),
      },
    });
    Object.assign(user, updatedUser);
  }
  
  const access_token = signJwt({ id: user.id, is_admin: isAdmin });
  const refresh_token = signRefreshToken(user.id);
  const sanitized = sanitizeUser(user);
  
  // Admin users never need onboarding; everyone else checks onboarding_completed
  const needsOnboarding = isAdmin ? false : (sanitized?.preferences?.onboarding_completed === false);
  
  const body: any = { access_token, refresh_token, user: { ...sanitized, is_admin: isAdmin }, needs_onboarding: needsOnboarding };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
});

const refreshSchema = z.object({ refresh_token: z.string().min(10) });

authRouter.post('/refresh', oauthLimiter, async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const payload = verifyRefreshToken(parsed.data.refresh_token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired refresh token' });
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.permanent_ban || user.banned) return res.status(403).json({ error: 'Account banned' });
  const isAdmin = isEmailAdmin(user.email);
  const access_token = signJwt({ id: user.id, is_admin: isAdmin });
  const refresh_token = signRefreshToken(user.id);
  return res.json({ access_token, refresh_token });
});

const googleAuthSchema = z.object({
  id_token: z.string().min(10),
});

authRouter.post('/google', oauthLimiter, async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { id_token } = parsed.data;

  try {
    const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
    if (!googleResponse.ok) {
      const detail = await googleResponse.text().catch(() => '');
      req.log?.warn?.({ detail }, '[auth/google] tokeninfo rejected credential');
      return res.status(401).json({ error: 'Google authentication failed' });
    }

    const payload = await googleResponse.json() as any;
    const googleId = typeof payload?.sub === 'string' ? payload.sub : null;
    const audience = typeof payload?.aud === 'string' ? payload.aud : null;
    const email = typeof payload?.email === 'string' ? String(payload.email).toLowerCase() : null;
    const emailVerified = payload?.email_verified === 'true' || payload?.email_verified === true;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Invalid Google credential' });
    }

    if (!emailVerified) {
      return res.status(400).json({ error: 'Google account email is not verified' });
    }

    if (GOOGLE_ALLOWED_AUDIENCES.length && (!audience || !GOOGLE_ALLOWED_AUDIENCES.includes(audience))) {
      req.log?.warn?.({ audience }, '[auth/google] audience mismatch');
      return res.status(400).json({ error: 'Google credential not issued for this application' });
    }

    const isAdmin = isEmailAdmin(email);

    const displayNameSource = typeof payload?.name === 'string' && payload.name.trim().length
      ? payload.name.trim()
      : email.split('@')[0];
    const avatarUrl = typeof payload?.picture === 'string' ? payload.picture : null;

    let user = await prisma.user.findUnique({ where: { google_id: googleId } });
    let created = false;

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        const currentPrefs = (existingByEmail as any)?.preferences || {};
        const prefPatch: Record<string, unknown> = {};
        if (typeof currentPrefs.role !== 'string') prefPatch.role = 'fan';
        // Only set onboarding_completed if user is missing the flag
        if (currentPrefs.onboarding_completed === undefined || currentPrefs.onboarding_completed === null) {
          prefPatch.onboarding_completed = true;
        }
        const updates: any = {
          google_id: googleId,
          email_verified: true,
          email_verification_code: null,
          email_verification_expires: null,
        };
        if (avatarUrl && !existingByEmail.avatar_url) updates.avatar_url = avatarUrl;
        if (displayNameSource && !existingByEmail.display_name) updates.display_name = displayNameSource;
        if (Object.keys(prefPatch).length) {
          updates.preferences = mergePreferences(currentPrefs, prefPatch);
        }
        user = await prisma.user.update({ where: { id: existingByEmail.id }, data: updates });
      } else {
        const randomSecret = crypto.randomBytes(32).toString('hex');
        const password_hash = await bcrypt.hash(randomSecret, 10);
        user = await prisma.user.create({
          data: {
            email,
            password_hash,
            google_id: googleId,
            display_name: displayNameSource,
            avatar_url: avatarUrl,
            email_verified: true,
            preferences: { role: 'fan', onboarding_completed: false },
          },
        });
        created = true;
      }
    } else if (!user.email_verified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email_verified: true,
          email_verification_code: null,
          email_verification_expires: null,
        },
      });
    }

    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id, is_admin: isAdmin });
    const refresh_token = signRefreshToken(sanitized.id);
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    return res.json({
      access_token,
      refresh_token,
      user: { ...sanitized, is_admin: isAdmin },
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err) {
    console.error('[auth/google] unexpected error', err);
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

const appleAuthSchema = z.object({
  identity_token: z.string().min(1),
});

authRouter.post('/apple', oauthLimiter, async (req, res) => {
  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { identity_token } = parsed.data;
  const looksLikeJwt = identity_token.split('.').length === 3;
  // Allow simulator/dev fallback tokens that are plain strings (Expo/Simulator mocks)
  const isDevelopmentToken = identity_token.startsWith('sim-') || !looksLikeJwt;

  try {
    let appleId: string;
    let email: string | null = null;
    
    if (isDevelopmentToken) {
      // Extract and sanitize the simulator/dev user ID (covers plain fallback strings)
      const rawId = identity_token.replace(/^sim-/, '') || 'sim-user';
      appleId = rawId.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
      email = `${appleId}@privaterelay.appleid.com`;
    } else {
      const decoded = await verifyAppleToken(identity_token);
      if (!decoded) {
        req.log?.warn?.({ reason: 'apple_token_invalid' }, '[auth/apple] token verification failed');
        return res.status(400).json({ error: 'Invalid Apple credential' });
      }
      appleId = decoded.sub;
      email = decoded.email ?? null;
    }

    if (!appleId) {
      return res.status(400).json({ error: 'Invalid Apple credential' });
    }

    // Look up user by Apple ID
    let user = await prisma.user.findUnique({ where: { apple_id: appleId } });
    let created = false;

    if (!user) {
      // Check if user exists by email (if provided)
      let existingByEmail = null;
      if (email) {
        existingByEmail = await prisma.user.findUnique({ where: { email } });
      }

      if (existingByEmail) {
        // Link Apple ID to existing account
        const currentPrefs = (existingByEmail as any)?.preferences || {};
        const prefPatch: Record<string, unknown> = {};
        if (typeof currentPrefs.role !== 'string') prefPatch.role = 'fan';
        // Only set onboarding_completed if user is missing the flag
        if (currentPrefs.onboarding_completed === undefined || currentPrefs.onboarding_completed === null) {
          prefPatch.onboarding_completed = true;
        }
        
        const updates: any = {
          apple_id: appleId,
          email_verified: true,
          email_verification_code: null,
          email_verification_expires: null,
        };
        
        if (Object.keys(prefPatch).length) {
          updates.preferences = mergePreferences(currentPrefs, prefPatch);
        }
        
        user = await prisma.user.update({ where: { id: existingByEmail.id }, data: updates });
      } else {
        // Create new user
        const randomSecret = crypto.randomBytes(32).toString('hex');
        const password_hash = await bcrypt.hash(randomSecret, 10);
        const userEmail = email || `apple_${appleId.substring(0, 16)}@appleid.local`;
        
        user = await prisma.user.create({
          data: {
            email: userEmail,
            password_hash,
            apple_id: appleId,
            display_name: 'Apple User',
            email_verified: true,
            preferences: { role: 'fan', onboarding_completed: false },
          },
        });
        created = true;
      }
    }

    const isAdmin = isEmailAdmin(user?.email);
    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id, is_admin: isAdmin });
    const refresh_token = signRefreshToken(sanitized.id);
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    return res.json({
      access_token,
      refresh_token,
      user: { ...sanitized, is_admin: isAdmin },
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err) {
    console.error('[auth/apple] unexpected error', err);
    return res.status(500).json({ error: 'Failed to authenticate with Apple' });
  }
});

const passwordResetRequestSchema = z.object({ email: z.string().email() });

authRouter.post('/password/forgot', passwordResetLimiter, async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const email = parsed.data.email.trim();
  debugLog('[password-reset] Looking for user:', email);
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  const payload: any = { ok: true };
  if (!user) {
    debugLog('[password-reset] No user found for:', email);
    return res.json(payload);
  }
  debugLog('[password-reset] User found:', user.id, user.email);

  // Use cryptographically secure random for reset codes
  const code = String(crypto.randomInt(100000, 1000000));
  // Align with template: token expires in 1 hour
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_reset_code: code,
      password_reset_expires: expires,
    },
  });

  try {
    debugLog('[email] Sending password reset email to:', user.email);
    // Normalize base URL and enforce /reset/<token> path
    const base = getAppBaseUrl();
    const resetLink = `${base}/reset/${encodeURIComponent(code)}`;
    const sent = await sendPasswordResetEmail(
      user.email,
      code,
      user.display_name || user.email.split('@')[0],
      resetLink,
      '1 hour'
    );
    if (!sent) {
      console.warn('[email] Password reset email skipped (SendGrid not configured)');
    } else {
      debugLog('[email] Password reset email sent successfully');
    }
  } catch (e) {
    console.error('[email] Password reset email failed:', e);
    req.log?.warn?.({ err: e }, 'Password reset email failed');
  }

  if (process.env.NODE_ENV !== 'production') payload.dev_reset_code = code;
  return res.json(payload);
});

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
  // Requirement: at least 5 characters, no other constraints
  password: z.string().min(5),
});

authRouter.post('/password/reset', passwordResetLimiter, async (req, res) => {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, code, password } = parsed.data;
  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });
  if (!user || !user.password_reset_code || !user.password_reset_expires) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (new Date() > user.password_reset_expires) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (String(code).trim() !== String(user.password_reset_code)) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      password_reset_code: null,
      password_reset_expires: null,
    },
  });

  // Send password changed security alert
  try {
    await sendPasswordChangedEmail(
      user.email,
      user.display_name || user.email.split('@')[0],
      new Date().toLocaleString('en-US', { 
        dateStyle: 'long', 
        timeStyle: 'short', 
        timeZone: 'America/Chicago' 
      })
    );
  } catch (err) {
    console.warn('[security-email] Failed to send password change alert (settings):', (err as any)?.message || err);
  }

  return res.json({ ok: true });
});

// Authenticated password change via Settings page
const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(5),
});

authRouter.post('/password/change', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { current_password, new_password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.password_hash) return res.status(400).json({ error: 'Invalid account state' });

  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const password_hash = await bcrypt.hash(new_password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password_hash } });

  // Send password changed security alert
  try {
    await sendPasswordChangedEmail(
      user.email,
      user.display_name || user.email.split('@')[0],
      new Date().toLocaleString('en-US', { 
        dateStyle: 'long', 
        timeStyle: 'short', 
        timeZone: 'America/Chicago' 
      })
    );
  } catch (err) {
    console.warn('[security-email] Failed to send password change alert (settings):', (err as any)?.message || err);
  }

  return res.json({ ok: true });
});

authRouter.get('/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  const is_admin = isEmailAdmin(user.email);
  
  // IMPORTANT: Admin accounts bypass onboarding requirement
  // They always have onboarding_completed = true regardless of actual preference
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
    is_parent: false,
    zip_code: null,
  };

  const mergedPrefs = mergePreferences(defaults, (user as any).preferences || {});

  if (is_admin) {
    mergedPrefs.onboarding_completed = true;
  } else if (typeof mergedPrefs.onboarding_completed === 'undefined') {
    mergedPrefs.onboarding_completed = false;
  }

  const prefs = mergedPrefs;
  const { password_hash, ...rest } = user as any;
  return res.json({ ...rest, preferences: prefs, is_admin });
});

const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  preferences: z.any().optional(),
});

// Normalize username: replace spaces with underscores, lowercase
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '_');
}

authRouter.put('/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const data = parsed.data as any;
  let patch: any = { ...data };
  // Normalize username if provided
  if (data.display_name) {
    patch.display_name = normalizeUsername(data.display_name);
  }
  if (data.username) {
    patch.username = normalizeUsername(data.username);
  }
  if (data.preferences) {
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    const currentPrefs = (current?.preferences && typeof current.preferences === 'object') ? (current.preferences as any) : {};
    const onboardingCompleted = currentPrefs.onboarding_completed === true;
    
    // Block role changes after onboarding complete
    if (onboardingCompleted && 'role' in data.preferences && data.preferences.role !== currentPrefs.role) {
      return res.status(403).json({ error: 'Role changes are not allowed after onboarding is complete.' });
    }
    
    const mergedPrefs = mergePreferences(currentPrefs, data.preferences);
    patch.preferences = mergedPrefs;
  }
  const { preferences, ...rest } = patch;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { ...rest, ...(preferences ? { preferences } : {}) } });
  return res.json(sanitizeUser(user));
});

// PATCH /me (alias) to support partial updates including preferences
authRouter.patch('/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const data = parsed.data as any;
  let patch: any = { ...data };
  // Normalize username if provided
  if (data.display_name) {
    patch.display_name = normalizeUsername(data.display_name);
  }
  if (data.username) {
    patch.username = normalizeUsername(data.username);
  }
  if (data.preferences) {
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    const currentPrefs = (current?.preferences && typeof current.preferences === 'object') ? (current.preferences as any) : {};
    const onboardingCompleted = currentPrefs.onboarding_completed === true;
    
    // Block role changes after onboarding complete
    if (onboardingCompleted && 'role' in data.preferences && data.preferences.role !== currentPrefs.role) {
      return res.status(403).json({ error: 'Role changes are not allowed after onboarding is complete.' });
    }
    
    // If role is being changed, perform cascade cleanup (for defensive programming)
    if ('role' in data.preferences && data.preferences.role && data.preferences.role !== currentPrefs.role) {
      const oldRole = currentPrefs.role || 'fan';
      const newRole = data.preferences.role;
      await cleanupRoleDowngrade(req.user.id, oldRole, newRole);
    }
    
    const mergedPrefs = mergePreferences(currentPrefs, data.preferences);
    patch.preferences = mergedPrefs;
  }
  const { preferences, ...rest } = patch;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { ...rest, ...(preferences ? { preferences } : {}) } });
  return res.json(sanitizeUser(user));
});

// Utility to deep-merge preferences, preserving nested notification keys
function mergePreferences(base: any, incoming: any) {
  const out = { ...(base || {}), ...(incoming || {}) };
  if (base?.notifications || incoming?.notifications) {
    out.notifications = { ...(base?.notifications || {}), ...(incoming?.notifications || {}) };
  }
  return out;
}

// Helper to cascade cleanup when role is downgraded (e.g., coach → fan)
// This ensures user loses all organization/team leadership when role changes
async function cleanupRoleDowngrade(userId: string, oldRole: string, newRole: string): Promise<void> {
  // Only handle coach → fan transitions
  if (oldRole !== 'coach' || newRole !== 'fan') {
    return;
  }

  try {
    // Remove user from all organization memberships when role downgraded
    // This prevents orphaned organization ownership
    const orgMemberships = await prisma.organizationMembership.findMany({
      where: { user_id: userId }
    });

    for (const membership of orgMemberships) {
      // Archive the membership instead of deleting for audit trail
      await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: {
          status: 'removed',
          removal_reason: 'User role downgraded from coach to fan',
          removal_date: new Date()
        }
      });
    }

    // Remove user from all team memberships when role downgraded
    const teamMemberships = await prisma.teamMembership.findMany({
      where: { user_id: userId }
    });

    for (const membership of teamMemberships) {
      // Archive the membership instead of deleting for audit trail
      await prisma.teamMembership.update({
        where: { id: membership.id },
        data: {
          status: 'archived',
          removal_reason: 'User role downgraded from coach to fan',
          removal_date: new Date()
        }
      });
    }

    console.info(`[Role Downgrade] User ${userId} downgraded from coach to fan. Cleaned up org and team memberships.`);
  } catch (error) {
    console.error(`[Role Downgrade] Error cleaning up memberships for user ${userId}:`, error);
    // Don't throw - log but continue with the role change
    // This prevents role downgrade from failing due to cleanup issues
  }
}

// Partial update for user preferences
authRouter.patch('/me/preferences', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const schema = z.object({
    notifications: z.object({
      game_event_reminders: z.boolean().optional(),
      team_updates: z.boolean().optional(),
      comments_upvotes: z.boolean().optional(),
    }).partial().optional(),
    is_parent: z.boolean().optional(),
    zip_code: z.string().min(2).max(20).optional().nullable(),
    onboarding_completed: z.boolean().optional(),
    
    // New onboarding fields
    role: z.enum(['fan', 'coach']).optional(),
    plan: z.enum(['rookie', 'veteran', 'legend']).optional(),
    affiliation: z.enum(['school', 'independent', 'none', 'university', 'high_school', 'club', 'youth', 'professional']).optional(),
    dob: z.string().optional(),
    sports_interests: z.array(z.string()).optional(),
    personalization_goals: z.array(z.string()).optional(),
    primary_intents: z.array(z.string()).optional(),
    season_start: z.string().optional(),
    season_end: z.string().optional(),
    location_enabled: z.boolean().optional(),
    notifications_enabled: z.boolean().optional(),
    messaging_policy_accepted: z.boolean().optional(),
    
    // Athlete-specific fields
    position: z.string().optional(),
    jersey_number: z.union([z.string(), z.number()]).optional(),
    grade_level: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior']).optional(),
    graduation_year: z.number().int().min(2020).max(2040).optional(),
    accolades: z.array(z.string()).optional(),
    primary_team_id: z.string().optional(),
    primary_sport: z.string().optional(),
  }).partial();
  
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const incoming = parsed.data as any;
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const currentPrefs =
    current?.preferences && typeof current.preferences === 'object'
      ? (current.preferences as Record<string, any>)
      : {};
  const onboardingCompleted = currentPrefs.onboarding_completed === true;

  if ('role' in incoming) {
    if (onboardingCompleted) {
      return res.status(403).json({ error: 'Role changes are not allowed after onboarding is complete.' });
    }
    if (incoming.role && !['fan', 'coach'].includes(incoming.role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
  }

  if ('plan' in incoming) {
    if (onboardingCompleted) {
      return res.status(403).json({ error: 'Plan changes are not allowed via this endpoint once onboarding is complete.' });
    }
    // Only allow rookie plan to be set directly; paid plans must go through checkout
    if (incoming.plan && incoming.plan !== 'rookie') {
      return res.status(403).json({ error: 'Paid plans must be purchased through the subscription flow.' });
    }
  }

  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
    is_parent: false,
    zip_code: null,
    onboarding_completed: true,
    // plan and role intentionally omitted from PATCH
    sports_interests: [],
    personalization_goals: [],
    primary_intents: [],
    location_enabled: false,
    notifications_enabled: true,
    messaging_policy_accepted: false,
  };
  const merged = mergePreferences(defaults, mergePreferences(currentPrefs, incoming));
  
  // If role is being changed, perform cascade cleanup (for defensive programming)
  // This ensures if role downgrade ever becomes possible, cleanup still happens
  if ('role' in incoming && incoming.role && incoming.role !== currentPrefs.role) {
    const oldRole = currentPrefs.role || 'fan';
    const newRole = incoming.role;
    await cleanupRoleDowngrade(req.user.id, oldRole, newRole);
  }
  
  const updated = await prisma.user.update({ where: { id: req.user.id }, data: { preferences: merged } });
  return res.json({ preferences: updated.preferences });
});

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  // Core identity fields
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  username: z.string().min(3).max(20).optional(),
  display_name: z.string().optional(),
  affiliation: z.enum(['none', 'university', 'high_school', 'club', 'youth', 'school', 'independent', 'professional']).optional(),
  dob: z.string().optional(),
  zip: z.string().optional(),
  zip_code: z.string().optional(),
  
  // Plan and subscription
  plan: z.enum(['rookie', 'veteran', 'legend']).optional(),
  payment_pending: z.union([z.boolean(), z.string()]).optional(),
  team_count_total: z.number().int().min(0).optional(),
  
  // Team/Organization
  team_id: z.string().optional(),
  team_name: z.string().optional(),
  organization_id: z.string().optional(),
  organization_name: z.string().optional(),
  sport: z.string().optional(),
  
  // Season
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  
  // Authorized users
  authorized: z.array(z.any()).optional(),
  authorized_users: z.array(z.any()).optional(),
  
  // Profile
  avatar_url: z.string().optional(),
  bio: z.string().optional(),
  sports_interests: z.array(z.string()).optional(),
  
  // Athlete-specific fields
  position: z.string().optional(),
  jersey_number: z.union([z.string(), z.number()]).optional(),
  grade_level: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior']).optional(),
  graduation_year: z.number().int().min(2020).max(2040).optional(),
  accolades: z.array(z.string()).optional(),
  primary_team_id: z.string().optional(),
  primary_sport: z.string().optional(),
  
  // Interests/Goals
  primary_intents: z.array(z.string()).optional(),
  personalization_goals: z.array(z.string()).optional(),
  
  // Features/Permissions
  location_enabled: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  messaging_policy_accepted: z.boolean().optional(),
});

authRouter.post('/me/complete-onboarding', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = completeOnboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Onboarding] Validation failed:', parsed.error);
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  }
  
  const data = parsed.data;
  
  // Validate coach-specific requirements
  if (data.role === 'coach') {
    // Previously enforced organization/team and paid plan before completion.
    // Allow completion to proceed even if these are missing so users are not blocked.
    // Downstream flows (settings/billing) can require plan/teams when needed.
    if (!data.organization_id && !data.team_id) {
      console.warn('[onboarding] Coach completed without org/team; allowed for now');
    }
    if (!data.plan) {
      console.warn('[onboarding] Coach completed without plan; allowed for now');
    }
    if (data.plan === 'rookie') {
      console.warn('[onboarding] Coach completed with rookie plan; allowed for now');
    }
    // Validate Veteran plan has team_count_total
    if (data.plan === 'veteran') {
      const teamCount = data.team_count_total || 0;
      if (teamCount < 3) {
        return res.status(400).json({ 
          error: 'Veteran plan requires at least 3 teams',
          minimum_teams: 3,
          provided_teams: teamCount
        });
      }
    }
  }
  
  // Validate paid plans require completed payment
  if (data.plan && ['veteran', 'legend'].includes(data.plan)) {
    if (data.payment_pending === true || data.payment_pending === 'true') {
      return res.status(400).json({ 
        error: 'Please complete payment before finishing onboarding',
        payment_status: 'pending',
        plan: data.plan
      });
    }
  }
  
  // Update user with direct fields
  const updateData: any = {};
  if (data.username) updateData.username = data.username;
  if (data.display_name) updateData.display_name = data.display_name;
  if (data.avatar_url) updateData.avatar_url = data.avatar_url;
  if (data.bio) updateData.bio = data.bio;
  
  const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (data.role === 'fan' && !currentUser?.bio && !data.bio) {
    updateData.bio = "Sports enthusiast following local teams and supporting young athletes 🏆";
  }
  
  // Prepare preferences update
  const preferencesUpdate: any = {
    onboarding_completed: true,
    role: data.role,
    plan: data.plan,
    affiliation: data.affiliation,
    dob: data.dob,
    zip_code: data.zip_code || data.zip,
    team_id: data.team_id,
    team_name: data.team_name,
    organization_id: data.organization_id,
    organization_name: data.organization_name,
    sport: data.sport,
    season_start: data.season_start,
    season_end: data.season_end,
    authorized_users: data.authorized || data.authorized_users,
    sports_interests: data.sports_interests,
    primary_intents: data.primary_intents || data.personalization_goals,
    personalization_goals: data.personalization_goals || data.primary_intents,
    location_enabled: data.location_enabled,
    notifications_enabled: data.notifications_enabled,
    messaging_policy_accepted: data.messaging_policy_accepted,
    payment_pending: data.payment_pending,
    team_count_total: data.team_count_total,
    // Athlete-specific fields
    position: data.position,
    jersey_number: data.jersey_number,
    grade_level: data.grade_level,
    graduation_year: data.graduation_year,
    accolades: data.accolades,
    primary_team_id: data.primary_team_id,
    primary_sport: data.primary_sport,
  };
  
  // Clean up undefined values
  Object.keys(preferencesUpdate).forEach(key => {
    if (preferencesUpdate[key] === undefined) {
      delete preferencesUpdate[key];
    }
  });
  
  // Get current preferences and merge
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  // Normalize any legacy 'rookie' role values to 'coach' during merge
  const basePreferences = current?.preferences;
  const normalizedCurrent =
    basePreferences && typeof basePreferences === 'object' && !Array.isArray(basePreferences)
      ? ({ ...(basePreferences as Record<string, any>) } as any)
      : ({} as any);
  if (normalizedCurrent.role === 'rookie') {
    normalizedCurrent.role = 'coach';
  }
  const merged = mergePreferences(normalizedCurrent || {}, preferencesUpdate);
  updateData.preferences = merged;
  
  // Update user
  const updated = await prisma.user.update({ 
    where: { id: req.user.id }, 
    data: updateData 
  });
  
  // Send role-specific welcome email after onboarding completion
  if (data.role === 'coach' && updated.email) {
    try {
      const plan = (data.plan || 'rookie') as 'rookie' | 'veteran' | 'legend';
      await sendCoachOnboardingEmail({
        to: updated.email,
        coachName: updated.display_name || updated.email.split('@')[0],
        plan,
        teamName: data.team_name,
        organizationName: data.organization_name,
      });
      debugLog(`✅ Coach onboarding email sent to ${updated.email}`);
    } catch (e) {
      console.warn('[onboarding] Failed to send coach welcome email:', e);
      // Don't block onboarding if email fails
    }
  } else if (data.role === 'fan' && updated.email) {
    try {
      await sendFanWelcomeEmail({
        to: updated.email,
        fanName: updated.display_name || updated.email.split('@')[0],
      });
      debugLog(`✅ Fan welcome email sent to ${updated.email}`);
    } catch (e) {
      console.warn('[onboarding] Failed to send fan welcome email:', e);
      // Don't block onboarding if email fails
    }
  }
  
  return res.json({ 
    message: 'Onboarding completed successfully', 
    user: sanitizeUser(updated) 
  });
});

// Request a new email verification code (authenticated)
authRouter.post('/verify/request', async (req: AuthedRequest, res) => {
  const requestStartTime = Date.now();
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) {
    debugLog(`[verify/request] ${user.email} already verified`);
    return res.json({ ok: true, already_verified: true });
  }
  
  // Admin bypass: no rate limiting for admin emails
  const isAdmin = isEmailAdmin(user.email);
  
  const now = Date.now();
  const key = user.id;
  const rec = verifyRate.get(key) || { last: 0, count: 0, hourStart: now };
  if (now - rec.hourStart > 3600_000) { rec.hourStart = now; rec.count = 0; }
  
  // Skip rate limiting for admin users
  if (!isAdmin) {
    if (now - rec.last < 30_000) {
      debugLog(`[verify/request] Rate limit hit for ${user.email} (30s cooldown)`);
      return res.status(429).json({ error: 'Please wait before requesting another code' });
    }
    if (rec.count >= 5) {
      debugLog(`[verify/request] Rate limit hit for ${user.email} (5/hour exceeded)`);
      return res.status(429).json({ error: 'Too many requests' });
    }
  }
  
  // Use cryptographically secure random for verification codes
  const code = String(crypto.randomInt(100000, 1000000));
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  
  await prisma.user.update({ 
    where: { id: user.id }, 
    data: { email_verification_code: code, email_verification_expires: exp } 
  });
  
  // Attempt to send verification email
  let emailSent = false;
  try {
    const emailStartTime = Date.now();
    emailSent = await sendVerificationEmail(user.email, code, user.display_name || user.email.split('@')[0]);
    const emailDuration = Date.now() - emailStartTime;
    
    if (emailSent) {
      debugLog(`[verify/request] ✅ Email sent to ${user.email} in ${emailDuration}ms`);
    } else {
      console.warn(`[verify/request] ⚠️ Email send returned false (SendGrid not configured) for ${user.email}`);
    }
  } catch (e) {
    console.error(`[verify/request] ❌ Email send failed for ${user.email}:`, e);
    // Continue - return code anyway for dev/testing
  }
  
  const sendGridReady = isSendGridConfigured();
  const shouldReturnDevCode = process.env.NODE_ENV !== 'production' || !sendGridReady;
  const payload: any = { ok: true };
  
  if (shouldReturnDevCode) {
    payload.dev_verification_code = code;
    if (!sendGridReady) {
      payload.email_hint = 'SendGrid not configured—code returned directly.';
    }
  }
  
  rec.last = now; 
  rec.count += 1; 
  verifyRate.set(key, rec);
  
  const totalDuration = Date.now() - requestStartTime;
  debugLog(`[verify/request] ✅ Response ready for ${user.email} in ${totalDuration}ms (email_sent=${emailSent}, dev_mode=${shouldReturnDevCode})`);
  
  return res.json(payload);
});

// Alias: /auth/verify/send
authRouter.post('/verify/send', async (req: AuthedRequest, res) => {
  (authRouter as any).handle({ ...req, url: '/verify/request' }, res);
});

// Verify code (authenticated)
authRouter.post('/verify/confirm', async (req: AuthedRequest, res) => {
  const requestStartTime = Date.now();
  
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const schema = z.object({ code: z.string().min(4).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  const { code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  
  // Brute force protection: check if user is locked out
  const attemptKey = user.id;
  const attempts = verifyAttempts.get(attemptKey) || { count: 0, lockedUntil: null };
  
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    const remainingMs = attempts.lockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    debugLog(`[verify/confirm] ❌ User ${user.email} locked out (${remainingMin}m remaining)`);
    return res.status(429).json({ 
      error: `Too many failed attempts. Try again in ${remainingMin} minutes.`,
      locked_until: new Date(attempts.lockedUntil).toISOString()
    });
  }
  
  // Reset lockout if expired
  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    attempts.count = 0;
    attempts.lockedUntil = null;
  }
  
  if (user.email_verified) {
    debugLog(`[verify/confirm] ${user.email} already verified`);
    return res.json({ ok: true, already_verified: true });
  }
  
  if (!user.email_verification_code || !user.email_verification_expires) {
    debugLog(`[verify/confirm] ❌ No verification in progress for ${user.email}`);
    return res.status(400).json({ error: 'No verification in progress' });
  }
  
  if (new Date() > user.email_verification_expires) {
    const expiredSince = Date.now() - user.email_verification_expires.getTime();
    debugLog(`[verify/confirm] ❌ Code expired for ${user.email} (${expiredSince}ms ago)`);
    return res.status(400).json({ error: 'Code expired' });
  }
  
  if (String(code) !== String(user.email_verification_code)) {
    // Track failed attempt
    attempts.count += 1;
    
    if (attempts.count >= MAX_VERIFY_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + VERIFY_LOCKOUT_MS;
      verifyAttempts.set(attemptKey, attempts);
      const attemptDuration = Date.now() - requestStartTime;
      debugLog(`[verify/confirm] ❌ User ${user.email} locked out after ${attempts.count} failed attempts (${attemptDuration}ms)`);
      return res.status(429).json({ 
        error: 'Too many failed attempts. Try again in 15 minutes.',
        locked_until: new Date(attempts.lockedUntil).toISOString()
      });
    }
    
    verifyAttempts.set(attemptKey, attempts);
    const remainingAttempts = MAX_VERIFY_ATTEMPTS - attempts.count;
    const attemptDuration = Date.now() - requestStartTime;
    debugLog(`[verify/confirm] ❌ Invalid code for ${user.email} (attempt: ${attemptDuration}ms, ${remainingAttempts} remaining)`);
    return res.status(400).json({ 
      error: 'Invalid code',
      attempts_remaining: remainingAttempts
    });
  }
  
  // Success - clear failed attempts
  verifyAttempts.delete(attemptKey);
  
  const updated = await prisma.user.update({ 
    where: { id: user.id }, 
    data: { 
      email_verified: true, 
      email_verification_code: null, 
      email_verification_expires: null 
    } 
  });
  
  const totalDuration = Date.now() - requestStartTime;
  debugLog(`[verify/confirm] ✅ Email verified for ${user.email} in ${totalDuration}ms`);
  
  return res.json({ ok: true, user: sanitizeUser(updated) });
});

function sanitizeUser(u: any) {
  const {
    password_hash,
    email_verification_code,
    email_verification_expires,
    password_reset_code,
    password_reset_expires,
    ...rest
  } = u as any;
  return rest;
}

// Test email endpoint (development only)
authRouter.post('/test-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoint not available in production' });
  }
  
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  try {
    debugLog('[email-test] Testing email functionality...');
    const sent = await sendVerificationEmail(email, '123456', 'VarsityHub Tester');
    if (!sent) {
      return res.status(503).json({ success: false, error: 'SendGrid not configured' });
    }
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('[email-test] Test email failed:', error);
    res.status(500).json({ success: false, error: (error as any).message || 'Unknown error' });
  }
});

export default authRouter;
