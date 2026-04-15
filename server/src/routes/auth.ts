import bcrypt from 'bcrypt';
import crypto, { createPublicKey, type KeyObject } from 'crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { sendPasswordResetEmail, sendVerificationEmail, sendEmail } from '../lib/email.js';
import { validateContent } from '../lib/contentFilter.js';
import { ConflictError } from '../lib/errors/ConflictError.js';
import { ValidationError } from '../lib/errors/ValidationError.js';
import { signJwt, generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_EXPIRY_DAYS } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { captureException } from '../lib/sentry.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { authLimiter, oauthLimiter, passwordResetLimiter, verificationConfirmLimiter } from '../middleware/rateLimiters.js';
import { rlIncr, rlGet, rlSet, rlDel } from '../lib/redisRateLimit.js';
import { cacheGet, cacheSet, cacheDel } from '../lib/cache.js';
import { isAdminEmail } from '../lib/adminEmails.js';
import { invalidatePrivateIdsCache } from '../lib/privacyUtils.js';

export const authRouter = Router();

// Rate limit thresholds (unchanged)
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RESET_FAILURES = 5;
const RESET_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// v1.0.2 audit fix: unified truthy parsing — must match middleware/rateLimiters.ts.
// Previously this checked "true" while rateLimiters.ts checked "1", so setting either
// value alone left half the app rate-limited.
const isRateLimitDisabled = (): boolean => {
  const v = process.env.DISABLE_RATE_LIMITING;
  return v !== undefined && ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
};

// Redis-backed auth rate limiting using INCR + EXPIRE pattern
async function checkAuthRateLimit(identifier: string): Promise<boolean> {
  if (isRateLimitDisabled()) return true;
  const key = `auth:${identifier}`;
  const count = await rlIncr(key, AUTH_WINDOW_MS);
  return count <= MAX_AUTH_ATTEMPTS;
}

// Redis-backed password reset failure tracking
async function checkResetAttempt(email: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const key = `resetfail:${email}`;
  const raw = await rlGet(key);
  if (!raw) return { allowed: true };

  const record = JSON.parse(raw) as { attempts: number; lockedUntil: number };

  // Currently locked out
  if (record.attempts >= MAX_RESET_FAILURES && record.lockedUntil > Date.now()) {
    return { allowed: false, retryAfterMs: record.lockedUntil - Date.now() };
  }

  return { allowed: true };
}

async function recordResetFailure(email: string): Promise<void> {
  const key = `resetfail:${email}`;
  const raw = await rlGet(key);
  let record = raw ? (JSON.parse(raw) as { attempts: number; lockedUntil: number }) : { attempts: 0, lockedUntil: 0 };

  record.attempts++;
  if (record.attempts >= MAX_RESET_FAILURES) {
    record.lockedUntil = Date.now() + RESET_LOCKOUT_MS;
  }
  // TTL = lockout window so keys auto-expire after lockout period
  await rlSet(key, JSON.stringify(record), RESET_LOCKOUT_MS);
}

async function clearResetFailures(email: string): Promise<void> {
  await rlDel(`resetfail:${email}`);
}

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};
const shouldExposeDevCodes =
  process.env.ENABLE_DEV_CODES === '1' &&
  (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');
const GOOGLE_ALLOWED_AUDIENCES = (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_AUDIENCE || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

// Create a single OAuth2Client for token verification (uses Google's public keys, cached automatically)
const googleOAuthClient = new OAuth2Client();

// Enforce Google OAuth audience validation in production
if (process.env.NODE_ENV === 'production' && GOOGLE_ALLOWED_AUDIENCES.length === 0) {
  console.error('[auth] FATAL: GOOGLE_OAUTH_CLIENT_IDS is not set — Google sign-in will reject all tokens in production');
}

// Warn if Apple simulator tokens are enabled in production
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_APPLE_SIM_TOKENS === 'true') {
  console.error('[auth] WARNING: ALLOW_APPLE_SIM_TOKENS is enabled in production — this is a security risk. Disable immediately.');
}

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

/** Parse YYYY-MM-DD as local date (avoids UTC off-by-one when timezone offset shifts the day) */
function parseDobLocal(dob: string): Date {
  const parts = dob.split('-').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dob); // fallback
}

