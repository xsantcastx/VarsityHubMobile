import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Router } from 'express';
import jwt from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';
import { z } from 'zod';
import { getClientIp, logAuditEvent } from '../lib/audit-log.js';
import { sendEmail, sendEmailWithTemplate } from '../lib/email.js';
import { signJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { createRefreshToken, revokeRefreshToken, validateRefreshToken } from '../lib/refresh-tokens.js';
import type { AuthedRequest } from '../middleware/auth.js';

// Define a custom interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    // Add other user properties here if needed
  };
}

// Utility function to merge preferences
function mergePreferences(current: any, updates: any) {
  const newPrefs = { ...(current || {}) };
  for (const key in updates) {
    if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
      newPrefs[key] = { ...(newPrefs[key] || {}), ...updates[key] };
    } else {
      newPrefs[key] = updates[key];
    }
  }
  return newPrefs;
}

export const authRouter = Router();
// Simple in-memory rate limiting for auth endpoints
const authRate: Map<string, { attempts: number; resetAt: number }> = new Map();
const MAX_AUTH_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkAuthRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = authRate.get(identifier);
  
  if (!record || now > record.resetAt) {
    authRate.set(identifier, { attempts: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  
  if (record.attempts >= MAX_AUTH_ATTEMPTS) {
    return false;
  }
  
  record.attempts++;
  return true;
}

// simple in-memory rate limiting for verification send: 1/30s, 5/hour per user
const verifyRate: Map<string, { last: number; count: number; hourStart: number }> = new Map();
const GOOGLE_ALLOWED_AUDIENCES = (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_AUDIENCE || '')
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

authRouter.post('/register', async (req, res) => {
  const start = Date.now();
  console.log('[register] Incoming request');
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, password, display_name, role } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  
  // Prevent duplicate accounts - check if email already exists
  // Users can create multiple accounts with different emails, but not duplicate the same email
  console.log('[register] Checking for existing user');
  let exists;
  try {
    exists = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  } catch (e) {
    console.error('[register] prisma findUnique error:', e);
    return res.status(500).json({ error: 'Database unavailable' });
  }
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const password_hash = await bcrypt.hash(password, 10);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const userRole = role || 'fan';
  
  // Set admin flag for the main admin account
  const isAdmin = sanitizedEmail === 'emilmancero@gmail.com';
  const initialPreferences = { 
    role: userRole, 
    onboarding_completed: false,
    ...(isAdmin && { is_admin: true })
  };
  
  console.log('[register] Creating user record');
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
  const access_token = signJwt({ id: user.id });
  try { 
    console.log('[email] Sending verification email to:', email);
    const emailSend = Promise.resolve(sendVerificationEmail(email, code));
    const EMAIL_TIMEOUT_MS = 5000;
    const timed = await Promise.race([
      emailSend,
      new Promise((resolve) => setTimeout(resolve, EMAIL_TIMEOUT_MS, 'timeout'))
    ]);
    if (timed === 'timeout') console.warn('[email] sendVerificationEmail timed out; continuing');
    console.log('[email] Verification email sent successfully');
  } catch (e) { 
    console.error('[email] Email send failed:', e);
    req.log?.warn?.({ err: e }, 'Email send failed; returning code in dev'); 
  }
  const payload: any = { access_token, user: sanitizeUser(user) };
  if (process.env.NODE_ENV !== 'production') payload.dev_verification_code = code;
  console.log('[register] Completed in', Date.now() - start, 'ms');
  return res.status(201).json(payload);
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Rate limiting
  if (!checkAuthRateLimit(sanitizedEmail)) {
    await logAuditEvent({
      action: 'LOGIN_FAILED',
      email: sanitizedEmail,
      ipAddress: clientIp,
      userAgent,
      metadata: { reason: 'rate_limit' },
      severity: 'warning',
    });
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }
  
  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) {
    await logAuditEvent({
      action: 'LOGIN_FAILED',
      email: sanitizedEmail,
      ipAddress: clientIp,
      userAgent,
      metadata: { reason: 'user_not_found' },
      severity: 'warning',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.banned) {
    await logAuditEvent({
      action: 'LOGIN_FAILED',
      userId: user.id,
      email: sanitizedEmail,
      ipAddress: clientIp,
      userAgent,
      metadata: { reason: 'account_banned' },
      severity: 'warning',
    });
    return res.status(403).json({ error: 'Account banned' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await logAuditEvent({
      action: 'LOGIN_FAILED',
      userId: user.id,
      email: sanitizedEmail,
      ipAddress: clientIp,
      userAgent,
      metadata: { reason: 'invalid_password' },
      severity: 'warning',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate tokens
  const access_token = signJwt({ id: user.id });
  const refreshTokenData = await createRefreshToken(user.id);
  
  await logAuditEvent({
    action: 'LOGIN_SUCCESS',
    userId: user.id,
    email: sanitizedEmail,
    ipAddress: clientIp,
    userAgent,
    severity: 'info',
  });
  
  const sanitized = sanitizeUser(user);
  const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;
  const body: any = { 
    access_token, 
    refresh_token: refreshTokenData.token,
    user: sanitized, 
    needs_onboarding: needsOnboarding 
  };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
});

const googleAuthSchema = z.object({
  id_token: z.string().min(10),
});

authRouter.post('/google', async (req, res) => {
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
        if (typeof currentPrefs.onboarding_completed === 'undefined') prefPatch.onboarding_completed = false;
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
    const access_token = signJwt({ id: sanitized.id });
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    return res.json({
      access_token,
      user: sanitized,
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err) {
    console.error('[auth/google] unexpected error', err);
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

const ALLOW_DEV_APPLE_TOKENS = process.env.NODE_ENV !== 'production';

const appleAuthSchema = z.object({
  identity_token: z.string().min(10),
  email: z.string().email().optional(),
  full_name: z.object({
    givenName: z.string().optional(),
    familyName: z.string().optional(),
  }).optional(),
});

authRouter.post('/apple', async (req, res) => {
  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { identity_token, email, full_name } = parsed.data;

  try {
    let decodedToken: any = null;
    let appleUserId: string | null = null;

    const parts = identity_token.split('.');
    const looksLikeJwt = parts.length === 3;

    // The Expo Go simulator may return a non-JWT string for Apple Sign-In.
    // This dev-only branch handles that case by creating a stable, fake user ID.
    // It is gated by ALLOW_DEV_APPLE_TOKENS, which is false in production.
    if (looksLikeJwt) {
      try {
        const applePublicKeys = await (
          await fetch('https://appleid.apple.com/auth/keys')
        ).json();
        const jwtHeader = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        const kid = jwtHeader.kid;
        const key = applePublicKeys.keys.find((k: any) => k.kid === kid);
        if (!key) {
          return res.status(401).json({ error: 'Apple public key not found' });
        }
        const pubKey = jwkToPem(key);
        decodedToken = jwt.verify(identity_token, pubKey, {
          algorithms: ['RS256'],
        });
        appleUserId = typeof decodedToken.sub === 'string' ? decodedToken.sub : null;
      } catch (err: any) {
        console.error('[auth/apple] JWT verification failed', err);
        return res.status(401).json({ error: 'Invalid Apple identity token' });
      }
    } else if (ALLOW_DEV_APPLE_TOKENS) {
      // This branch is for dev environment only, where the token is not a real JWT
      // It's a simple string that we can use as a stable identifier for dev/testing
      appleUserId = `dev-apple-id:${identity_token}`;
      decodedToken = {
        email: email,
        email_verified: 'true',
        // other fields can be mocked if needed
      };
    }

    if (!appleUserId) {
      return res.status(400).json({ error: 'Invalid Apple identity token' });
    }

    console.log('[auth/apple] token accepted', {
      userId: appleUserId,
      fromSimulator: !looksLikeJwt,
      hasEmail: Boolean(email || decodedToken?.email),
    });

    let user = await prisma.user.findUnique({ where: { apple_id: appleUserId } });
    let created = false;

    if (!user) {
      const userEmail = email || decodedToken.email;
      if (!userEmail) {
        return res.status(400).json({ error: 'Email not provided and not found in token' });
      }

      const existingByEmail = await prisma.user.findUnique({ where: { email: userEmail } });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { apple_id: appleUserId },
        });
      } else {
        const givenName = full_name?.givenName;
        const familyName = full_name?.familyName;
        const displayName = [givenName, familyName].filter(Boolean).join(' ') || userEmail.split('@')[0];
        const randomSecret = crypto.randomBytes(32).toString('hex');
        const password_hash = await bcrypt.hash(randomSecret, 10);

        user = await prisma.user.create({
          data: {
            email: userEmail,
            password_hash,
            apple_id: appleUserId,
            display_name: displayName,
            email_verified: true, // Apple users are considered verified
            preferences: { role: 'fan', onboarding_completed: false },
          },
        });
        created = true;
      }
    }

    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id });
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    return res.json({
      access_token,
      user: sanitized,
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err) {
    console.error('[auth/apple] unexpected error', err);
    return res.status(500).json({ error: 'Failed to authenticate with Apple' });
  }
});

const passwordResetRequestSchema = z.object({ email: z.string().email() });

authRouter.post('/password/forgot', async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const email = parsed.data.email.trim();
  console.log('[password-reset] Looking for user:', email);
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  const payload: any = { ok: true };
  if (!user) {
    console.log('[password-reset] No user found for:', email);
    return res.json(payload);
  }
  console.log('[password-reset] User found:', user.id, user.email);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_code: code,
        password_reset_expires: expires,
      },
    });
    console.log(`[password-reset] Successfully updated user ${user.id} with reset code.`);
  } catch (dbError) {
    console.error(`[password-reset] FATAL: Database update failed for user ${user.id}:`, dbError);
    // Do not proceed if we can't even save the code.
    return res.status(500).json({ error: 'Internal server error during password reset setup.' });
  }


  try {
    console.log('[email] Sending password reset email to:', user.email);
    await sendEmail({
      to: user.email,
      subject: 'Reset your VarsityHub password',
      text: `Use code ${code} to reset your VarsityHub password. This code expires in 30 minutes.`,
    });
    console.log('[email] Password reset email sent successfully');
  } catch (e) {
    console.error('[email] Password reset email failed:', e);
    req.log?.warn?.({ err: e }, 'Password reset email failed');
  }

  if (process.env.NODE_ENV !== 'production') payload.dev_reset_code = code;
  console.log('[password-reset] Request for', email, 'completed.');
  return res.json(payload);
});

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
  password: z.string().min(8),
});

authRouter.post('/password/reset', async (req, res) => {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, code, password } = parsed.data;

  console.log(`[password-reset] Attempting to reset password for ${email} with code ${code}`);

  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });
  if (!user || !user.password_reset_code || !user.password_reset_expires) {
    console.warn(`[password-reset] Invalid attempt for ${email}: No user or code found.`);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (new Date() > user.password_reset_expires) {
    console.warn(`[password-reset] Expired code used for ${email}.`);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (String(code).trim() !== String(user.password_reset_code)) {
    console.warn(`[password-reset] Invalid code used for ${email}.`);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  console.log(`[password-reset] Code verified for ${email}. Proceeding to update password.`);
  const password_hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      password_reset_code: null,
      password_reset_expires: null,
    },
  });

  console.log(`[password-reset] Successfully reset password for user ${user.id}`);

  return res.json({ ok: true });
});

authRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

const userUpdateSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  preferences: z.any().optional(),
});

authRouter.post('/me/update', async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const data = parsed.data as any;
  let patch: any = { ...data };
  if (data.preferences) {
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    const mergedPrefs = mergePreferences(current?.preferences || {}, data.preferences);
    patch.preferences = mergedPrefs;
  }
  const { preferences, ...rest } = patch;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { ...rest, ...(preferences ? { preferences } : {}) } });
  return res.json(sanitizeUser(user));
});

// PATCH /me (alias) to support partial updates including preferences
authRouter.patch('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: parsed.data,
  });

  res.json(user);
});

// PATCH /me/preferences to update preferences only
const userPreferencesUpdateSchema = z.object({
  notifications: z.object({
    game_event_reminders: z.boolean().optional(),
    team_updates: z.boolean().optional(),
    comments_upvotes: z.boolean().optional(),
  }).partial().optional(),
  is_parent: z.boolean().optional(),
  zip_code: z.string().min(2).max(20).optional().nullable(),
  onboarding_completed: z.boolean().optional(),
  
  // New onboarding fields
  plan: z.enum(['rookie', 'veteran', 'legend']).optional(),
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  affiliation: z.enum(['school', 'independent']).optional(),
  dob: z.string().optional(),
  sports_interests: z.array(z.string()).optional(),
  personalization_goals: z.array(z.string()).optional(),
  primary_intents: z.array(z.string()).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  location_enabled: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  messaging_policy_accepted: z.boolean().optional(),
}).partial();

