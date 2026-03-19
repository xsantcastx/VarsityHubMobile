import bcrypt from 'bcrypt';
import crypto, { createPublicKey, type KeyObject } from 'crypto';
import { Router, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { sendPasswordChangedEmail, sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from '../lib/email.js';
import { validateContent } from '../lib/contentFilter.js';
import { ConflictError } from '../lib/errors/ConflictError.js';
import { ValidationError } from '../lib/errors/ValidationError.js';
import { signJwt, generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_EXPIRY_DAYS } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { authLimiter, passwordResetLimiter, refreshTokenLimiter, verificationLimiter } from '../middleware/rateLimiters.js';
import { rlGet, rlSet, rlDel, rlIncr } from '../lib/redisRateLimit.js';

export const authRouter = Router();

// Rate limit constants
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RESET_FAILURES = 5;
const RESET_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const RESET_FAILURE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_TOTAL_RESET_ATTEMPTS = 15; // Hard cap: 15 total failures per 24h window — locks out for remainder

async function checkResetAttempt(email: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const raw = await rlGet(`resetfail:${email}`);
  if (!raw) return { allowed: true };

  const record = JSON.parse(raw) as { attempts: number; lockedUntil: number; totalAttempts?: number };

  // Hard cap: 15 total failures in 24h window — no more attempts
  if ((record.totalAttempts || record.attempts) >= MAX_TOTAL_RESET_ATTEMPTS) {
    return { allowed: false, retryAfterMs: RESET_FAILURE_TTL_MS };
  }

  // Lock expired — allow but keep cumulative count (don't clear record)
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    record.lockedUntil = 0;
    record.attempts = 0; // Reset per-lockout counter, keep totalAttempts
    await rlSet(`resetfail:${email}`, JSON.stringify(record), RESET_FAILURE_TTL_MS);
    return { allowed: true };
  }

  // Currently locked out
  if (record.attempts >= MAX_RESET_FAILURES) {
    return { allowed: false, retryAfterMs: record.lockedUntil - Date.now() };
  }

  return { allowed: true };
}

async function recordResetFailure(email: string): Promise<void> {
  const now = Date.now();
  const raw = await rlGet(`resetfail:${email}`);
  let record = raw
    ? JSON.parse(raw) as { attempts: number; lockedUntil: number; totalAttempts?: number }
    : { attempts: 0, lockedUntil: 0, totalAttempts: 0 };

  record.attempts++;
  record.totalAttempts = (record.totalAttempts || 0) + 1;
  if (record.attempts >= MAX_RESET_FAILURES) {
    record.lockedUntil = now + RESET_LOCKOUT_MS;
  }

  await rlSet(`resetfail:${email}`, JSON.stringify(record), RESET_FAILURE_TTL_MS);
}

async function clearResetFailures(email: string): Promise<void> {
  await rlDel(`resetfail:${email}`);
}
const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

async function checkAuthRateLimit(identifier: string): Promise<boolean> {
  const count = await rlIncr(`auth:${identifier}`, AUTH_WINDOW_MS);
  return count <= MAX_AUTH_ATTEMPTS;
}

/** Create a refresh token and store hashed in the RefreshToken table. Returns the raw token to send to the client. */
async function issueRefreshToken(userId: string, deviceInfo?: string | null) {
  const refresh_token = generateRefreshToken();
  const expires_at = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      token_hash: hashRefreshToken(refresh_token),
      user_id: userId,
      device_info: deviceInfo || null,
      expires_at,
    },
  });
  return { refresh_token, expires_at };
}