/** COPPA: Returns true if DOB indicates user is under 13. Do not store data for under-13 users. */
function isUnder13(dob: string | null | undefined): boolean {
  if (!dob || typeof dob !== 'string') return false;
  const d = parseDobLocal(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 13;
}

const passwordRequirement = z.string().min(8).refine(
  (val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val),
  { message: 'Password must contain at least one letter and one number' }
);

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: passwordRequirement,
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

  // Content filter display_name to prevent profane/abusive names at registration
  if (display_name) {
    const nameFilter = validateContent({ content: display_name });
    if (!nameFilter.valid) {
      return res.status(400).json({ error: 'Display name contains inappropriate content.' });
    }
  }

  // SECURITY: Rate limiting to prevent mass account creation / enumeration
  if (!(await checkAuthRateLimit(`register:${sanitizedEmail}`))) {
    return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
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
  const code = String(crypto.randomInt(100000, 999999));
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [register] Code generated: ${code} for ${sanitizedEmail}`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const userRole = role || 'fan';

  // Set admin flag based on ADMIN_EMAILS env var
  const isAdmin = isAdminEmail(sanitizedEmail);
  const initialPreferences = {
    role: userRole,
    onboarding_completed: false,
    ...(isAdmin && { is_admin: true })
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
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [register] Code stored in DB for user ${user.id} (expires ${exp.toISOString()})`);
  const access_token = signJwt({ id: user.id });
  // Fire-and-forget email — don't block the HTTP response waiting for SendGrid
  sendVerificationEmail(email, code, display_name || sanitizedEmail.split('@')[0])
    .then((result) => {
      if (result === false) {
        console.error('[register] sendVerificationEmail returned false — email NOT sent');
      } else {
        console.log('[register] sendVerificationEmail accepted by SendGrid');
      }
    })
    .catch((e) => {
      console.error('[register] sendVerificationEmail threw:', e);
    });
  // Issue refresh token on registration
  const rawRefreshReg = generateRefreshToken();
  const regTokenHash = hashRefreshToken(rawRefreshReg);
  const regExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token_hash: regTokenHash, user_id: user.id, expires_at: regExpiry } });

  const payload: any = { access_token, refresh_token: rawRefreshReg, user: sanitizeUser(user) };
  if (shouldExposeDevCodes) payload.dev_verification_code = code;
  debugLog('[register] Completed in', Date.now() - start, 'ms');
  res.status(201).json(payload);
}));

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  
  // Rate limiting
  if (!(await checkAuthRateLimit(sanitizedEmail))) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }
  
  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({ error: 'Account banned' });
  if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const access_token = signJwt({ id: user.id });

  // Issue refresh token
  const rawRefresh = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { token_hash: tokenHash, user_id: user.id, expires_at: expiresAt },
  });

  const sanitized = sanitizeUser(user);
  const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;
  // Include is_admin flag so AuthProvider knows admin status immediately on login
  const isLoginAdmin = isAdminEmail(user.email);
  const body: any = {
    access_token,
    refresh_token: rawRefresh,
    user: { ...sanitized, is_admin: isLoginAdmin, ...(isLoginAdmin ? { role: 'admin' } : {}) },
    needs_onboarding: needsOnboarding,
  };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
}));

/**
 * POST /auth/refresh
 * Exchange a valid refresh token for a new access token + rotated refresh token.
 * The old refresh token is invalidated (rotation prevents reuse).
 */
const refreshSchema = z.object({ refresh_token: z.string().min(32) });

authRouter.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  if (!req.body?.refresh_token || typeof req.body.refresh_token !== 'string' || !req.body.refresh_token.trim()) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) return res.status(401).json({ error: 'Invalid refresh token' });

    const { refresh_token } = parsed.data;
    const tokenHash = hashRefreshToken(refresh_token);

    // Find and validate the refresh token
    const stored = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
    if (!stored) return res.status(401).json({ error: 'Invalid refresh token' });
    if (stored.expires_at < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Check user still valid
    const user = await prisma.user.findUnique({ where: { id: stored.user_id } });
    if (!user || user.banned) {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return res.status(401).json({ error: 'Account not found or banned' });
    }

    // Reject tokens issued before a password change
    if (user.password_changed_at && stored.created_at < user.password_changed_at) {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return res.status(401).json({ error: 'Token invalidated by password change' });
    }

    // Rotate: delete old token, issue new pair
    // Wrapped in try-catch to handle race condition where two concurrent
    // refresh requests find the same token but only one can delete it.
    const newRawRefresh = generateRefreshToken();
    const newHash = hashRefreshToken(newRawRefresh);
    const newExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    try {
      await prisma.$transaction([
        prisma.refreshToken.delete({ where: { id: stored.id } }),
        prisma.refreshToken.create({
          data: { token_hash: newHash, user_id: user.id, expires_at: newExpiry },
        }),
      ]);
    } catch (txErr: any) {
      // Token was already deleted by a concurrent request — treat as invalid
      if (txErr?.code === 'P2025') {
        return res.status(401).json({ error: 'Token already used' });
      }
      throw txErr;
    }

    const access_token = signJwt({ id: user.id });
    return res.json({ access_token, refresh_token: newRawRefresh });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}));

/**
 * POST /auth/revoke-all-tokens
 * Invalidates every refresh token for the current user.
 * Use when a security breach is detected.
 */
authRouter.post('/revoke-all-tokens', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { count } = await prisma.refreshToken.deleteMany({ where: { user_id: req.user!.id } });
  return res.json({ ok: true, revoked: count });
}));