authRouter.patch('/me/preferences', async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = userPreferencesUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { preferences: parsed.data },
  });

  res.json(user);
});

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  // Core identity fields
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  username: z.string().min(3).max(20).optional(),
  display_name: z.string().optional(),
  affiliation: z.enum(['none', 'university', 'high_school', 'club', 'youth', 'school', 'independent']).optional(),
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
  };
  
  // Clean up undefined values
  Object.keys(preferencesUpdate).forEach(key => {
    if (preferencesUpdate[key] === undefined) {
      delete preferencesUpdate[key];
    }
  });
  
  // Get current preferences and merge
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const currentPrefs = current?.preferences;
  // Normalize any legacy 'rookie' role values to 'coach' during merge
  const normalizedCurrent = (typeof currentPrefs === 'object' && currentPrefs !== null && !Array.isArray(currentPrefs) ? { ...currentPrefs } : {}) as any;
  if (normalizedCurrent && normalizedCurrent.role === 'rookie') {
    normalizedCurrent.role = 'coach';
  }
  const merged = mergePreferences(normalizedCurrent || {}, preferencesUpdate);
  updateData.preferences = merged;
  
  // Update user
  const updated = await prisma.user.update({ 
    where: { id: req.user.id }, 
    data: updateData 
  });
  
  return res.json({ 
    message: 'Onboarding completed successfully', 
    user: sanitizeUser(updated) 
  });
});