// Verification send rate limiting: 1/30s, 5/hour per user (Redis-backed with in-memory fallback)
const GOOGLE_ALLOWED_AUDIENCES = (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_AUDIENCE || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const googleOauthClient = new OAuth2Client();
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

/** Returns true if DOB indicates user is under 18. */
function isUnder18(dob: string | null | undefined): boolean {
  if (!dob || typeof dob !== 'string') return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 18;
}

// ---- Logout — invalidate refresh token server-side ----
authRouter.post('/logout', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (req.user?.id && refreshToken && typeof refreshToken === 'string') {
      // Delete the specific refresh token for this device
      const tokenHash = hashRefreshToken(refreshToken);
      await prisma.refreshToken.deleteMany({
        where: { token_hash: tokenHash, user_id: req.user.id },
      });
    } else if (req.user?.id) {
      // Fallback: if no token provided, delete all tokens for user (full logout)
      await prisma.refreshToken.deleteMany({
        where: { user_id: req.user.id },
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    // Best-effort — even if DB fails, client should still clear local tokens
    return res.json({ ok: true });
  }
});

// ---- Token Refresh (no auth middleware — refresh tokens are self-authenticating) ----
authRouter.post('/refresh', refreshTokenLimiter, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken required' });
  }

  const hashedToken = hashRefreshToken(refreshToken);
  const existingToken = await prisma.refreshToken.findUnique({
    where: { token_hash: hashedToken },
    include: { user: true },
  });
  if (!existingToken || existingToken.expires_at <= new Date()) {
    // Clean up expired token if it exists
    if (existingToken) {
      await prisma.refreshToken.delete({ where: { id: existingToken.id } }).catch(() => {});
    }
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = existingToken.user;

  // Block banned or suspended users from refreshing tokens
  if (user.banned) {
    return res.status(403).json({ error: 'Account banned', ban_reason: (user as any).ban_reason || undefined });
  }
  if ((user as any).banned_until && new Date((user as any).banned_until) > new Date()) {
    return res.status(403).json({ error: 'Account temporarily suspended', banned_until: (user as any).banned_until, ban_reason: (user as any).ban_reason || undefined });
  }

  // Belt-and-suspenders: reject tokens issued before password change
  if (user.password_changed_at && existingToken.created_at < user.password_changed_at) {
    await prisma.refreshToken.delete({ where: { id: existingToken.id } }).catch(() => {});
    return res.status(401).json({ error: 'Token invalidated by password change' });
  }

  // Rotate: delete old token, issue new one (preserving device_info)
  const deviceInfo = existingToken.device_info;
  await prisma.refreshToken.delete({ where: { id: existingToken.id } });
  const { refresh_token: newRefreshToken } = await issueRefreshToken(user.id, deviceInfo);
  const access_token = signJwt({ id: user.id });

  return res.json({ access_token, refresh_token: newRefreshToken });
}));

// Password strength: min 8 chars, at least one letter and one digit
const passwordStrength = (s: string) => /[a-zA-Z]/.test(s) && /\d/.test(s);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').refine(passwordStrength, 'Password must contain at least one letter and one number');

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: passwordSchema,
  display_name: z.string().optional(),
  // Rookie is a coach plan, not a role
  role: z.enum(['fan', 'coach']).optional(),
  dob: z.string().optional(), // COPPA: reject if under 13
  // Honeypot + timing fields for bot detection (optional — ignored if missing)
  website: z.string().optional(), // Honeypot: bots fill this, real users don't
  _t: z.number().optional(),      // Timestamp when form was loaded (detect instant submissions)
});