/**
 * POST /auth/logout
 * Invalidates the provided refresh token.
 */
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body || {};
  if (refresh_token && typeof refresh_token === 'string') {
    const tokenHash = hashRefreshToken(refresh_token);
    await prisma.refreshToken.deleteMany({ where: { token_hash: tokenHash } }).catch(() => {});
  }
  return res.json({ ok: true });
}));

const googleAuthSchema = z.object({
  id_token: z.string().min(10),
});

authRouter.post('/google', oauthLimiter, asyncHandler(async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { id_token } = parsed.data;

  let stage = 'verify-token';
  try {
    // Stage 1: Verify token with google-auth-library (signature + expiry, cached public keys)
    let payload: any;
    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken: id_token,
        // When audiences are configured, enforce them; otherwise accept any (dev mode)
        ...(GOOGLE_ALLOWED_AUDIENCES.length > 0 ? { audience: GOOGLE_ALLOWED_AUDIENCES } : {}),
      });
      payload = ticket.getPayload();
    } catch (verifyErr: any) {
      const msg = verifyErr?.message || String(verifyErr);
      console.error('[auth/google] verifyIdToken failed', { message: msg });
      captureException(verifyErr instanceof Error ? verifyErr : new Error(msg), { stage: 'verify-token' });
      // Distinguish audience mismatch from other failures
      if (msg.includes('audience') || msg.includes('Token used too late') || msg.includes('Invalid token')) {
        return res.status(401).json({ error: 'Google authentication failed', detail: msg });
      }
      return res.status(401).json({ error: 'Google authentication failed' });
    }

    if (!payload) {
      console.error('[auth/google] verifyIdToken returned no payload');
      return res.status(401).json({ error: 'Google authentication failed' });
    }

    // Stage 2: Extract and validate fields
    stage = 'validate';
    const googleId = typeof payload.sub === 'string' ? payload.sub : null;
    const email = typeof payload.email === 'string' ? String(payload.email).toLowerCase() : null;
    const emailVerified = payload.email_verified === true;

    if (!googleId || !email) {
      console.warn('[auth/google] missing sub or email', { hasGoogleId: !!googleId, hasEmail: !!email });
      return res.status(400).json({ error: 'Invalid Google credential' });
    }

    if (!emailVerified) {
      console.warn('[auth/google] email not verified', { email });
      return res.status(400).json({ error: 'Google account email is not verified' });
    }

    // Use Google profile name if available, otherwise null — don't use email prefix as display name
    const displayNameSource = typeof payload.name === 'string' && payload.name.trim().length
      ? payload.name.trim()
      : null;
    const avatarUrl = typeof payload.picture === 'string' ? payload.picture : null;

    // Stage 4: User lookup/creation
    stage = 'user-lookup';
    let user = await prisma.user.findUnique({ where: { google_id: googleId } });
    let created = false;

    if (!user) {
      stage = 'user-resolve';
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        stage = 'link-google';
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
        stage = 'create-user';
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
      stage = 'verify-existing';
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email_verified: true,
          email_verification_code: null,
          email_verification_expires: null,
        },
      });
    }

    // Stage 5: Generate JWT + refresh token
    stage = 'jwt';
    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id });
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    const rawRefresh = generateRefreshToken();
    const rtHash = hashRefreshToken(rawRefresh);
    const rtExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token_hash: rtHash, user_id: sanitized.id, expires_at: rtExpiry } });

    // Include is_admin so AuthProvider knows admin status immediately
    const isOAuthAdmin = isAdminEmail(sanitized.email);
    return res.json({
      access_token,
      refresh_token: rawRefresh,
      user: { ...sanitized, is_admin: isOAuthAdmin, ...(isOAuthAdmin ? { role: 'admin' } : {}) },
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err: any) {
    console.error(`[auth/google] error at stage="${stage}"`, {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    captureException(err instanceof Error ? err : new Error(String(err?.message || err)), { stage, context: 'google-auth' });
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
}));

const appleAuthSchema = z.object({
  identity_token: z.string().min(1),
});

authRouter.post('/apple', oauthLimiter, asyncHandler(async (req, res) => {
  const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
  if (!APPLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Apple Sign-In is not configured' });
  }

  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { identity_token } = parsed.data;

  try {
    // In development/simulator, accept tokens starting with 'sim-' for testing
    const isDevelopmentToken = identity_token.startsWith('sim-');
    if (isDevelopmentToken && process.env.ALLOW_APPLE_SIM_TOKENS !== 'true') {
      return res.status(401).json({ error: 'Simulator tokens are not accepted in this environment' });
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

        const appleKey = await getApplePublicKey(kid);
        const jwtPayload = jwt.verify(identity_token, appleKey, {
          algorithms: ['RS256'],
          issuer: 'https://appleid.apple.com',
          audience: APPLE_CLIENT_ID,
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
          // Apple private relay emails (e.g. xyz@privaterelay.appleid.com) are random tokens,
          // not real names. Always fall back to 'Apple User' for those.
          // Don't set display_name from Apple email — user will set their username during onboarding
          user = await prisma.user.create({
            data: {
              email: userEmail,
              password_hash,
              apple_id: appleId,
              display_name: null,
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
    const access_token = signJwt({ id: sanitized.id });
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

    // Issue refresh token
    const appleRawRefresh = generateRefreshToken();
    const appleRtHash = hashRefreshToken(appleRawRefresh);
    const appleRtExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token_hash: appleRtHash, user_id: sanitized.id, expires_at: appleRtExpiry } });

    return res.json({
      access_token,
      refresh_token: appleRawRefresh,
      user: sanitized,
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err) {
    console.error('[auth/apple] unexpected error', err);
    return res.status(500).json({ error: 'Failed to authenticate with Apple' });
  }
}));

const passwordResetRequestSchema = z.object({ email: z.string().email() });

authRouter.post('/password/forgot', passwordResetLimiter as any, asyncHandler(async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const email = parsed.data.email.trim().toLowerCase();

  // SECURITY: Rate limiting to prevent password reset abuse / enumeration
  if (!(await checkAuthRateLimit(`forgot:${email}`))) {
    // Return generic success to prevent timing-based enumeration
    return res.json({ ok: true });
  }

  debugLog('[password-reset] Looking for user:', email);
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  const payload: any = { ok: true };
  if (!user) {
    debugLog('[password-reset] No user found for:', email);
    return res.json(payload);
  }
  debugLog('[password-reset] User found:', user.id, user.email);

  const code = String(crypto.randomInt(100000, 999999)); // 6-digit cryptographically secure code
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

  if (shouldExposeDevCodes) payload.dev_reset_code = code;
  return res.json(payload);
}));

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: passwordRequirement,
});

authRouter.post('/password/reset', asyncHandler(async (req, res) => {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, code, password } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();

  // SECURITY: Check dedicated failure-based lockout before anything else
  const attemptCheck = await checkResetAttempt(sanitizedEmail);
  if (!attemptCheck.allowed) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  // Also keep the general rate limit as a secondary guard
  if (!(await checkAuthRateLimit(`reset:${sanitizedEmail}`))) {
    return res.status(429).json({ error: 'Too many reset attempts. Please request a new code.' });
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: sanitizedEmail, mode: 'insensitive' } } });
  if (!user || !user.password_reset_code || !user.password_reset_expires) {
    await recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (new Date() > user.password_reset_expires) {
    await recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (String(code).trim() !== String(user.password_reset_code)) {
    await recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  // Success — clear failure tracking and reset the code
  await clearResetFailures(sanitizedEmail);

  const password_hash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        password_reset_code: null,
        password_reset_expires: null,
        password_changed_at: new Date(),
      },
    }),
    // Revoke all refresh tokens — stolen tokens can no longer mint new access tokens
    prisma.refreshToken.deleteMany({ where: { user_id: user.id } }),
  ]);

  // Security alert: password changed notification removed as part of email cleanup

  return res.json({ ok: true });
}));

