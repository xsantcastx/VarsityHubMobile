import bcrypt from 'bcrypt';
import crypto, { createPublicKey, type KeyObject } from 'crypto';
import { Router } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { sendPasswordChangedEmail, sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from '../lib/email.js';
import { validateContent } from '../lib/contentFilter.js';
import { ConflictError } from '../lib/errors/ConflictError.js';
import { ValidationError } from '../lib/errors/ValidationError.js';
import { signJwt, generateRefreshToken, REFRESH_TOKEN_EXPIRY_DAYS } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { refreshTokenLimiter } from '../middleware/rateLimiters.js';

export const authRouter = Router();
// Simple in-memory rate limiting for auth endpoints
const authRate: Map<string, { attempts: number; resetAt: number }> = new Map();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Dedicated failed-attempt tracking for password reset code verification
type ResetFailureRecord = { attempts: number; lockedUntil: number; lastAttempt: number };
const resetFailures: Map<string, ResetFailureRecord> = new Map();
const MAX_RESET_FAILURES = 5;
const RESET_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RATE_TRACKED_KEYS = 10_000;
const RATE_MAP_PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RESET_FAILURE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastRatePruneAt = 0;

function trimMapByOldestValue<K, V>(map: Map<K, V>, targetSize: number, getSortValue: (value: V) => number): void {
  if (map.size <= targetSize) return;
  const entries = [...map.entries()].sort((a, b) => getSortValue(a[1]) - getSortValue(b[1]));
  const removeCount = Math.max(0, map.size - targetSize);
  for (let i = 0; i < removeCount; i++) {
    map.delete(entries[i][0]);
  }
}

function maybePruneRateMaps(now: number = Date.now(), force = false): void {
  if (!force && now - lastRatePruneAt < RATE_MAP_PRUNE_INTERVAL_MS) return;
  lastRatePruneAt = now;

  for (const [key, record] of authRate.entries()) {
    if (record.resetAt <= now) authRate.delete(key);
  }

  for (const [key, record] of resetFailures.entries()) {
    const lockExpired = record.lockedUntil > 0 && record.lockedUntil <= now;
    const staleRecord = now - record.lastAttempt > RESET_FAILURE_TTL_MS;
    if (lockExpired || staleRecord) resetFailures.delete(key);
  }

  for (const [key, record] of verifyRate.entries()) {
    if (now - record.hourStart > 2 * 3600_000) verifyRate.delete(key);
  }

  const targetSize = Math.floor(MAX_RATE_TRACKED_KEYS * 0.8);
  if (authRate.size > MAX_RATE_TRACKED_KEYS) {
    trimMapByOldestValue(authRate, targetSize, (value) => value.resetAt);
  }
  if (resetFailures.size > MAX_RATE_TRACKED_KEYS) {
    trimMapByOldestValue(resetFailures, targetSize, (value) => value.lastAttempt);
  }
  if (verifyRate.size > MAX_RATE_TRACKED_KEYS) {
    trimMapByOldestValue(verifyRate, targetSize, (value) => value.hourStart);
  }
}

function checkResetAttempt(email: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  maybePruneRateMaps(now, resetFailures.size >= MAX_RATE_TRACKED_KEYS);
  const record = resetFailures.get(email);

  if (!record) return { allowed: true };

  // Lock expired — clear and allow
  if (record.lockedUntil && now >= record.lockedUntil) {
    resetFailures.delete(email);
    return { allowed: true };
  }

  // Currently locked out
  if (record.attempts >= MAX_RESET_FAILURES) {
    return { allowed: false, retryAfterMs: record.lockedUntil - now };
  }

  return { allowed: true };
}

function recordResetFailure(email: string): void {
  const now = Date.now();
  maybePruneRateMaps(now, resetFailures.size >= MAX_RATE_TRACKED_KEYS);
  const record = resetFailures.get(email);

  if (!record) {
    resetFailures.set(email, { attempts: 1, lockedUntil: 0, lastAttempt: now });
    return;
  }

  record.attempts++;
  record.lastAttempt = now;
  if (record.attempts >= MAX_RESET_FAILURES) {
    record.lockedUntil = now + RESET_LOCKOUT_MS;
  }
}

function clearResetFailures(email: string): void {
  resetFailures.delete(email);
}
const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

function checkAuthRateLimit(identifier: string): boolean {
  const now = Date.now();
  maybePruneRateMaps(now, authRate.size >= MAX_RATE_TRACKED_KEYS);
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

/** Create a refresh token pair and store in DB. Returns { refresh_token, refresh_token_expires }. */
async function issueRefreshToken(userId: string) {
  const refresh_token = generateRefreshToken();
  const refresh_token_expires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { refresh_token, refresh_token_expires },
  });
  return { refresh_token, refresh_token_expires };
}