// Request a new email verification code (authenticated)
authRouter.post('/verify/request', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  const now = Date.now();
  const key = user.id;
  const rec = verifyRate.get(key) || { last: 0, count: 0, hourStart: now };
  if (now - rec.hourStart > 3600_000) { rec.hourStart = now; rec.count = 0; }
  if (now - rec.last < 30_000) return res.status(429).json({ error: 'Please wait before requesting another code' });
  if (rec.count >= 5) return res.status(429).json({ error: 'Too many requests' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { email_verification_code: code, email_verification_expires: exp } });
  try { await sendVerificationEmail(user.email, code); } catch (e) { req.log?.warn?.({ err: e }, 'Email send failed'); }
  const payload: any = { ok: true };
  if (process.env.NODE_ENV !== 'production') payload.dev_verification_code = code;
  rec.last = now; rec.count += 1; verifyRate.set(key, rec);
  return res.json(payload);
});

// Alias: /auth/verify/send
authRouter.post('/verify/send', async (req: AuthedRequest, res) => {
  (authRouter as any).handle({ ...req, url: '/verify/request' }, res);
});

// Verify code (authenticated)
authRouter.post('/verify/confirm', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const schema = z.object({ code: z.string().min(4).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  if (!user.email_verification_code || !user.email_verification_expires) return res.status(400).json({ error: 'No verification in progress' });
  if (new Date() > user.email_verification_expires) return res.status(400).json({ error: 'Code expired' });
  if (String(code) !== String(user.email_verification_code)) return res.status(400).json({ error: 'Invalid code' });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { email_verified: true, email_verification_code: null, email_verification_expires: null } });
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

async function sendVerificationEmail(to: string, code: string) {
  console.log(`[email] Starting sendVerificationEmail for ${to}`);
  
  // Try SendGrid Dynamic Template first
  const sendgridKey = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS;
  if (sendgridKey && sendgridKey.startsWith('SG.')) {
    try {
      console.log(`[email] Sending verification email via SendGrid Dynamic Template...`);
      const success = await sendEmailWithTemplate({
        to,
        dynamicData: {
          verification_code: code,
          subject: 'Verify your VarsityHub account',
        },
      });
      
      if (success) {
        console.log(`[email] ✅ Verification email sent successfully via SendGrid to ${to}`);
        return;
      }
    } catch (error) {
      console.error(`[email] SendGrid template failed, falling back to SMTP:`, error);
    }
  }
  
  // Fallback to SMTP
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || 'no-reply@example.com';
  
  console.log(`[email] SMTP Config - Host: ${host}, Port: ${port}, User: ${user ? user.substring(0, 3) + '***' : 'undefined'}, From: ${from}`);
  
  if (!host || !user || !pass || !port) {
    console.log(`[dev] Email verification code for ${to}: ${code}`);
    return;
  }
  
  try {
    console.log(`[email] Importing nodemailer...`);
    const nodemailerModule = await import('nodemailer');
    const nodemailer = (nodemailerModule as any).default ?? nodemailerModule;
    const secure = port === 465; // Only use SSL for port 465
    
    console.log(`[email] Creating transport with secure=${secure}...`);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log(`[email] Sending verification email to ${to}...`);
    await transporter.sendMail({
      from,
      to,
      subject: 'Verify your email',
      text: `Your VarsityHub verification code is ${code}.`,
    });
    console.log(`[email] ✅ Verification email sent successfully to ${to}`);
  } catch (error) {
    console.error(`[email] ❌ Failed to send verification email to ${to}:`, error);
    throw error;
  }
}

async function sendPasswordResetEmail(to: string, code: string) {
  console.log(`[email] Starting sendPasswordResetEmail for ${to}`);
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || 'no-reply@example.com';
  
  console.log(`[email] SMTP Config - Host: ${host}, Port: ${port}, User: ${user ? user.substring(0, 3) + '***' : 'undefined'}, From: ${from}`);
  
  if (!host || !user || !pass || !port) {
  // Password reset code sent via email - do not log sensitive data
    return;
  }
  
  try {
    console.log(`[email] Importing nodemailer...`);
    const nodemailerModule = await import('nodemailer');
    const nodemailer = (nodemailerModule as any).default ?? nodemailerModule;
    const secure = port === 465; // Only use SSL for port 465
    
    console.log(`[email] Creating transport with secure=${secure}...`);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log(`[email] Sending password reset email to ${to}...`);
    await transporter.sendMail({
      from,
      to,
      subject: 'Reset your VarsityHub password',
      text: `Use code ${code} to reset your VarsityHub password. This code expires in 30 minutes.`,
    });
    console.log(`[email] ✅ Password reset email sent successfully to ${to}`);
  } catch (error) {
    console.error(`[email] ❌ Failed to send password reset email to ${to}:`, error);
    throw error;
  }
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
    console.log('[email-test] Testing email functionality...');
    await sendVerificationEmail(email, '123456');
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('[email-test] Test email failed:', error);
    res.status(500).json({ success: false, error: (error as any).message || 'Unknown error' });
  }
});

// Refresh Token endpoint for silent token rotation
const refreshSchema = z.object({ refresh_token: z.string().min(1) });

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid refresh token' });
  
  const { refresh_token } = parsed.data;
  const userId = await validateRefreshToken(refresh_token);
  
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.banned) {
    return res.status(401).json({ error: 'User not found or banned' });
  }
  
  // Revoke old refresh token and create new one (token rotation)
  await revokeRefreshToken(refresh_token);
  const newRefreshTokenData = await createRefreshToken(userId);
  const access_token = signJwt({ id: userId });
  
  await logAuditEvent({
    action: 'LOGIN_SUCCESS',
    userId,
    email: user.email,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    metadata: { method: 'refresh_token' },
    severity: 'info',
  });
  
  return res.json({ 
    access_token, 
    refresh_token: newRefreshTokenData.token 
  });
});

export default authRouter;