const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordRequirement,
});

authRouter.post('/password/change', authLimiter, requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { current_password, new_password } = parsed.data;
  
  // Get user with password hash
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Verify current password
  if (!user.password_hash) return res.status(400).json({ error: 'No password set. Use OAuth login or set a password first.' });
  const isValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });
  
  // Hash new password
  const password_hash = await bcrypt.hash(new_password, 10);
  
  // Update password and revoke all refresh tokens atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password_hash, password_changed_at: new Date() },
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: user.id } }),
  ]);

  // Password changed notification removed as part of email cleanup

  return res.json({ ok: true });
}));

// Upgrade a fan account to coach
const upgradeToCoachSchema = z.object({
  plan: z.enum(['rookie', 'veteran', 'legend']),
});

// v1.0.2: 48hr cooldown for rejected coach/org applications.
const REJECTION_COOLDOWN_MS = 48 * 60 * 60 * 1000;

authRouter.post('/upgrade-to-coach', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  const parsed = upgradeToCoachSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { plan } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, preferences: true, approval_status: true, rejected_at: true, rejection_reason: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const currentPrefs = (user.preferences as any) || {};
  // If already a coach, reject
  if (currentPrefs.role === 'coach') {
    return res.status(400).json({ error: 'Account is already a coach account.' });
  }

  // v1.0.2: enforce 48hr cooldown on rejected applicants to prevent admin spam.
  if (user.approval_status === 'REJECTED' && user.rejected_at) {
    const elapsed = Date.now() - new Date(user.rejected_at).getTime();
    if (elapsed < REJECTION_COOLDOWN_MS) {
      const retryAfterMs = REJECTION_COOLDOWN_MS - elapsed;
      return res.status(429).json({
        error: 'Your previous coach application was declined. Please wait before trying again.',
        code: 'REJECTION_COOLDOWN',
        retry_after_ms: retryAfterMs,
        retry_after_hours: Math.ceil(retryAfterMs / (60 * 60 * 1000)),
        reason: user.rejection_reason || null,
      });
    }
  }

  // Server-side 18+ age gate — coaches must be adults
  const dob = currentPrefs.dob || currentPrefs.date_of_birth;
  if (dob) {
    const birthDate = parseDobLocal(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 18) {
      return res.status(403).json({ error: 'You must be at least 18 years old to become a coach.', code: 'AGE_REQUIREMENT' });
    }
  }

  // Update role to coach and set plan, reset onboarding so they complete coach steps
  // CRITICAL: Set approval_status to PENDING so the coach must go through the
  // approval flow (create/join org → admin approval) before accessing coach tools.
  const merged = {
    ...currentPrefs,
    role: 'coach',
    plan,
    onboarding_completed: false,
  };
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: merged,
      approval_status: 'PENDING',
      // v1.0.2: clear rejection tracking on fresh re-apply.
      rejected_at: null,
      rejection_reason: null,
    },
  });

  return res.json({ ok: true, preferences: updated.preferences });
}));