// simple in-memory rate limiting for verification send: 1/30s, 5/hour per user
const verifyRate: Map<string, { last: number; count: number; hourStart: number }> = new Map();
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

// ---- Token Refresh (no auth middleware — refresh tokens are self-authenticating) ----
authRouter.post('/refresh', refreshTokenLimiter, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken required' });
  }

  const user = await prisma.user.findFirst({
    where: { refresh_token: refreshToken, refresh_token_expires: { gt: new Date() } },
  });
  if (!user) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  // Block banned or suspended users from refreshing tokens
  if (user.banned) {
    return res.status(403).json({ error: 'Account banned', ban_reason: (user as any).ban_reason || undefined });
  }
  if ((user as any).banned_until && new Date((user as any).banned_until) > new Date()) {
    return res.status(403).json({ error: 'Account temporarily suspended', banned_until: (user as any).banned_until, ban_reason: (user as any).ban_reason || undefined });
  }

  // Rotate: issue new token pair
  const { refresh_token: newRefreshToken } = await issueRefreshToken(user.id);
  const access_token = signJwt({ id: user.id });

  return res.json({ access_token, refresh_token: newRefreshToken });
}));

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  display_name: z.string().optional(),
  // Rookie is a coach plan, not a role
  role: z.enum(['fan', 'coach']).optional(),
  dob: z.string().optional(), // COPPA: reject if under 13
  // Honeypot + timing fields for bot detection (optional — ignored if missing)
  website: z.string().optional(), // Honeypot: bots fill this, real users don't
  _t: z.number().optional(),      // Timestamp when form was loaded (detect instant submissions)
});

authRouter.post('/register', asyncHandler(async (req, res) => {
  const start = Date.now();
  debugLog('[register] Incoming request');

  // Bot detection: honeypot field — if filled, silently reject
  if (req.body?.website && typeof req.body.website === 'string' && req.body.website.trim().length > 0) {
    debugLog('[register] Honeypot triggered');
    // Return fake success to confuse bots
    return res.status(201).json({ access_token: 'ok', refresh_token: 'ok', user: {} });
  }

  // Bot detection: timing — if form submitted in under 2 seconds, likely a bot
  if (req.body?._t && typeof req.body._t === 'number') {
    const elapsed = Date.now() - req.body._t;
    if (elapsed < 2000) {
      debugLog('[register] Form submitted too fast:', elapsed, 'ms');
      return res.status(201).json({ access_token: 'ok', refresh_token: 'ok', user: {} });
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
  if (!checkAuthRateLimit(`register:${sanitizedEmail}`)) {
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
  const code = String(crypto.randomInt(100000, 1000000));
  debugLog(`[verify-code] [register] Verification code generated for ${sanitizedEmail}`);
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
  const access_token = signJwt({ id: user.id });
  const { refresh_token } = await issueRefreshToken(user.id);
  try {
    debugLog(`[verify-code] [register] Sending verification email to ${email}`);
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
  const payload: any = { access_token, refresh_token, user: sanitizeUser(user) };
  if (process.env.NODE_ENV !== 'production') payload.dev_verification_code = code;
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
  if (!checkAuthRateLimit(sanitizedEmail)) {
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
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const access_token = signJwt({ id: user.id });
  const { refresh_token } = await issueRefreshToken(user.id);

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
  const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;
  const body: any = { access_token, refresh_token, user: sanitized, needs_onboarding: needsOnboarding };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
}));

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

    // Block banned/suspended users from Google auth
    if (user.banned) {
      return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason || 'Your account has been banned for violating community guidelines.' });
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return res.status(403).json({ error: 'Account temporarily suspended', banned_until: user.banned_until, ban_reason: user.ban_reason || 'Your account has been temporarily suspended.' });
    }

    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id });
    const { refresh_token } = await issueRefreshToken(sanitized.id);
    const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;

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

authRouter.post('/apple', async (req, res) => {
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

    // Block banned/suspended users from Apple auth
    if (user.banned) {
      return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason || 'Your account has been banned for violating community guidelines.' });
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return res.status(403).json({ error: 'Account temporarily suspended', banned_until: user.banned_until, ban_reason: user.ban_reason || 'Your account has been temporarily suspended.' });
    }

    const sanitized = sanitizeUser(user);
    const access_token = signJwt({ id: sanitized.id });
    const { refresh_token } = await issueRefreshToken(sanitized.id);
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

authRouter.post('/password/forgot', async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const email = parsed.data.email.trim().toLowerCase();

  // SECURITY: Rate limiting to prevent password reset abuse / enumeration
  if (!checkAuthRateLimit(`forgot:${email}`)) {
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

  const code = String(crypto.randomInt(10000000, 100000000)); // 8-digit code (~90M possibilities)
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

  if (process.env.NODE_ENV !== 'production') payload.dev_reset_code = code;
  return res.json(payload);
});

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
  password: z.string().min(8),
});

