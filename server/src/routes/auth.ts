import bcrypt from 'bcrypt';
import crypto, { createPublicKey, type KeyObject } from 'crypto';
import { Router } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { sendPasswordChangedEmail, sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';
import { validateContent } from '../lib/contentFilter.js';
import { ConflictError } from '../lib/errors/ConflictError.js';
import { ValidationError } from '../lib/errors/ValidationError.js';
import { signJwt, signRefreshJwt, verifyRefreshJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { passwordResetLimiter } from '../middleware/rateLimiters.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const authRouter = Router();
// Simple in-memory rate limiting for auth endpoints
const authRate: Map<string, { attempts: number; resetAt: number }> = new Map();
const MAX_AUTH_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

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
const verifyConfirmRate: Map<string, { attempts: number; resetAt: number }> = new Map();
const GOOGLE_ALLOWED_AUDIENCES = (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_AUDIENCE || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_JWKS_TTL_MS = 6 * 60 * 60 * 1000;
const appleKeyCache = new Map<string, { key: KeyObject; expiresAt: number }>();

async function getApplePublicKey(kid: string): Promise<KeyObject> {
  const cached = appleKeyCache.get(kid);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  const response = await fetch(APPLE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Apple JWKS: ${response.status}`);
  }
  const data = await response.json() as { keys?: Array<Record<string, unknown>> };
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  const jwk = keys.find((key) => key?.kid === kid);
  if (!jwk) {
    throw new Error('Apple JWKS does not include requested key');
  }

  const key = createPublicKey({ key: jwk, format: 'jwk' });
  appleKeyCache.set(kid, { key, expiresAt: now + APPLE_JWKS_TTL_MS });
  return key;
}

/** COPPA: Returns true if DOB indicates user is under 13. Do not store data for under-13 users. */
function isUnder13(dob: string | null | undefined): boolean {
  if (!dob || typeof dob !== 'string') return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 13;
}

function getSessionVersion(preferences: unknown): number {
  const prefs =
    preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? (preferences as Record<string, unknown>)
      : {};
  const raw = prefs.session_version;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function bumpSessionVersion(preferences: unknown) {
  const prefs =
    preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? ({ ...(preferences as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const next = getSessionVersion(prefs) + 1;
  return { ...prefs, session_version: next };
}

function issueAuthTokens(user: { id: string; preferences?: unknown }) {
  const sessionVersion = getSessionVersion(user.preferences);
  return {
    access_token: signJwt({ id: user.id, sv: sessionVersion }),
    refresh_token: signRefreshJwt({ id: user.id, type: 'refresh', sv: sessionVersion }),
  };
}

function getModerationPreferences(preferences: unknown) {
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? (preferences as Record<string, any>)
    : {};
}

function getSuspensionStatus(preferences: unknown): { active: boolean; until: string | null } {
  const prefs = getModerationPreferences(preferences);
  const raw = typeof prefs.suspension_until === 'string' ? prefs.suspension_until : null;
  if (!raw) return { active: false, until: null };
  const until = new Date(raw);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { active: false, until: raw };
  }
  return { active: true, until: until.toISOString() };
}

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  display_name: z.string().optional(),
  // Rookie is a coach plan, not a role
  role: z.enum(['fan', 'coach']).optional(),
  dob: z.string().optional(), // COPPA: reject if under 13
});

authRouter.post('/register', asyncHandler(async (req, res) => {
  const start = Date.now();
  debugLog('[register] Incoming request');
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid registration data', {
      validationIssues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      })),
    });
  }
  const { email, password, display_name, role, dob } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();

  if (display_name && display_name.trim().length > 0) {
    const filterResult = validateContent({ content: display_name });
    if (!filterResult.valid) {
      throw new ValidationError(filterResult.error || 'Invalid display name', {
        errorCode: filterResult.code,
      });
    }
  }

  // COPPA: Reject registration if DOB indicates under 13
  if (dob && isUnder13(dob)) {
    throw new ValidationError('VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.', {
      errorCode: 'COPPA_UNDER_13',
    });
  }
  
  // Prevent duplicate accounts - check if email already exists
  // Users can create multiple accounts with different emails, but not duplicate the same email
  debugLog('[register] Checking for existing user');
  const exists = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (exists) {
    throw new ConflictError('Email already registered', {
      errorCode: 'EMAIL_ALREADY_REGISTERED',
    });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  console.log(`[verify-code] [register] Code generated: ${code} for ${sanitizedEmail}`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const userRole = role || 'fan';

  const initialPreferences = {
    role: userRole,
    onboarding_completed: false,
  };

  debugLog('[register] Creating user record');
  const user = await prisma.user.create({
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
  console.log(`[verify-code] [register] Code stored in DB for user ${user.id} (expires ${exp.toISOString()})`);
  const { access_token, refresh_token } = issueAuthTokens(user);
  try {
    console.log(`[verify-code] [register] Calling sendVerificationEmail → to: ${email}`);
    const emailSend = sendVerificationEmail(email, code, display_name || sanitizedEmail.split('@')[0]);
    const EMAIL_TIMEOUT_MS = 5000;
    const timed = await Promise.race([
      emailSend,
      new Promise((resolve) => setTimeout(resolve, EMAIL_TIMEOUT_MS, 'timeout'))
    ]);
    if (timed === 'timeout') {
      console.warn('[verify-code] [register] sendVerificationEmail timed out after 5s — email may still be queued by SendGrid');
    } else if (timed === false) {
      console.error('[verify-code] [register] sendVerificationEmail returned false — email was NOT sent (check SendGridProvider logs above for the specific error)');
    } else {
      console.log('[verify-code] [register] sendVerificationEmail returned true — email accepted by SendGrid');
    }
  } catch (e) {
    console.error('[verify-code] [register] sendVerificationEmail threw:', e);
    req.log?.warn?.({ err: e }, 'Email send failed; returning code in dev');
  }
  const payload: any = { access_token, refresh_token, user: sanitizeUser(user) };
  if (process.env.NODE_ENV !== 'production') payload.dev_verification_code = code;
  debugLog('[register] Completed in', Date.now() - start, 'ms');
  res.status(201).json(payload);
}));

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  
  // Rate limiting
  if (!checkAuthRateLimit(sanitizedEmail)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }
  
  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({ error: 'Account banned' });
  const suspension = getSuspensionStatus(user.preferences);
  if (suspension.active) {
    return res.status(403).json({ error: 'Account suspended', suspension_until: suspension.until });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const { access_token, refresh_token } = issueAuthTokens(user);
  const sanitized = sanitizeUser(user);
  const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;
  const body: any = { access_token, refresh_token, user: sanitized, needs_onboarding: needsOnboarding };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const payload = verifyRefreshJwt<{ id?: string; type?: string; sv?: number }>(parsed.data.refresh_token);
  if (!payload?.id || payload.type !== 'refresh') {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, banned: true, preferences: true },
  });
  if (!user) return res.status(401).json({ error: 'Invalid refresh token' });
  if (user.banned) return res.status(403).json({ error: 'Account banned' });
  const suspension = getSuspensionStatus(user.preferences);
  if (suspension.active) {
    return res.status(403).json({ error: 'Account suspended', suspension_until: suspension.until });
  }
  if ((payload.sv ?? 0) !== getSessionVersion(user.preferences)) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const tokens = issueAuthTokens(user);
  return res.json(tokens);
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
    const { access_token, refresh_token } = issueAuthTokens(user);
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    return res.json({
      access_token,
      refresh_token,
      user: sanitized,
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

authRouter.post('/apple', async (req, res) => {
  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { identity_token } = parsed.data;

  try {
    // In development/simulator, accept tokens starting with 'sim-' for testing
    const isDevelopmentToken = identity_token.startsWith('sim-');
    if (isDevelopmentToken && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: 'Development tokens are not allowed in production' });
    }
    
    let appleId: string;
    let email: string | null = null;
    
    if (isDevelopmentToken) {
      // Extract the simulator user ID
      appleId = identity_token.replace('sim-', '');
      email = `${appleId}@privaterelay.appleid.com`;
      // Using development token for simulator
    } else {
      // Production: Verify Apple identity token
      try {
        const decoded = jwt.decode(identity_token, { complete: true });
        if (!decoded || typeof decoded === 'string' || !decoded.header) {
          return res.status(400).json({ error: 'Invalid Apple token format' });
        }

        const kid = decoded.header.kid;
        if (!kid || typeof kid !== 'string') {
          return res.status(400).json({ error: 'Invalid Apple token header' });
        }

        const appleClientId = process.env.APPLE_CLIENT_ID;
        if (!appleClientId) {
          console.error('[auth/apple] APPLE_CLIENT_ID is not configured');
          return res.status(500).json({ error: 'Apple sign-in is not configured' });
        }
        const appleKey = await getApplePublicKey(kid);
        const jwtPayload = jwt.verify(identity_token, appleKey, {
          algorithms: ['RS256'],
          issuer: 'https://appleid.apple.com',
          audience: appleClientId,
        }) as JwtPayload;

        appleId = jwtPayload.sub as string;
        email = (jwtPayload.email as string) || null;

        if (!appleId) {
          return res.status(400).json({ error: 'Missing user identifier in token' });
        }
        debugLog('[auth/apple] Apple token verified');
      } catch (err: any) {
        console.error('[auth/apple] Token verification failed:', err?.message || err);
        return res.status(400).json({ error: 'Failed to verify Apple token', detail: err?.message });
      }
    }

    if (!appleId) {
      return res.status(400).json({ error: 'Invalid Apple credential' });
    }

    // Look up user by Apple ID
    let user = await prisma.user.findUnique({ where: { apple_id: appleId } });
    let created = false;

    if (!user) {
      // Check if user exists by email (if provided) - use case-insensitive search
      let existingByEmail = null;
      if (email) {
        existingByEmail = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } }
        });
      }

      if (existingByEmail) {
        // Link Apple ID to existing account
        const currentPrefs = (existingByEmail as any)?.preferences || {};
        const prefPatch: Record<string, unknown> = {};
        if (typeof currentPrefs.role !== 'string') prefPatch.role = 'fan';
        if (typeof currentPrefs.onboarding_completed === 'undefined') prefPatch.onboarding_completed = false;
        
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

        try {
          const displayName = email ? email.split('@')[0] : 'Apple User';
          user = await prisma.user.create({
            data: {
              email: userEmail,
              password_hash,
              apple_id: appleId,
              display_name: displayName,
              email_verified: true,
              preferences: { role: 'fan', onboarding_completed: false },
            },
          });
          created = true;
        } catch (createErr: any) {
          // Handle unique constraint violation (P2002) - user may have been created concurrently
          // or exists with different apple_id
          if (createErr?.code === 'P2002') {
            debugLog('[auth/apple] User already exists, linking Apple ID');
            const existingUser = await prisma.user.findFirst({
              where: { email: { equals: userEmail, mode: 'insensitive' } }
            });
            if (existingUser) {
              user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  apple_id: appleId,
                  email_verified: true,
                  email_verification_code: null,
                  email_verification_expires: null,
                },
              });
            } else {
              throw createErr; // Re-throw if we still can't find the user
            }
          } else {
            throw createErr;
          }
        }
      }
    }

    const sanitized = sanitizeUser(user);
    const { access_token, refresh_token } = issueAuthTokens(user);
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    return res.json({
      access_token,
      refresh_token,
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

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_reset_code: code,
      password_reset_expires: expires,
    },
  });

  try {
    debugLog('[email] Sending password reset email to:', user.email);
    const sent = await sendPasswordResetEmail(user.email, code);
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
  password: z.string().min(8),
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
      preferences: bumpSessionVersion(user.preferences),
    },
  });

  return res.json({ ok: true });
});

const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

authRouter.post('/password/change', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { current_password, new_password } = parsed.data;
  
  // Get user with password hash
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Verify current password
  const isValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });
  
  // Hash new password
  const password_hash = await bcrypt.hash(new_password, 10);
  
  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      preferences: bumpSessionVersion(user.preferences),
    },
  });
  
  // Send confirmation email
  try {
    const userName = user.display_name || user.email?.split('@')[0] || 'VarsityHub user';
    await sendPasswordChangedEmail(user.email, userName);
  } catch (e) {
    console.warn('[email] Password changed email failed:', e);
    // Don't fail the request if email fails
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
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const is_admin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false, follows_notifications: true, messages_notifications: true },
    is_parent: false,
    zip_code: null,
    // Only set onboarding_completed=true for admin accounts
    ...(is_admin ? { onboarding_completed: true } : {}),
  };
  // CRITICAL: Admin defaults must override DB values (second arg overrides first in mergePreferences)
  // This ensures admin accounts always have onboarding_completed=true regardless of DB state
  // Non-admin users' preferences are merged without forcing onboarding_completed
  const userPrefs = (user as any).preferences || {};
  const prefs = mergePreferences(userPrefs, defaults);
  const moderationPrefs = getModerationPreferences(user.preferences);
  const { password_hash, ...rest } = user as any;
  return res.json({
    ...rest,
    ...(is_admin ? { role: 'admin' } : {}),
    preferences: prefs,
    is_admin,
    approval_status: typeof moderationPrefs.approval_status === 'string' ? moderationPrefs.approval_status : null,
    approval_reason: typeof moderationPrefs.approval_reason === 'string' ? moderationPrefs.approval_reason : null,
    suspension_until:
      typeof moderationPrefs.suspension_until === 'string' ? moderationPrefs.suspension_until : null,
  });
});

const updateMeSchema = z.object({
  display_name: z.string().min(1).max(15).refine((val) => val.trim().length > 0, { message: 'Display name cannot be only whitespace' }).optional(),
  username: z.string().min(1).max(25).regex(/^[a-z0-9_.]+$/, { message: 'Username can only contain lowercase letters, numbers, dots, and underscores' }).optional(),
  avatar_url: z.string()
    .url({ message: 'Avatar URL must be a valid URL' })
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // Only allow https
        if (parsed.protocol !== 'https:') return false;
        // Allow specific domains (Cloudinary, etc.)
        const allowedDomains = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app'];
        return allowedDomains.some(d => parsed.hostname.endsWith(d));
      } catch (error) {
        console.warn('[auth] Invalid avatar URL format:', error);
        return false;
      }
    }, { message: 'Avatar URL must be from an allowed domain (Cloudinary or VarsityHub CDN)' })
    .optional()
    .nullable(),
  bio: z.string().max(1000).transform((val) => val === '' ? null : val).optional().nullable(),
  preferences: z.any().optional(),
});

authRouter.put('/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data as any;
  let patch: any = { ...data };
  
  // Validate username availability if provided
  if (data.username) {
    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: data.username, mode: 'insensitive' } },
          { display_name: { equals: data.username, mode: 'insensitive' } }
        ],
        NOT: { id: req.user.id }
      },
      select: { id: true }
    });
    if (exists) {
      return res.status(400).json({ 
        error: 'Username taken',
        message: 'This username is already in use.',
      });
    }
    patch.username = data.username;
  }
  if (data.bio != null && data.bio !== '') {
    const filterResult = validateContent({ content: data.bio });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
  }
  if (data.display_name != null && data.display_name !== '') {
    const filterResult = validateContent({ content: data.display_name });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
  }
  
  if (data.preferences) {
    // COPPA: Reject if DOB in preferences indicates under 13
    const dobToCheck = data.preferences?.dob;
    if (dobToCheck !== undefined && isUnder13(dobToCheck)) {
      return res.status(403).json({
        error: 'COPPA_UNDER_13',
        message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
      });
    }
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    const mergedPrefs = mergePreferences(current?.preferences || {}, data.preferences);
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
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data as any;
  let patch: any = { ...data };
  
  // Validate username availability if provided
  if (data.username) {
    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: data.username, mode: 'insensitive' } },
          { display_name: { equals: data.username, mode: 'insensitive' } }
        ],
        NOT: { id: req.user.id }
      },
      select: { id: true }
    });
    if (exists) {
      return res.status(400).json({ 
        error: 'Username taken',
        message: 'This username is already in use.',
      });
    }
    patch.username = data.username;
  }
  if (data.bio != null && data.bio !== '') {
    const filterResult = validateContent({ content: data.bio });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
  }
  if (data.display_name != null && data.display_name !== '') {
    const filterResult = validateContent({ content: data.display_name });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
  }
  
  if (data.preferences) {
    // COPPA: Reject if DOB in preferences indicates under 13
    const dobToCheck = data.preferences?.dob;
    if (dobToCheck !== undefined && isUnder13(dobToCheck)) {
      return res.status(403).json({
        error: 'COPPA_UNDER_13',
        message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
      });
    }
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    const mergedPrefs = mergePreferences(current?.preferences || {}, data.preferences);
    patch.preferences = mergedPrefs;
  }
  const { preferences, ...rest } = patch;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { ...rest, ...(preferences ? { preferences } : {}) } });
  return res.json(sanitizeUser(user));
});

// Utility to deep-merge preferences, preserving nested notification keys
function mergePreferences(base: any, incoming: any) {
  if (!base && !incoming) return {};
  if (!base) return incoming;
  if (!incoming) return base;
  
  const out = { ...base };
  
  // Deep merge for nested objects
  for (const key in incoming) {
    if (incoming[key] === null || incoming[key] === undefined) {
      // Explicit null/undefined means remove (for optional fields)
      // But preserve existing if not explicitly set to null
      if (incoming[key] === null && key in incoming) {
        delete out[key];
      }
    } else if (typeof incoming[key] === 'object' && !Array.isArray(incoming[key]) && incoming[key] !== null && incoming[key].constructor === Object) {
      // Deep merge objects (but not arrays or special objects like Date)
      out[key] = mergePreferences(base[key], incoming[key]);
    } else {
      // Overwrite primitives and arrays
      out[key] = incoming[key];
    }
  }
  
  return out;
}

// Partial update for user preferences
authRouter.patch('/me/preferences', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const schema = z.object({
    notifications: z.object({
      game_event_reminders: z.boolean().optional(),
      team_updates: z.boolean().optional(),
      comments_upvotes: z.boolean().optional(),
      follows_notifications: z.boolean().optional(),
      messages_notifications: z.boolean().optional(),
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
    push_token: z.string().optional(),
    profile_private: z.boolean().optional(),
    comment_permission: z.enum(['everyone', 'following', 'none']).optional(),
  }).partial();
  
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const incoming = parsed.data as any;
  // COPPA: Reject if DOB indicates under 13 - do not store
  if (incoming.dob !== undefined && isUnder13(incoming.dob)) {
    return res.status(403).json({
      error: 'COPPA_UNDER_13',
      message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
    });
  }
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true, email: true } });
  const currentPrefs = (current?.preferences && typeof current.preferences === 'object')
    ? (current.preferences as Record<string, any>)
    : {};
  const onboardingCompleted = currentPrefs.onboarding_completed === true;

  const currentPlan = typeof currentPrefs.plan === 'string' ? currentPrefs.plan : undefined;
  const requestedPlan = typeof incoming.plan === 'string' ? incoming.plan : undefined;
  if (requestedPlan !== undefined && requestedPlan !== currentPlan) {
    const canSetInitialRookiePlan =
      requestedPlan === 'rookie' &&
      !onboardingCompleted &&
      (!currentPlan || currentPlan === 'rookie');

    if (!canSetInitialRookiePlan) {
      return res.status(403).json({
        error: 'PLAN_UPDATE_NOT_ALLOWED',
        message: 'Plan changes are managed by billing and cannot be updated from preferences.',
      });
    }
  }

  const currentRole = typeof currentPrefs.role === 'string' ? currentPrefs.role : undefined;
  const requestedRole = typeof incoming.role === 'string' ? incoming.role : undefined;
  if (requestedRole !== undefined && requestedRole !== currentRole && onboardingCompleted) {
    return res.status(403).json({
      error: 'ROLE_UPDATE_NOT_ALLOWED',
      message: 'Role changes are only allowed during onboarding.',
    });
  }

  // Check if user is admin (same logic as GET /me endpoint)
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const is_admin = current?.email ? adminEmails.includes(current.email.toLowerCase()) : false;
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false, follows_notifications: true, messages_notifications: true },
    is_parent: false,
    zip_code: null,
    // Only set onboarding_completed=true for admin accounts (same as GET /me)
    ...(is_admin ? { onboarding_completed: true } : {}),
    plan: null, // Plans only for coaches - don't default to 'rookie'
    role: 'fan',
    sports_interests: [],
    personalization_goals: [],
    primary_intents: [],
    location_enabled: false,
    notifications_enabled: true,
    messaging_policy_accepted: false,
  };
  // CRITICAL: Correct merge order - defaults are base, user prefs override defaults, incoming overrides both
  // 1. Start with defaults (fill in missing fields)
  // 2. Apply current user preferences on top (preserve user's actual values)
  // 3. Apply incoming changes on top (apply this update)
  const merged = mergePreferences(mergePreferences(defaults, currentPrefs), incoming);
  const updated = await prisma.user.update({ where: { id: req.user.id }, data: { preferences: merged } });
  return res.json({ preferences: updated.preferences });
});

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  // Core identity fields
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  username: z.string().min(1).max(25).optional(),
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

  // COPPA: Reject if DOB indicates under 13 - do not store
  if (data.dob !== undefined && isUnder13(data.dob)) {
    return res.status(403).json({
      error: 'COPPA_UNDER_13',
      message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
    });
  }
  if (data.display_name && data.display_name.trim().length > 0) {
    const filterResult = validateContent({ content: data.display_name });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
  }
  
  // Get current preferences FIRST to preserve role if not in payload
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const currentPrefs = current?.preferences as any || {};
  
  // CRITICAL: Role MUST be preserved from onboarding step-1 or provided in payload
  // If role is undefined in payload, use existing role from preferences (set during step-1)
  const finalRole = data.role !== undefined ? data.role : (currentPrefs.role || 'fan');
  
  // CRITICAL: For coaches, validate required steps are completed
  if (finalRole === 'coach') {
    // Coaches MUST have: username, plan, and team/org
    if (!data.username) {
      return res.status(400).json({ error: 'Username required for coach onboarding' });
    }
    if (!data.plan) {
      return res.status(400).json({ error: 'Plan selection required for coach onboarding' });
    }
    if (!data.team_id && !data.organization_id) {
      return res.status(400).json({ error: 'Team or organization required for coach onboarding' });
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
    role: finalRole, // Always set role explicitly - never leave undefined
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
  
  // CRITICAL: Role must NEVER be undefined - preserve from current preferences if not in payload
  // This ensures OAuth-created users (who start as 'fan') can properly become 'coach' during onboarding
  if (preferencesUpdate.role === undefined) {
    preferencesUpdate.role = currentPrefs.role || 'fan'; // Use existing role or default to fan
  }
  
  // Clean up undefined values (but keep role - it's already set above)
  Object.keys(preferencesUpdate).forEach(key => {
    if (preferencesUpdate[key] === undefined && key !== 'role') {
      delete preferencesUpdate[key];
    }
  });
  // Normalize any legacy 'rookie' role values to 'coach' during merge
  const basePreferences = current?.preferences;
  const normalizedCurrent =
    basePreferences && typeof basePreferences === 'object' && !Array.isArray(basePreferences)
      ? ({ ...(basePreferences as Record<string, any>) } as any)
      : ({} as any);
  if (normalizedCurrent.role === 'rookie') {
    normalizedCurrent.role = 'coach';
  }
  // CRITICAL: Ensure role from preferencesUpdate takes precedence (user's choice during onboarding)
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
  console.log(`[verify-code] [verify/request] Code generated: ${code} for user ${user.id} (${user.email})`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { email_verification_code: code, email_verification_expires: exp } });
  console.log(`[verify-code] [verify/request] Code stored in DB (expires ${exp.toISOString()})`);
  try {
    console.log(`[verify-code] [verify/request] Calling sendVerificationEmail → to: ${user.email}`);
    const sent = await sendVerificationEmail(user.email, code, user.display_name || user.email.split('@')[0]);
    if (!sent) {
      console.error('[verify-code] [verify/request] sendVerificationEmail returned false — email was NOT sent (check SendGridProvider logs above for the specific error)');
    } else {
      console.log('[verify-code] [verify/request] sendVerificationEmail returned true — email accepted by SendGrid');
    }
  } catch (e) {
    console.error('[verify-code] [verify/request] sendVerificationEmail threw:', e);
    req.log?.warn?.({ err: e }, 'Email send failed');
  }
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
  const now = Date.now();
  const confirmKey = user.id;
  const confirmRec = verifyConfirmRate.get(confirmKey);
  if (confirmRec && now < confirmRec.resetAt && confirmRec.attempts >= 10) {
    return res.status(429).json({ error: 'Too many verification attempts. Please request a new code or try again later.' });
  }
  if (!user.email_verification_code || !user.email_verification_expires) return res.status(400).json({ error: 'No verification in progress' });
  if (new Date() > user.email_verification_expires) return res.status(400).json({ error: 'Code expired' });
  if (String(code) !== String(user.email_verification_code)) {
    const nextAttempts = confirmRec && now < confirmRec.resetAt ? confirmRec.attempts + 1 : 1;
    verifyConfirmRate.set(confirmKey, { attempts: nextAttempts, resetAt: now + AUTH_WINDOW_MS });
    return res.status(400).json({ error: 'Invalid code' });
  }
  verifyConfirmRate.delete(confirmKey);
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

// Test email endpoint (development only)
authRouter.post('/test-email', requireAdmin as any, async (req, res) => {
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