// v1.0.2: POST /auth/coach/reapply
// Rejected coaches can re-apply after 48hr cooldown. Resets approval_status to PENDING
// and clears rejection tracking. Does not touch role (already coach). Protected by REJECTION_COOLDOWN_MS.
authRouter.post('/coach/reapply', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, preferences: true, approval_status: true, rejected_at: true, rejection_reason: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const prefs = (user.preferences as any) || {};
  if (prefs.role !== 'coach') {
    return res.status(400).json({ error: 'Only coach accounts can re-apply. Upgrade to coach first.', code: 'NOT_COACH' });
  }
  if (user.approval_status !== 'REJECTED') {
    return res.status(400).json({ error: 'Your application is not in a rejected state.', code: 'NOT_REJECTED' });
  }
  if (user.rejected_at) {
    const elapsed = Date.now() - new Date(user.rejected_at).getTime();
    if (elapsed < REJECTION_COOLDOWN_MS) {
      const retryAfterMs = REJECTION_COOLDOWN_MS - elapsed;
      return res.status(429).json({
        error: 'Please wait before re-applying.',
        code: 'REJECTION_COOLDOWN',
        retry_after_ms: retryAfterMs,
        retry_after_hours: Math.ceil(retryAfterMs / (60 * 60 * 1000)),
        reason: user.rejection_reason || null,
      });
    }
  }
  // Reset to PENDING, clear rejection, force re-run of onboarding (org connect)
  const merged = { ...prefs, onboarding_completed: false, join_request_pending: false };
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: merged,
      approval_status: 'PENDING',
      rejected_at: null,
      rejection_reason: null,
    },
  });
  return res.json({ ok: true, preferences: updated.preferences });
}));