authRouter.post('/password/reset', async (req, res) => {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, code, password } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();

  // SECURITY: Check dedicated failure-based lockout before anything else
  const attemptCheck = checkResetAttempt(sanitizedEmail);
  if (!attemptCheck.allowed) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  // Also keep the general rate limit as a secondary guard
  if (!checkAuthRateLimit(`reset:${sanitizedEmail}`)) {
    return res.status(429).json({ error: 'Too many reset attempts. Please request a new code.' });
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: sanitizedEmail, mode: 'insensitive' } } });
  if (!user || !user.password_reset_code || !user.password_reset_expires) {
    recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (new Date() > user.password_reset_expires) {
    recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  if (String(code).trim() !== String(user.password_reset_code)) {
    recordResetFailure(sanitizedEmail);
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  // Success — clear failure tracking and reset the code
  clearResetFailures(sanitizedEmail);

  const password_hash = await bcrypt.hash(password, 10);
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
});

const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

authRouter.post('/password/change', requireAuth as any, async (req: AuthedRequest, res) => {
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
    data: { password_hash, password_changed_at: new Date() },
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

authRouter.get('/me', requireAuth as any, async (req: AuthedRequest, res) => {
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
  };
  // Defaults fill in missing keys; user preferences override defaults
  const userPrefs = (user as any).preferences || {};
  const prefs = mergePreferences(defaults, userPrefs);
  const { password_hash, refresh_token, stripe_customer_id, ...rest } = user as any;
  return res.json({ ...rest, ...(is_admin ? { role: 'admin' } : {}), preferences: prefs, is_admin });
});

// Lightweight subscription status (no Stripe calls)
authRouter.get('/me/subscription', requireAuth as any, async (req: AuthedRequest, res) => {
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
});

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
  bio: z.string().max(1000).transform((val) => val === '' ? null : val).optional().nullable(),
  preferences: z.any().optional(),
});