authRouter.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const start = Date.now();
  debugLog('[register] Incoming request');

  // Bot detection: honeypot field — if filled, silently reject
  if (req.body?.website && typeof req.body.website === 'string' && req.body.website.trim().length > 0) {
    debugLog('[register] Honeypot triggered');
    // Return a generic success-like response without auth tokens.
    return res.status(201).json({ ok: true });
  }

  // Bot detection: timing — if form submitted in under 2 seconds, likely a bot
  if (req.body?._t && typeof req.body._t === 'number') {
    const elapsed = Date.now() - req.body._t;
    if (elapsed < 2000) {
      debugLog('[register] Form submitted too fast:', elapsed, 'ms');
      return res.status(201).json({ ok: true });
    }
  }

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
  const password_hash = await bcrypt.hash(password, 12);
  const code = String(crypto.randomInt(100000, 999999)); // 6-digit numeric code
  debugLog(`[verify-code] [register] Verification code generated for ${sanitizedEmail}`);
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [register] Code generated: ${code} for ${sanitizedEmail}`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const userRole = role || 'fan';

  // Set admin flag based on ADMIN_EMAILS env var
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS.includes(sanitizedEmail);
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
  debugLog(`[verify-code] [register] Verification code stored for user ${user.id} (expires ${exp.toISOString()})`);
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [register] Code stored in DB for user ${user.id} (expires ${exp.toISOString()})`);
  const access_token = signJwt({ id: user.id });
  const { refresh_token } = await issueRefreshToken(user.id, req.get('user-agent'));
  try {
    debugLog(`[verify-code] [register] Sending verification email to ${email}`);
    if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [register] Calling sendVerificationEmail → to: ${email}`);
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
      debugLog('[verify-code] [register] sendVerificationEmail returned true — email accepted by SendGrid');
    }
  } catch (e) {
    console.error('[verify-code] [register] sendVerificationEmail threw:', e);
    req.log?.warn?.({ err: e }, 'Email send failed; returning code in dev');
  }
  try {
    await sendWelcomeEmail(sanitizedEmail, display_name || sanitizedEmail.split('@')[0]);
  } catch (e) {
    console.error('[register] sendWelcomeEmail failed:', e);
  }
  const payload: any = { access_token, refresh_token, user: sanitizeUser(user), needs_verification: true };
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_CODES === '1') payload.dev_verification_code = code;
  debugLog('[register] Completed in', Date.now() - start, 'ms');
  res.status(201).json(payload);
}));

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', authLimiter, asyncHandler(async (req, res) => {
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
  // Check permanent ban
  if (user.banned) {
    return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason || 'Your account has been banned for violating community guidelines.' });
  }
  // Check temporary suspension
  if (user.banned_until && new Date(user.banned_until) > new Date()) {
    return res.status(403).json({ error: 'Account temporarily suspended', banned_until: user.banned_until, ban_reason: user.ban_reason || 'Your account has been temporarily suspended.' });
  }
  // Auto-lift expired suspensions
  if (user.banned_until && new Date(user.banned_until) <= new Date()) {
    await prisma.user.update({ where: { id: user.id }, data: { banned_until: null, ban_reason: null } });
  }
  // OAuth-only users have no password — they must sign in with their provider
  if (!user.password_hash) {
    const provider = user.google_id ? 'Google' : user.apple_id ? 'Apple' : 'your social account';
    return res.status(401).json({ error: `This account uses ${provider} sign-in. Please sign in with ${provider} instead.` });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const access_token = signJwt({ id: user.id });
  const { refresh_token } = await issueRefreshToken(user.id, req.get('user-agent'));

  // Track device fingerprint (non-blocking)
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || 'unknown';
  const deviceInfo = { ua: userAgent.substring(0, 200), ip, ts: new Date().toISOString() };
  prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: {
        ...(typeof user.preferences === 'object' && user.preferences !== null ? user.preferences as Record<string, unknown> : {}),
        last_login_device: deviceInfo,
      },
    },
  }).catch((err) => { console.warn('[auth] Failed to update device info:', err?.message); }); // fire-and-forget

  const sanitized = sanitizeUser(user);
  const needsOnboarding = sanitized?.preferences?.onboarding_completed !== true;
  const body: any = { access_token, refresh_token, user: sanitized, needs_onboarding: needsOnboarding };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
}));

const googleAuthSchema = z.object({
  id_token: z.string().min(10),
});

authRouter.post('/google', authLimiter, async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { id_token } = parsed.data;

  try {
    if (!GOOGLE_ALLOWED_AUDIENCES.length) {
      req.log?.error?.('[auth/google] missing GOOGLE_OAUTH_CLIENT_IDS / GOOGLE_OAUTH_AUDIENCE');
      return res.status(503).json({ error: 'Google authentication is not configured' });
    }
    const ticket = await googleOauthClient.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_ALLOWED_AUDIENCES,
    });
    const payload = ticket.getPayload() as any;
    const googleId = typeof payload?.sub === 'string' ? payload.sub : null;
    const audience = typeof payload?.aud === 'string' ? payload.aud : null;
    const email = typeof payload?.email === 'string' ? String(payload.email).toLowerCase() : null;
    const issuer = typeof payload?.iss === 'string' ? payload.iss : '';
    const emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Invalid Google credential' });
    }
    if (issuer !== 'https://accounts.google.com' && issuer !== 'accounts.google.com') {
      return res.status(400).json({ error: 'Invalid Google token issuer' });
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
        user = await prisma.user.create({
          data: {
            email,
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

    // Block banned/suspended users from Google auth
    if (user.banned) {
      return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason || 'Your account has been banned for violating community guidelines.' });
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return res.status(403).json({ error: 'Account temporarily suspended', banned_until: user.banned_until, ban_reason: user.ban_reason || 'Your account has been temporarily suspended.' });
    }

    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id });
    const { refresh_token } = await issueRefreshToken(sanitized.id, req.get('user-agent'));
    const needsOnboarding = sanitized?.preferences?.onboarding_completed !== true;

    return res.json({
      access_token,
      refresh_token,
      user: sanitized,
      needs_onboarding: needsOnboarding,
      created,
    });
  } catch (err: any) {
    console.error('[auth/google] unexpected error', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      name: err?.name,
      stack: err?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

const appleAuthSchema = z.object({
  identity_token: z.string().min(1),
});

authRouter.post('/apple', authLimiter, async (req, res) => {
  const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || process.env.APPLE_BUNDLE_ID || 'com.varsithub.varsityhub-ios';
  if (!APPLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Apple Sign-In is not configured' });
  }

  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { identity_token } = parsed.data;

  try {
    const allowSimulatorTokens = process.env.ALLOW_APPLE_SIM_TOKENS === '1';
    // In development/simulator, accept tokens starting with 'sim-' for testing
    const isDevelopmentToken = identity_token.startsWith('sim-');
    if (isDevelopmentToken && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: 'Development tokens are not allowed in production' });
    }
    if (isDevelopmentToken && !allowSimulatorTokens) {
      return res.status(400).json({ error: 'Simulator Apple tokens are disabled on this server' });
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
          clockTolerance: 30, // 30 seconds tolerance for clock skew
        }) as JwtPayload;

        appleId = jwtPayload.sub as string;
        email = (jwtPayload.email as string) || null;

        if (!appleId) {
          return res.status(400).json({ error: 'Missing user identifier in token' });
        }
        debugLog('[auth/apple] Apple token verified');
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error('[auth/apple] Token verification failed:', msg);
        // Return specific error so we can debug
        if (msg.includes('expired')) {
          return res.status(400).json({ error: 'Apple token expired. Please try again.' });
        }
        if (msg.includes('audience')) {
          return res.status(400).json({ error: `Apple token audience mismatch. Expected: ${APPLE_CLIENT_ID}` });
        }
        if (msg.includes('issuer')) {
          return res.status(400).json({ error: 'Apple token issuer invalid.' });
        }
        if (msg.includes('JWKS')) {
          return res.status(400).json({ error: 'Unable to fetch Apple signing keys. Please try again.' });
        }
        return res.status(400).json({ error: 'Failed to verify Apple token', detail: msg });
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
        const userEmail = email || `apple_${appleId.substring(0, 16)}@appleid.local`;

        try {
          const displayName = email ? email.split('@')[0] : 'Apple User';
          user = await prisma.user.create({
            data: {
              email: userEmail,
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

    // Block banned/suspended users from Apple auth
    if (user.banned) {
      return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason || 'Your account has been banned for violating community guidelines.' });
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return res.status(403).json({ error: 'Account temporarily suspended', banned_until: user.banned_until, ban_reason: user.ban_reason || 'Your account has been temporarily suspended.' });
    }

    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id });
    const { refresh_token } = await issueRefreshToken(sanitized.id, req.get('user-agent'));
    const needsOnboarding = sanitized?.preferences?.onboarding_completed !== true;

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

authRouter.post('/password/forgot', passwordResetLimiter, asyncHandler(async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const email = parsed.data.email.trim().toLowerCase();

  // SECURITY: Rate limiting to prevent password reset abuse / enumeration
  if (!(await checkAuthRateLimit(`forgot:${email}`))) {
    // Return generic success to prevent timing-based enumeration
    return res.json({ ok: true });
  }

  debugLog('[password-reset] Looking for user by email');
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  const payload: any = { ok: true };
  if (!user) {
    debugLog('[password-reset] No user found');
    return res.json(payload);
  }
  debugLog('[password-reset] User found:', user.id);

  const code = String(crypto.randomInt(100000, 999999)); // 6-digit numeric code
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_reset_code: code,
      password_reset_expires: expires,
    },
  });

  try {
    debugLog('[email] Sending password reset email for user:', user.id);
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

  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_CODES === '1') payload.dev_reset_code = code;
  return res.json(payload);
}));

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
  password: passwordSchema,
});

authRouter.post('/password/reset', passwordResetLimiter, asyncHandler(async (req, res) => {
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
  const codeA = Buffer.from(String(code).trim());
  const codeB = Buffer.from(String(user.password_reset_code));
  if (codeA.length !== codeB.length || !crypto.timingSafeEqual(codeA, codeB)) {
    await recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  // Success — clear failure tracking and reset the code
  await clearResetFailures(sanitizedEmail);

  const password_hash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      password_reset_code: null,
      password_reset_expires: null,
      password_changed_at: new Date(),
    },
  });

  return res.json({ ok: true });
}));

const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});

authRouter.post('/password/change', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { current_password, new_password } = parsed.data;
  
  // Get user with password hash
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // OAuth-only users have no password yet — they should use "Forgot Password" to set one
  if (!user.password_hash) {
    return res.status(400).json({
      error: 'No password set',
      message: 'Your account was created with Google or Apple sign-in and has no password. Use "Forgot Password" to set one.',
    });
  }

  // Verify current password
  const isValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });
  
  // Hash new password
  const password_hash = await bcrypt.hash(new_password, 12);
  
  // Update password and invalidate all existing sessions
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        password_changed_at: new Date(),
      },
    }),
    // Delete ALL refresh tokens for this user (force re-login on every device)
    prisma.refreshToken.deleteMany({
      where: { user_id: user.id },
    }),
  ]);
  
  // Send confirmation email
  try {
    const userName = user.display_name || user.email?.split('@')[0] || 'VarsityHub user';
    await sendPasswordChangedEmail(user.email, userName);
  } catch (e) {
    console.warn('[email] Password changed email failed:', e);
    // Don't fail the request if email fails
  }
  
  return res.json({ ok: true });
}));

authRouter.get('/me', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      display_name: true,
      username: true,
      avatar_url: true,
      bio: true,
      created_at: true,
      email_verified: true,
      banned: true,
      ban_reason: true,
      banned_until: true,
      preferences: true,
      approval_status: true,
      subscription_tier: true,
      subscription_status: true,
      subscription_expires_at: true,
      max_teams: true,
      paid_by_owner: true,
      // Needed for auth_provider detection (not exposed by sanitizeUser)
      apple_id: true,
      google_id: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  // Derive has_password without loading the hash into memory
  const has_password = !!(await prisma.user.findUnique({ where: { id: req.user.id }, select: { password_hash: true } }))?.password_hash;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const is_admin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false, follows_notifications: true, messages_notifications: true },
    is_parent: false,
    zip_code: null,
    onboarding_completed: false,
  };
  // Defaults fill in missing keys; user preferences override defaults
  const userPrefs = (user as any).preferences || {};
  const prefs = mergePreferences(defaults, userPrefs);
  // Admins always skip onboarding (override DB value)
  if (is_admin) prefs.onboarding_completed = true;
  const sanitized = sanitizeUser(user);
  // auth_provider: so app can show correct "Signed in with Apple/Google" and handle linked accounts (one person, multiple logins)
  const hasApple = !!user.apple_id;
  const hasGoogle = !!user.google_id;
  const auth_provider = hasApple && hasGoogle ? 'apple,google' : hasApple ? 'apple' : hasGoogle ? 'google' : null;
  return res.json({ ...sanitized, ...(is_admin ? { role: 'admin' } : {}), preferences: prefs, is_admin, auth_provider, has_password });
}));

// Lightweight subscription status (no Stripe calls)
authRouter.get('/me/subscription', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { subscription_tier: true, subscription_status: true, subscription_expires_at: true, preferences: true },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });

  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  // Prefer onboarding-facing tier from preferences, fall back to DB column
  const tierMap: Record<string, string> = { free: 'rookie', premium: 'veteran', pro: 'legend' };
  // Rule A: If payment_pending, treat as rookie regardless of stored plan
  const tier = prefs.payment_pending === true ? 'rookie' : (prefs.plan || tierMap[user.subscription_tier] || 'rookie');
  const status = user.subscription_status || null;
  const expiresAt = user.subscription_expires_at ? user.subscription_expires_at.toISOString() : null;
  const hasActiveSubscription = (tier === 'veteran' || tier === 'legend') && status === 'active';
  const pendingPlan = prefs.pending_plan || null;
  const paymentApproved = prefs.payment_approved === true;

  return res.json({ tier, status, expiresAt, hasActiveSubscription, pendingPlan, paymentApproved });
}));

const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).refine((val) => val.trim().length > 0, { message: 'Display name cannot be only whitespace' }).optional(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_.]+$/, { message: 'Username can only contain lowercase letters, numbers, dots, and underscores' }).optional(),
  avatar_url: z.string()
    .url({ message: 'Avatar URL must be a valid URL' })
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // Only allow https
        if (parsed.protocol !== 'https:') return false;
        // Allow specific domains (Cloudinary, Google/Apple OAuth avatars, etc.)
        const allowedDomains = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app', 'lh3.googleusercontent.com', 'googleusercontent.com'];
        return allowedDomains.some(d => parsed.hostname.endsWith(d));
      } catch (error) {
        console.warn('[auth] Invalid avatar URL format:', error);
        return false;
      }
    }, { message: 'Avatar URL must be from an allowed domain (Cloudinary or VarsityHub CDN)' })
    .optional()
    .nullable(),
  bio: z.string().max(300).transform((val) => val === '' ? null : val).optional().nullable(),
  preferences: z.record(z.any()).optional(),
});

const RESTRICTED_PROFILE_PREF_KEYS = new Set([
  'role',
  'plan',
  'pending_plan',
  'payment_pending',
  'payment_approved',
  'onboarding_completed',
  'join_request_pending',
  'subscription_id',
  'subscription_status',
  'subscription_end_date',
  'plan_expiry_date',
  'google_purchase_token',
  'google_product_id',
  'apple_transaction_id',
  'apple_original_transaction_id',
  'apple_product_id',
]);

function collectRestrictedPreferenceKeys(input: any, path = 'preferences'): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  const found: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const nextPath = `${path}.${key}`;
    if (RESTRICTED_PROFILE_PREF_KEYS.has(key)) {
      found.push(nextPath);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      found.push(...collectRestrictedPreferenceKeys(value, nextPath));
    }
  }
  return found;
}

// Shared handler for PUT/PATCH /me — consolidates logic to avoid drift (H1)
async function handleUpdateMe(req: AuthedRequest, res: Response) {
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

  if (data.preferences) {
    const restrictedKeys = collectRestrictedPreferenceKeys(data.preferences);
    if (restrictedKeys.length > 0) {
      return res.status(400).json({
        error: 'Restricted preference keys',
        message: 'Use dedicated onboarding/billing endpoints for role and payment state updates.',
        keys: restrictedKeys,
      });
    }
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
}

authRouter.put('/me', requireAuth as any, handleUpdateMe);
authRouter.patch('/me', requireAuth as any, handleUpdateMe);

// Fields that must never be deleted by a null merge — they are identity/billing critical.
const PROTECTED_PREF_KEYS = new Set(['role', 'plan', 'onboarding_completed']);

// Utility to deep-merge preferences, preserving nested notification keys
function mergePreferences(base: any, incoming: any) {
  if (!base && !incoming) return {};
  if (!base) return incoming;
  if (!incoming) return base;

  const out = { ...base };

  // Deep merge for nested objects
  for (const key in incoming) {
    if (incoming[key] === null || incoming[key] === undefined) {
      // Explicit null means remove (for optional fields like pending_plan)
      // But NEVER delete protected identity fields
      if (incoming[key] === null && key in incoming && !PROTECTED_PREF_KEYS.has(key)) {
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
authRouter.patch('/me/preferences', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
    zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional().nullable(),
    // SECURITY: onboarding_completed is NEVER settable via PATCH — only via POST /me/complete-onboarding
    
    // New onboarding fields
    // SECURITY: plan is never settable via PATCH — only via payment webhook / upgrade-to-coach
    pending_plan: z.enum(['veteran', 'legend']).optional().nullable(),
    payment_pending: z.boolean().optional(),

    // Rookie is not a role
    role: z.enum(['fan', 'coach']).optional(),
    // Keep this aligned with mobile onboarding role options while supporting legacy values.
    affiliation: z.enum([
      'none',
      'university',
      'high_school',
      'club',
      'youth',
      'professional',
      'school',
      'independent',
    ]).optional(),
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
  }).partial();
  
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const incoming = parsed.data as any;
  // SECURITY: Strip fields that can only be set via controlled server flows
  delete incoming.onboarding_completed; // Only via POST /me/complete-onboarding
  delete incoming.plan;                 // Only via payment webhook or upgrade-to-coach
  delete incoming.pending_plan;         // Only via upgrade-to-coach (prevents fake payment state)
  delete incoming.payment_pending;      // Only via upgrade-to-coach
  delete incoming.payment_approved;     // Only via payment webhook
  // COPPA: Reject if DOB indicates under 13 - do not store
  if (incoming.dob !== undefined && isUnder13(incoming.dob)) {
    return res.status(403).json({
      error: 'COPPA_UNDER_13',
      message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
    });
  }
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true, email: true } });
  const currentPrefs = current?.preferences as any || {};

  // SECURITY FIX: Prevent role changes after onboarding is completed
  // Users can only set/change their role during the initial onboarding process
  if (incoming.role && currentPrefs.onboarding_completed === true && incoming.role !== currentPrefs.role) {
    return res.status(403).json({
      error: 'Cannot change role after onboarding is complete. Contact support if you need to change your account type.',
    });
  }
  // SECURITY: Prevent role elevation to coach via PATCH — use POST /upgrade-to-coach or complete-onboarding
  if (incoming.role === 'coach' && currentPrefs.role === 'fan') {
    return res.status(403).json({
      error: 'Use the upgrade flow to become a coach. Contact support if you need help.',
    });
  }
  // Check if user is admin (same logic as GET /me endpoint)
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const is_admin = current?.email ? adminEmails.includes(current.email.toLowerCase()) : false;
  // Defaults for missing fields only — NEVER include identity fields (role, plan)
  // that could overwrite user-chosen values if current preferences are unexpectedly empty.
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false, follows_notifications: true, messages_notifications: true },
    is_parent: false,
    sports_interests: [],
    personalization_goals: [],
    primary_intents: [],
    location_enabled: false,
    notifications_enabled: true,
    messaging_policy_accepted: false,
  };
  // Merge order: defaults → current user preferences → incoming changes
  const merged = mergePreferences(mergePreferences(defaults, current?.preferences || {}), incoming);

  // SAFETY: Never let role or plan disappear — preserve from DB if the merge lost them
  if (!merged.role && currentPrefs.role) {
    merged.role = currentPrefs.role;
  }
  if (!merged.plan && currentPrefs.plan) {
    merged.plan = currentPrefs.plan;
  }

  const updated = await prisma.user.update({ where: { id: req.user.id }, data: { preferences: merged } });
  return res.json({ preferences: updated.preferences });
}));

// Upgrade fan account to coach — bypasses the role-change block on PATCH /me/preferences
// SECURITY: requireVerified ensures only email-verified users can upgrade to coach
authRouter.post('/upgrade-to-coach', requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const schema = z.object({
    plan: z.enum(['rookie', 'veteran', 'legend']).optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) });
  }

  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const currentPrefs = (current?.preferences as any) || {};

  if (currentPrefs.role === 'coach') {
    return res.status(400).json({ error: 'Account is already a coach account.' });
  }

  const selectedPlan = parsed.data.plan || 'rookie';
  const isPaidPlan = selectedPlan === 'veteran' || selectedPlan === 'legend';
  const merged = {
    ...currentPrefs,
    role: 'coach',
    plan: 'rookie',
    pending_plan: isPaidPlan ? selectedPlan : null,
    payment_pending: isPaidPlan,
    onboarding_completed: false,
  };

  // SECURITY: Set approval_status to PENDING so coaches must go through
  // the full org creation + god-admin approval flow before getting coach tools.
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { preferences: merged, approval_status: 'PENDING' },
  });
  return res.json({ user: { id: req.user.id, preferences: updated.preferences } });
}));

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  // Core identity fields
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_.]+$/).optional(),
  display_name: z.string().optional(),
  affiliation: z.enum([
    'none',
    'university',
    'high_school',
    'club',
    'youth',
    'professional',
    'school',
    'independent',
  ]).optional(),
  dob: z.string().min(1, 'Date of birth is required'),
  zip: z.string().optional(),
  zip_code: z.string().optional(),
  parental_consent_given: z.boolean().optional(),
  parent_guardian_email: z.string().optional(),

  // Rule A: Client sends pending_plan for paid plans, plan only for rookie (free).
  // The real plan field is set by Stripe webhook after payment succeeds.
  plan: z.enum(['rookie']).optional(),
  pending_plan: z.enum(['veteran', 'legend']).optional().nullable(),
  payment_pending: z.preprocess((value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return value;
  }, z.boolean()).optional(),
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
  proceeding_as_fan: z.boolean().optional(),
});

authRouter.post('/me/complete-onboarding', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = completeOnboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Onboarding] Validation failed:', parsed.error);
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  }
  
  const data = parsed.data;

  // COPPA: Reject if DOB indicates under 13 - do not store
  if (isUnder13(data.dob)) {
    return res.status(403).json({
      error: 'COPPA_UNDER_13',
      message: 'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
    });
  }

  // Parental consent required for users aged 13-17
  if (isUnder18(data.dob) && !data.parental_consent_given) {
    return res.status(403).json({
      error: 'PARENTAL_CONSENT_REQUIRED',
      message: 'Users under 18 must have parental consent to use VarsityHub.',
    });
  }

  // Single DB fetch to prevent race conditions between concurrent requests
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { preferences: true, username: true, bio: true },
  });
  const currentPrefs = currentUser?.preferences as any || {};

  // SECURITY: Prevent re-completion — onboarding can only be completed once
  if (currentPrefs.onboarding_completed === true) {
    return res.status(409).json({ error: 'Onboarding already completed', code: 'ALREADY_COMPLETED' });
  }

  const finalRole = data.role !== undefined ? data.role : (currentPrefs.role || 'fan');
  const requestedPendingPlan = typeof data.pending_plan === 'string' ? data.pending_plan : null;
  const selectedPaidPlan = requestedPendingPlan === 'veteran' || requestedPendingPlan === 'legend'
    ? requestedPendingPlan
    : null;
  const effectivePendingPlan = finalRole === 'coach' ? selectedPaidPlan : null;
  const hasPendingJoinRequest = finalRole === 'coach'
    ? !!(await prisma.organizationJoinRequest.findFirst({
        where: {
          user_id: req.user.id,
          status: 'pending',
          ...(data.organization_id ? { organization_id: data.organization_id } : {}),
        },
        select: { id: true },
      }))
    : false;

  if (finalRole === 'coach' && !data.username) {
    return res.status(400).json({ error: 'Username required for coach onboarding' });
  }

  // SECURITY: Coaches must create or join an organization — prevents bypassing approval flow
  if (finalRole === 'coach' && !data.organization_id && !hasPendingJoinRequest) {
    return res.status(400).json({
      error: 'Coaches must create or join an organization during onboarding.',
      code: 'ORG_REQUIRED',
    });
  }

  // SECURITY: If coach claims an organization_id, verify they actually own or have a pending join request for it
  if (finalRole === 'coach' && data.organization_id) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: data.organization_id, user_id: req.user!.id },
    });
    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { organization_id: data.organization_id, user_id: req.user!.id, status: { in: ['pending', 'approved'] } },
    });
    if (!membership && !joinRequest) {
      return res.status(403).json({
        error: 'You must be a member of or have a pending request for this organization.',
        code: 'ORG_NOT_YOURS',
      });
    }
  }

  if (!data.username && !currentUser?.username) {
    return res.status(400).json({ error: 'Username is required to complete onboarding' });
  }

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
    // Rule A: plan is 'rookie' for free, or set by Stripe webhook for paid plans.
    // pending_plan holds the coach's selected paid plan until payment completes.
    plan: data.plan || 'rookie', // only 'rookie' accepted from client
    pending_plan: effectivePendingPlan,
    affiliation: data.affiliation,
    dob: data.dob,
    zip_code: data.zip_code || data.zip,
    team_id: data.team_id,
    team_name: data.team_name,
    organization_id: data.organization_id,
    organization_name: data.organization_name,
    join_request_pending: hasPendingJoinRequest,
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
    payment_pending: effectivePendingPlan ? currentPrefs.payment_approved !== true : false,
    payment_approved: effectivePendingPlan ? currentPrefs.payment_approved === true : false,
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
  const basePreferences = currentUser?.preferences;
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
  
  // SECURITY: Coaches must be PENDING until their organization is approved by god-admin.
  // The Prisma default is APPROVED (for fans), so we MUST explicitly set PENDING here.
  // The only legitimate path to APPROVED is via the org approval endpoint (POST /:id/approve)
  // or join-request approval — both set it explicitly AFTER admin review.
  // During onboarding, coaches always start as PENDING regardless of current DB value.
  if (finalRole === 'coach') {
    // Check if this coach's org has been admin_approved — only then preserve APPROVED
    let orgApproved = false;
    if (data.organization_id) {
      const org = await prisma.organization.findUnique({
        where: { id: data.organization_id },
        select: { admin_approved: true },
      });
      orgApproved = org?.admin_approved === true;
    }
    if (!orgApproved) {
      updateData.approval_status = 'PENDING';
    }
  }

  // Update user
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData
  });
  
  return res.json({
    message: 'Onboarding completed successfully',
    user: sanitizeUser(updated)
  });
}));

async function sendVerificationCodeForUser(req: AuthedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  const now = Date.now();
  const verifyKey = `verify:${user.id}`;

  // Check 30-second cooldown via a separate TTL key
  const lastSend = await rlGet(`${verifyKey}:last`);
  if (lastSend && now - parseInt(lastSend, 10) < 30_000) {
    return res.status(429).json({ error: 'Please wait before requesting another code' });
  }

  // Check 5/hour limit via an hourly counter
  const hourlyCount = await rlIncr(`${verifyKey}:hour`, 3600_000);
  if (hourlyCount > 5) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const code = String(crypto.randomInt(100000, 999999)); // 6-digit numeric code
  debugLog(`[verify-code] [verify/request] Verification code generated for user ${user.id}`);
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [verify/request] Code generated: ${code} for user ${user.id} (${user.email})`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { email_verification_code: code, email_verification_expires: exp } });
  debugLog(`[verify-code] [verify/request] Verification code stored in DB (expires ${exp.toISOString()})`);
  if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [verify/request] Code stored in DB (expires ${exp.toISOString()})`);
  try {
    debugLog(`[verify-code] [verify/request] Sending verification email for user ${user.id}`);
    if (process.env.NODE_ENV === 'development') console.log(`[verify-code] [verify/request] Calling sendVerificationEmail → to: ${user.email}`);
    const sent = await sendVerificationEmail(user.email, code, user.display_name || user.email.split('@')[0]);
    if (!sent) {
      console.error('[verify-code] [verify/request] sendVerificationEmail returned false — email was NOT sent (check SendGridProvider logs above for the specific error)');
    } else {
      debugLog('[verify-code] [verify/request] sendVerificationEmail returned true — email accepted by SendGrid');
    }
  } catch (e) {
    console.error('[verify-code] [verify/request] sendVerificationEmail threw:', e);
    req.log?.warn?.({ err: e }, 'Email send failed');
  }
  const payload: any = { ok: true };
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_CODES === '1') payload.dev_verification_code = code;
  // Record the send timestamp for 30s cooldown
  await rlSet(`${verifyKey}:last`, String(now), 30_000);
  return res.json(payload);
}

// Request a new email verification code (authenticated)
authRouter.post('/verify/request', requireAuth as any, verificationLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  return sendVerificationCodeForUser(req, res);
}));

// Alias: /auth/verify/send
authRouter.post('/verify/send', requireAuth as any, verificationLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  return sendVerificationCodeForUser(req, res);
}));

// Verify code (authenticated) — rate limited to prevent brute-force on 6-digit codes
authRouter.post('/verify/confirm', requireAuth as any, verificationLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const schema = z.object({ code: z.string().min(6).max(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  if (!user.email_verification_code || !user.email_verification_expires) return res.status(400).json({ error: 'No verification in progress' });
  if (new Date() > user.email_verification_expires) return res.status(400).json({ error: 'Code expired' });
  const verifA = Buffer.from(String(code));
  const verifB = Buffer.from(String(user.email_verification_code));
  if (verifA.length !== verifB.length || !crypto.timingSafeEqual(verifA, verifB)) return res.status(400).json({ error: 'Invalid code' });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { email_verified: true, email_verification_code: null, email_verification_expires: null } });
  return res.json({ ok: true, user: sanitizeUser(updated) });
}));

function sanitizeUser(u: any) {
  if (!u) return u;
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    username: u.username,
    avatar_url: u.avatar_url,
    bio: u.bio,
    created_at: u.created_at,
    email_verified: u.email_verified,
    banned: u.banned,
    ban_reason: u.ban_reason,
    banned_until: u.banned_until,
    preferences: u.preferences,
    approval_status: u.approval_status,
    subscription_tier: u.subscription_tier,
    subscription_status: u.subscription_status,
    subscription_expires_at: u.subscription_expires_at,
    max_teams: u.max_teams,
    paid_by_owner: u.paid_by_owner,
    // Include relations only if they were loaded
    ...(u.memberships !== undefined && { memberships: u.memberships }),
    ...(u.orgMemberships !== undefined && { orgMemberships: u.orgMemberships }),
    ...(u.posts !== undefined && { posts: u.posts }),
    ...(u.stories !== undefined && { stories: u.stories }),
    ...(u.ads !== undefined && { ads: u.ads }),
    ...(u.teamFollows !== undefined && { teamFollows: u.teamFollows }),
    ...(u.organizationFollows !== undefined && { organizationFollows: u.organizationFollows }),
  };
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