authRouter.get('/me', asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Cache-aside: check Redis first (TTL 60s)
  const cacheKey = `me:${req.user.id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
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
  const is_admin = isAdminEmail(user.email);
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false, follows_notifications: true, messages_notifications: true },
    is_parent: false,
    // Admin accounts go through normal onboarding like everyone else
  };
  // CRITICAL: Admin defaults must override DB values (second arg overrides first in mergePreferences)
  // This ensures admin accounts always have onboarding_completed=true regardless of DB state
  // Non-admin users' preferences are merged without forcing onboarding_completed
  const userPrefs = (user as any).preferences || {};
  const prefs = mergePreferences(userPrefs, defaults);
  const has_password = !!(user as any).password_hash;
  const safe = sanitizeUser(user);
  const payload = { ...safe, has_password, ...(is_admin ? { role: 'admin' } : {}), preferences: prefs, is_admin };
  void cacheSet(cacheKey, payload, 60); // 60s TTL
  return res.json(payload);
}));

const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).refine((val) => val.trim().length > 0, { message: 'Display name cannot be only whitespace' }).optional().nullable(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_.]+$/, { message: 'Username can only contain lowercase letters, numbers, dots, and underscores' }).optional().nullable(),
  avatar_url: z.string()
    .url({ message: 'Avatar URL must be a valid URL' })
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // Only allow https
        if (parsed.protocol !== 'https:') return false;
        // Allow specific domains (Cloudinary, etc.)
        const allowedDomains = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app', 'lh3.googleusercontent.com', 'platform-lookaside.fbsbx.com', 'graph.facebook.com'];
        return allowedDomains.some(d => parsed.hostname.endsWith(d));
      } catch (error) {
        console.warn('[auth] Invalid avatar URL format:', error);
        return false;
      }
    }, { message: 'Avatar URL must be from an allowed domain (Cloudinary or VarsityHub CDN)' })
    .optional()
    .nullable(),
  bio: z.string().max(300).transform((val) => val === '' ? null : val).optional().nullable(),
});

authRouter.put('/me', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(body, 'preferences')) {
    return res.status(400).json({
      error: 'Invalid payload',
      message: 'Use PATCH /me/preferences to update preferences.',
    });
  }
  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data as any;
  let patch: any = { ...data };

  // Strip null values for fields that should not be cleared (treat null as "don't change")
  // bio and avatar_url CAN be null (user wants to clear them), but display_name/username should not be wiped
  if (patch.display_name === null) delete patch.display_name;
  if (patch.username === null) delete patch.username;

  // Validate username availability if provided
  if (data.username) {
    const exists = await prisma.user.findFirst({
      where: {
        username: { equals: data.username, mode: 'insensitive' },
        NOT: { id: req.user!.id }
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
  const { preferences, ...rest } = patch;
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { ...rest, ...(preferences ? { preferences } : {}) } });
  void cacheDel(`me:${req.user!.id}`); // Invalidate profile cache
  return res.json(sanitizeUser(user));
}));

// PATCH /me (alias) to support partial profile updates (preferences use /me/preferences)
authRouter.patch('/me', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(body, 'preferences')) {
    return res.status(400).json({
      error: 'Invalid payload',
      message: 'Use PATCH /me/preferences to update preferences.',
    });
  }
  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data as any;
  let patch: any = { ...data };

  // Strip null values for fields that should not be cleared (treat null as "don't change")
  if (patch.display_name === null) delete patch.display_name;
  if (patch.username === null) delete patch.username;

  // Validate username availability if provided
  if (data.username) {
    const exists = await prisma.user.findFirst({
      where: {
        username: { equals: data.username, mode: 'insensitive' },
        NOT: { id: req.user!.id }
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
  const { preferences: prefs2, ...rest } = patch;
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { ...rest, ...(prefs2 ? { preferences: prefs2 } : {}) } });
  void cacheDel(`me:${req.user!.id}`); // Invalidate profile cache
  return res.json(sanitizeUser(user));
}));

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

// Keys that a client must NEVER set via preferences — these are server-controlled.
// approval_status lives on the User model, not in preferences, but we strip it
// from incoming prefs as defense-in-depth in case it leaks into the JSON blob.
const PROTECTED_PREF_KEYS = new Set([
  'approval_status',
  'is_admin',
  'paid_by_owner',
  'payment_approved',
]);

function stripProtectedKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...obj };
  for (const key of PROTECTED_PREF_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
}

// Partial update for user preferences
authRouter.patch('/me/preferences', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
    affiliation: z.enum(['none', 'other', 'school', 'independent', 'university', 'high_school', 'club', 'youth', 'professional']).optional(),
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
    dm_policy: z.enum(['everyone', 'following', 'no_one']).optional(),
    proceeding_as_fan: z.boolean().optional(),
    coach_agreement_accepted_at: z.string().optional(),

    // Profile fields from edit-profile screen
    location: z.string().max(200).optional().nullable(),
    header_image_url: z.string().url().optional().nullable(),
    header_image_focus_y: z.number().min(-1).max(1).optional().nullable(),
    theme_color: z.string().max(20).optional().nullable(),
    position: z.string().max(100).optional().nullable(),
    jersey_number: z.string().max(10).optional().nullable(),
    grade_level: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior']).optional().nullable(),
    graduation_year: z.number().int().min(2020).max(2040).optional().nullable(),
    accolades: z.array(z.string()).optional().nullable(),
    primary_sport: z.string().max(50).optional().nullable(),
  }).partial();

  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // SECURITY: Strip any protected keys the client tries to sneak in
  const incoming = stripProtectedKeys(parsed.data as any) as any;

  // COPPA: Reject if DOB indicates under 13 - do not store
  if (incoming.dob !== undefined && isUnder13(incoming.dob)) {
    return res.status(403).json({
      error: 'COPPA_UNDER_13',
      message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
    });
  }
  const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true, email: true, approval_status: true } });
  const currentPrefs = current?.preferences as any || {};

  // SECURITY: Prevent role changes after onboarding is completed.
  // The only legitimate path to change role post-onboarding is POST /auth/upgrade-to-coach.
  if (incoming.role && currentPrefs.onboarding_completed === true && incoming.role !== currentPrefs.role) {
    return res.status(403).json({
      error: 'Cannot change role after onboarding is complete. Use the upgrade-to-coach endpoint.',
    });
  }

  // Server-side 18+ age gate for coaches (mirrors /upgrade-to-coach and /complete-onboarding)
  if (incoming.role === 'coach' && currentPrefs.role !== 'coach') {
    const effectiveDob = incoming.dob || currentPrefs.dob || currentPrefs.date_of_birth;
    if (effectiveDob) {
      const birthDate = parseDobLocal(effectiveDob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 18) {
        return res.status(403).json({ error: 'You must be at least 18 years old to become a coach.', code: 'AGE_REQUIREMENT' });
      }
    }
  }

  // SECURITY: If role is being set to 'coach' and user was not previously a coach,
  // force approval_status to PENDING atomically. This ensures requireOnboarded
  // blocks all coach tools until an admin or org owner explicitly approves.
  // We do this in the same update below to avoid race conditions.
  const forceApprovalPending = incoming.role === 'coach' && currentPrefs.role !== 'coach';

  // Check if user is admin (same logic as GET /me endpoint)
  const is_admin = isAdminEmail(current?.email);
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false, follows_notifications: true, messages_notifications: true },
    is_parent: false,
    plan: null,
    role: 'fan',
    sports_interests: [],
    personalization_goals: [],
    primary_intents: [],
    location_enabled: false,
    notifications_enabled: true,
    messaging_policy_accepted: false,
  };

  const merged = stripProtectedKeys(
    mergePreferences(mergePreferences(defaults, current?.preferences || {}), incoming)
  ) as any;

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      preferences: merged,
      ...(forceApprovalPending ? { approval_status: 'PENDING' } : {}),
    },
  });

  // Invalidate profile cache so GET /me returns fresh data immediately
  void cacheDel(`me:${req.user!.id}`);

  // Invalidate the private-IDs feed cache when a user toggles profile_private
  if (incoming.profile_private !== undefined) {
    invalidatePrivateIdsCache();
  }

  return res.json({ preferences: updated.preferences });
}));

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  // Core identity fields
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_.]+$/, 'Username must contain only lowercase letters, numbers, dots, and underscores').optional(),
  display_name: z.string().min(1).max(120).refine((val) => val.trim().length > 0, { message: 'Display name cannot be only whitespace' }).optional(),
  affiliation: z.enum(['none', 'other', 'university', 'high_school', 'club', 'youth', 'school', 'independent', 'professional']).optional(),
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
  join_request_pending: z.boolean().optional(),
  sport: z.string().optional(),
  
  // Season
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  
  // Authorized users
  authorized: z.array(z.any()).optional(),
  authorized_users: z.array(z.any()).optional(),
  
  // Profile
  avatar_url: z.string().url().refine((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const allowedDomains = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app', 'lh3.googleusercontent.com', 'platform-lookaside.fbsbx.com', 'graph.facebook.com'];
      return allowedDomains.some(d => parsed.hostname.endsWith(d));
    } catch { return false; }
  }, { message: 'Avatar must be an HTTPS URL from an allowed domain' }).optional(),
  bio: z.string().max(300).optional(),
  sports_interests: z.array(z.string()).optional(),
  
  // Interests/Goals
  primary_intents: z.array(z.string()).optional(),
  personalization_goals: z.array(z.string()).optional(),
  
  // Features/Permissions
  location_enabled: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  messaging_policy_accepted: z.boolean().optional(),

  // Coach proceeding as fan while awaiting approval
  proceeding_as_fan: z.boolean().optional(),
});

authRouter.post('/me/complete-onboarding', authLimiter, requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = completeOnboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Onboarding] Validation failed:', parsed.error);
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) });
  }
  
  const data = parsed.data;

  // COPPA: Reject if DOB indicates under 13 - do not store
  if (data.dob !== undefined && isUnder13(data.dob)) {
    return res.status(403).json({
      error: 'COPPA_UNDER_13',
      message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
    });
  }
  
  // Get current preferences FIRST to preserve role if not in payload
  const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true } });
  const currentPrefs = current?.preferences as any || {};
  
  // CRITICAL: Role MUST be preserved from onboarding step-1 or provided in payload
  // If role is undefined in payload, use existing role from preferences (set during step-1)
  const finalRole = data.role !== undefined ? data.role : (currentPrefs.role || 'fan');
  
  // Server-side 18+ age gate for coaches (mirrors /upgrade-to-coach validation)
  if (finalRole === 'coach') {
    const effectiveDob = data.dob || currentPrefs.dob || currentPrefs.date_of_birth;
    if (effectiveDob) {
      const birthDate = parseDobLocal(effectiveDob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 18) {
        return res.status(403).json({ error: 'You must be at least 18 years old to become a coach.', code: 'AGE_REQUIREMENT' });
      }
    }
  }

  // CRITICAL: For coaches, validate required steps are completed
  // Fall back to existing DB values for retry scenarios where payload may be incomplete
  const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (finalRole === 'coach') {
    const effectiveUsername = data.username || currentUser?.username;
    const effectivePlan = data.plan || currentPrefs.plan || 'rookie';
    const effectiveOrgId = data.organization_id || currentPrefs.organization_id;
    const effectiveTeamId = data.team_id || currentPrefs.team_id;
    if (!effectiveUsername) {
      return res.status(400).json({ error: 'Username required for coach onboarding' });
    }
    if (!effectivePlan) {
      return res.status(400).json({ error: 'Plan selection required for coach onboarding' });
    }
    if (!effectiveTeamId && !effectiveOrgId) {
      return res.status(400).json({ error: 'Team or organization required for coach onboarding' });
    }
    // Use DB values as fallback if not in payload
    if (!data.username && effectiveUsername) data.username = effectiveUsername;
    if (!data.plan && effectivePlan) (data as any).plan = effectivePlan;
    if (!data.organization_id && effectiveOrgId) data.organization_id = effectiveOrgId;
    if (!data.team_id && effectiveTeamId) data.team_id = effectiveTeamId;
  }

  // Update user with direct fields
  const updateData: any = {};
  if (data.username) updateData.username = data.username;
  if (data.display_name) updateData.display_name = data.display_name;
  if (data.avatar_url) updateData.avatar_url = data.avatar_url;
  if (data.bio) updateData.bio = data.bio;
  // Do not auto-set default bio — if user leaves bio blank, keep it blank
  
  // Prepare preferences update
  
  const preferencesUpdate: any = {
    onboarding_completed: true,
    role: finalRole, // Always set role explicitly - never leave undefined
    plan: 'rookie', // Always rookie at onboarding — paid plans set by Stripe webhook only
    affiliation: data.affiliation,
    dob: data.dob,
    zip_code: data.zip_code || data.zip,
    team_id: data.team_id,
    team_name: data.team_name,
    organization_id: data.organization_id,
    organization_name: data.organization_name,
    join_request_pending: data.join_request_pending,
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
    proceeding_as_fan: data.proceeding_as_fan,
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
  const merged = stripProtectedKeys(mergePreferences(normalizedCurrent || {}, preferencesUpdate)) as any;
  updateData.preferences = merged;
  
  // SECURITY: If completing onboarding as coach, ensure approval_status is PENDING
  // This prevents a fan from completing onboarding with role='coach' and retaining APPROVED status
  if (finalRole === 'coach' && currentPrefs.role !== 'coach') {
    updateData.approval_status = 'PENDING';
  }

  // Update user
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: updateData
  });

  // Fire-and-forget: notify admins about new coach application
  if (finalRole === 'coach' && updateData.approval_status === 'PENDING') {
    const adminEmail = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim();
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `New coach application: ${updated.display_name || updated.email}`,
        text: `A new coach application has been submitted.\n\nName: ${updated.display_name || 'N/A'}\nEmail: ${updated.email}\n\nPlease review in the admin dashboard.`,
      }).catch(() => {});
    }
  }

  return res.json({
    message: 'Onboarding completed successfully',
    user: sanitizeUser(updated)
  });
}));

// Request a new email verification code (authenticated)
authRouter.post('/verify/request', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  // Redis-backed verification rate limiting: 1 per 30s, 5 per hour
  const verifyLastKey = `verify:last:${user.id}`;
  const verifyHourKey = `verify:hour:${user.id}`;
  const lastSent = await rlGet(verifyLastKey);
  if (lastSent && Date.now() - parseInt(lastSent, 10) < 30_000) {
    return res.status(429).json({ error: 'Please wait before requesting another code' });
  }
  const hourCount = await rlIncr(verifyHourKey, 3600_000); // 1 hour TTL
  if (hourCount > 5) return res.status(429).json({ error: 'Too many requests' });
  const code = String(crypto.randomInt(100000, 999999));
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [verify/request] Code generated: ${code} for user ${user.id} (${user.email})`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { email_verification_code: code, email_verification_expires: exp } });
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [verify/request] Code stored in DB (expires ${exp.toISOString()})`);
  try {
    if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [verify/request] Calling sendVerificationEmail → to: ${user.email}`);
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
  if (shouldExposeDevCodes) payload.dev_verification_code = code;
  await rlSet(verifyLastKey, String(Date.now()), 30_000);
  return res.json(payload);
}));

// Alias: /auth/verify/send
authRouter.post('/verify/send', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  (authRouter as any).handle({ ...req, url: '/verify/request' }, res);
}));

// Verify code (authenticated)
authRouter.post('/verify/confirm', verificationConfirmLimiter, requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  const schema = z.object({ code: z.string().min(4).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  if (!user.email_verification_code || !user.email_verification_expires) return res.status(400).json({ error: 'No verification in progress' });
  if (new Date() > user.email_verification_expires) return res.status(400).json({ error: 'Code expired' });
  if (String(code) !== String(user.email_verification_code)) return res.status(400).json({ error: 'Invalid code' });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { email_verified: true, email_verification_code: null, email_verification_expires: null } });
  return res.json({ ok: true, user: sanitizeUser(updated) });
}));

function sanitizeUser(u: any) {
  const {
    password_hash,
    email_verification_code,
    email_verification_expires,
    password_reset_code,
    password_reset_expires,
    ban_reason,
    ...rest
  } = u as any;
  return rest;
}

// Test email endpoint (development only)
authRouter.post('/test-email', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
}));

export default authRouter;