authRouter.put('/me', requireAuth as any, async (req: AuthedRequest, res) => {
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
authRouter.patch('/me', requireAuth as any, async (req: AuthedRequest, res) => {
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
authRouter.patch('/me/preferences', requireAuth as any, async (req: AuthedRequest, res) => {
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
    // Rule A: Client can set plan to 'rookie' only; paid plans go through pending_plan.
    plan: z.enum(['rookie']).optional(),
    pending_plan: z.enum(['veteran', 'legend']).optional().nullable(),
    payment_pending: z.boolean().optional(),

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
    dm_policy: z.enum(['everyone', 'following', 'no_one']).optional(),
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
  const currentPrefs = current?.preferences as any || {};

  // SECURITY FIX: Prevent role changes after onboarding is completed
  // Users can only set/change their role during the initial onboarding process
  if (incoming.role && currentPrefs.onboarding_completed === true && incoming.role !== currentPrefs.role) {
    return res.status(403).json({
      error: 'Cannot change role after onboarding is complete. Contact support if you need to change your account type.',
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
});

// Upgrade fan account to coach — bypasses the role-change block on PATCH /me/preferences
authRouter.post('/upgrade-to-coach', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const schema = z.object({
    plan: z.enum(['rookie', 'veteran', 'legend']),
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

  const merged = {
    ...currentPrefs,
    role: 'coach',
    plan: parsed.data.plan,
    onboarding_completed: false,
  };

  const updated = await prisma.user.update({ where: { id: req.user.id }, data: { preferences: merged } });
  return res.json({ user: { id: req.user.id, preferences: updated.preferences } });
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
  
  // Rule A: Client sends pending_plan for paid plans, plan only for rookie (free).
  // The real plan field is set by Stripe webhook after payment succeeds.
  plan: z.enum(['rookie']).optional(),
  pending_plan: z.enum(['veteran', 'legend']).optional().nullable(),
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

authRouter.post('/me/complete-onboarding', requireAuth as any, async (req: AuthedRequest, res) => {
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
  
  // Get current preferences FIRST to preserve role if not in payload
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const currentPrefs = current?.preferences as any || {};
  
  // CRITICAL: Role MUST be preserved from onboarding step-1 or provided in payload
  // If role is undefined in payload, use existing role from preferences (set during step-1)
  const finalRole = data.role !== undefined ? data.role : (currentPrefs.role || 'fan');
  
  // CRITICAL: For coaches, validate required steps are completed
  if (finalRole === 'coach') {
    // Coaches MUST have: username and team/org (plan is set via Stripe payment)
    if (!data.username) {
      return res.status(400).json({ error: 'Username required for coach onboarding' });
    }
    if (!data.team_id && !data.organization_id) {
      return res.status(400).json({ error: 'Team or organization required for coach onboarding' });
    }
  }

  // Username is required for ALL roles — check payload OR existing DB value
  const existingUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });
  if (!data.username && !existingUser?.username) {
    return res.status(400).json({ error: 'Username is required to complete onboarding' });
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
    // Rule A: plan is 'rookie' for free, or set by Stripe webhook for paid plans.
    // pending_plan holds the coach's selected paid plan until payment completes.
    plan: data.plan, // only 'rookie' allowed from client
    pending_plan: data.pending_plan,
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
authRouter.post('/verify/request', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.email_verified) return res.json({ ok: true, already_verified: true });
  const now = Date.now();
  const key = user.id;
  maybePruneRateMaps(now, verifyRate.size >= MAX_RATE_TRACKED_KEYS);
  const rec = verifyRate.get(key) || { last: 0, count: 0, hourStart: now };
  if (now - rec.hourStart > 3600_000) { rec.hourStart = now; rec.count = 0; }
  if (now - rec.last < 30_000) return res.status(429).json({ error: 'Please wait before requesting another code' });
  if (rec.count >= 5) return res.status(429).json({ error: 'Too many requests' });
  const code = String(crypto.randomInt(100000, 1000000));
  debugLog(`[verify-code] [verify/request] Verification code generated for user ${user.id}`);
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { email_verification_code: code, email_verification_expires: exp } });
  debugLog(`[verify-code] [verify/request] Verification code stored in DB (expires ${exp.toISOString()})`);
  try {
    debugLog(`[verify-code] [verify/request] Sending verification email for user ${user.id}`);
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
  if (process.env.NODE_ENV !== 'production') payload.dev_verification_code = code;
  rec.last = now; rec.count += 1; verifyRate.set(key, rec);
  return res.json(payload);
});

// Alias: /auth/verify/send
authRouter.post('/verify/send', requireAuth as any, async (req: AuthedRequest, res) => {
  (authRouter as any).handle({ ...req, url: '/verify/request' }, res);
});

// Verify code (authenticated)
authRouter.post('/verify/confirm', requireAuth as any, async (req: AuthedRequest, res) => {
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
    refresh_token,
    stripe_customer_id,
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
