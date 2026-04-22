import bcrypt from 'bcrypt';
import crypto, { createPublicKey, type KeyObject } from 'crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import {
  sendCoachApplicationAdminEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../lib/email.js';
import { validateContent } from '../lib/contentFilter.js';
import { ConflictError } from '../lib/errors/ConflictError.js';
import { ValidationError } from '../lib/errors/ValidationError.js';
import {
  signJwt,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { captureException } from '../lib/sentry.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import {
  authLimiter,
  oauthLimiter,
  passwordResetLimiter,
  verificationConfirmLimiter,
} from '../middleware/rateLimiters.js';
import { rlIncr, rlGet, rlSet, rlDel } from '../lib/redisRateLimit.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { isAdminEmail } from '../lib/adminEmails.js';
import { invalidatePrivateIdsCache } from '../lib/privacyUtils.js';
import { ensureOAuthUserVerified } from '../lib/oauthVerification.js';
import {
  evaluateDobUpdate,
  formatDobYmd,
  getCanonicalDob,
  getUserAge,
  isVerifiedAdult,
  requiresParentalConsent,
} from '../lib/userAge.js';
import {
  buildAuthStateColumns,
  getCanonicalAuthState,
  getCanonicalUserRole,
  isProceedingAsFan,
  isUserOnboardingComplete,
  mergeAuthStateIntoPreferences,
} from '../lib/userAuthState.js';
import {
  buildBillingStateColumns,
  getCanonicalBillingState,
  getCanonicalPlan,
  getSelectedPlan,
  isPaymentPending,
  mergeBillingStateIntoPreferences,
} from '../lib/userBillingState.js';

export const authRouter = Router();

async function invalidateMeCacheForUser(userId: string | null | undefined): Promise<void> {
  const { invalidateMeCacheForUser } = await import('../lib/userCache.js');
  await invalidateMeCacheForUser(userId);
}

async function assertCanSelfDeleteUser(userId: string): Promise<void> {
  const { assertCanSelfDeleteUser } = await import('../lib/accountDeletion.js');
  await assertCanSelfDeleteUser(userId);
}

async function softDeleteUserAccount(userId: string) {
  const { softDeleteUserAccount } = await import('../lib/accountDeletion.js');
  return softDeleteUserAccount(userId);
}

// Rate limit thresholds (unchanged)
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RESET_FAILURES = 5;
const RESET_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const REGISTER_EMAIL_SOFT_TIMEOUT_MS = 5000;

// Constant-time bcrypt hash used when the looked-up user doesn't exist or has
// no password set (OAuth-only account, for example). Running bcrypt.compare
// against this hash equalizes login timing so the endpoint cannot be used to
// enumerate which emails have an account. Generated once at boot from a random
// input so the hash itself is not predictable.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(
  `const-time-${crypto.randomBytes(16).toString('hex')}`,
  10
);

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
async function checkResetAttempt(
  email: string
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
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
  let record = raw
    ? (JSON.parse(raw) as { attempts: number; lockedUntil: number })
    : { attempts: 0, lockedUntil: 0 };

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

// ── Per-account login lockout ──
// Tracks failed login attempts keyed by email. Complements the per-IP / per-email
// velocity limiter (`checkAuthRateLimit`) which counts every call; this one only
// counts failures and resets on a successful login, so legit users who sign in
// repeatedly never trip it.

async function checkLoginAttempt(
  email: string
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const key = `loginfail:${email}`;
  const raw = await rlGet(key);
  if (!raw) return { allowed: true };
  try {
    const record = JSON.parse(raw) as { attempts: number; lockedUntil: number };
    if (record.attempts >= MAX_LOGIN_FAILURES && record.lockedUntil > Date.now()) {
      return { allowed: false, retryAfterMs: record.lockedUntil - Date.now() };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

async function recordLoginFailure(email: string): Promise<void> {
  const key = `loginfail:${email}`;
  const raw = await rlGet(key);
  let record: { attempts: number; lockedUntil: number };
  try {
    record = raw
      ? (JSON.parse(raw) as { attempts: number; lockedUntil: number })
      : { attempts: 0, lockedUntil: 0 };
  } catch {
    record = { attempts: 0, lockedUntil: 0 };
  }
  record.attempts += 1;
  if (record.attempts >= MAX_LOGIN_FAILURES) {
    record.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  await rlSet(key, JSON.stringify(record), LOGIN_LOCKOUT_MS);
}

async function clearLoginFailures(email: string): Promise<void> {
  await rlDel(`loginfail:${email}`);
}

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.NODE_ENV === 'production') return console.log(...args);
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    return console.log(...args);
  }
};
const shouldExposeDevCodes =
  process.env.ENABLE_DEV_CODES === '1' &&
  (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');
const GOOGLE_ALLOWED_AUDIENCES = (
  process.env.GOOGLE_OAUTH_CLIENT_IDS ||
  process.env.GOOGLE_OAUTH_AUDIENCE ||
  ''
)
  .split(',')
  .map(value => value.trim())
  .filter(value => value.length > 0);

// Create a single OAuth2Client for token verification (uses Google's public keys, cached automatically)
const googleOAuthClient = new OAuth2Client();

// Enforce Google OAuth audience validation in production
if (process.env.NODE_ENV === 'production' && GOOGLE_ALLOWED_AUDIENCES.length === 0) {
  console.error(
    '[auth] FATAL: GOOGLE_OAUTH_CLIENT_IDS is not set — Google sign-in is disabled in production'
  );
}

// Warn if Apple simulator tokens are enabled in production
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_APPLE_SIM_TOKENS === 'true') {
  console.error(
    '[auth] WARNING: ALLOW_APPLE_SIM_TOKENS is enabled in production — this is a security risk. Disable immediately.'
  );
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
  const data = (await response.json()) as { keys?: Array<Record<string, unknown>> };
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  const jwk = keys.find(key => key?.kid === kid);
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

function deriveParentalConsentFields(dob: Date | null) {
  if (!dob) return {};
  return requiresParentalConsent({ date_of_birth: dob })
    ? { parental_consent_status: 'pending' as const, parental_consent_at: null }
    : { parental_consent_status: 'not_required' as const, parental_consent_at: null };
}

const passwordRequirement = z
  .string()
  .min(8)
  .refine(val => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
    message: 'Password must contain at least one letter and one number',
  });

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: passwordRequirement,
  display_name: z.string().optional(),
  // Rookie is a coach plan, not a role
  role: z.enum(['fan', 'coach']).optional(),
  dob: z.string().optional(), // COPPA: reject if under 13
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const start = Date.now();
    debugLog('[register] Incoming request');
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid registration data', {
        validationIssues: parsed.error.issues.map(issue => ({
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
      return res
        .status(429)
        .json({ error: 'Too many registration attempts. Please try again later.' });
    }

    // COPPA: Reject registration if DOB indicates under 13
    if (dob && isUnder13(dob)) {
      throw new ValidationError(
        'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
        {
          errorCode: 'COPPA_UNDER_13',
        }
      );
    }

    // Canonical DOB column write (dual-writes preferences.dob below for
    // transition compatibility). If the DOB string is malformed, reject the
    // registration rather than silently drop it.
    let dobColumnWrite: { date_of_birth: Date; dob_set_at: Date } | null = null;
    if (dob) {
      const decision = evaluateDobUpdate({
        currentDob: null,
        currentSetAt: null,
        incomingDob: dob,
      });
      if (!decision.ok) {
        throw new ValidationError('Invalid date of birth', { errorCode: 'INVALID_DOB' });
      }
      dobColumnWrite = {
        date_of_birth: decision.newDob,
        dob_set_at: decision.newSetAt ?? new Date(),
      };
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
    if (process.env.NODE_ENV === 'development')
      console.log(`[verify-code] [register] Code generated: ${code} for ${sanitizedEmail}`);
    const exp = new Date(Date.now() + 30 * 60 * 1000);
    // AUTH-5: Hash verification code before storage (same SHA-256 as refresh tokens)
    const codeHash = hashRefreshToken(code);
    const userRole = role || 'fan';

    // Set admin flag based on ADMIN_EMAILS env var
    const isAdmin = isAdminEmail(sanitizedEmail);
    const authStatePatch = {
      role: userRole,
      onboarding_completed: false,
    } as const;
    const initialPreferences = {
      ...mergeAuthStateIntoPreferences({}, authStatePatch),
      ...(isAdmin && { is_admin: true }),
      // Dual-write DOB to preferences.dob during transition so legacy readers
      // keep working while the codebase migrates to reading the column.
      ...(dob ? { dob } : {}),
    };

    debugLog('[register] Creating user record');
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password_hash,
        display_name,
        email_verified: false,
        email_verification_code: codeHash,
        email_verification_expires: exp,
        preferences: initialPreferences,
        ...buildAuthStateColumns(authStatePatch),
        ...(dobColumnWrite ? deriveParentalConsentFields(dobColumnWrite.date_of_birth) : {}),
        ...(dobColumnWrite ?? {}),
      },
    });
    if (process.env.NODE_ENV === 'development')
      console.log(
        `[verify-code] [register] Code hash stored in DB for user ${user.id} (expires ${exp.toISOString()})`
      );
    const access_token = signJwt({ id: user.id });
    // Issue refresh token on registration
    const rawRefreshReg = generateRefreshToken();
    const regTokenHash = hashRefreshToken(rawRefreshReg);
    const regExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token_hash: regTokenHash,
        user_id: user.id,
        expires_at: regExpiry,
        device_info: req.headers['user-agent'] || null,
      },
    });

    const emailSendAttempt = sendVerificationEmail(
      email,
      code,
      display_name || sanitizedEmail.split('@')[0]
    )
      .then(sent => ({
        sent,
        error: sent ? undefined : 'EMAIL_DELIVERY_FAILED',
      }))
      .catch(e => {
        console.error('[register] sendVerificationEmail threw:', e);
        return { sent: false, error: 'EMAIL_DELIVERY_EXCEPTION' as const };
      });

    const emailDelivery = await Promise.race([
      emailSendAttempt,
      new Promise<{ sent: false; error: 'EMAIL_DELIVERY_TIMEOUT' }>(resolve =>
        setTimeout(
          () => resolve({ sent: false, error: 'EMAIL_DELIVERY_TIMEOUT' }),
          REGISTER_EMAIL_SOFT_TIMEOUT_MS
        )
      ),
    ]);

    if (!emailDelivery.sent) {
      console.error(
        `[register] Initial verification email not confirmed: ${emailDelivery.error ?? 'unknown'}`
      );
    }

    const payload: any = {
      access_token,
      refresh_token: rawRefreshReg,
      user: sanitizeUser(user),
      verification_email_sent: emailDelivery.sent,
      verification_email_error: emailDelivery.error,
    };
    if (shouldExposeDevCodes) payload.dev_verification_code = code;
    debugLog('[register] Completed in', Date.now() - start, 'ms');
    res.status(201).json(payload);
  })
);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
    const { email, password } = parsed.data;
    const sanitizedEmail = email.trim().toLowerCase();

    // Per-account lockout: if this account is currently locked out due to
    // too many failed attempts, refuse before doing any DB or bcrypt work.
    const lockCheck = await checkLoginAttempt(sanitizedEmail);
    if (!lockCheck.allowed) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Please try again later.',
        retry_after_ms: lockCheck.retryAfterMs,
      });
    }

    // Velocity limiter — counts every call (success or fail) per email.
    if (!(await checkAuthRateLimit(sanitizedEmail))) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }

    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    // Run bcrypt.compare unconditionally — against the real hash if the user
    // exists, against the dummy hash otherwise — so login timing cannot be used
    // to enumerate which emails have an account.
    const hashToCompare = user?.password_hash || DUMMY_BCRYPT_HASH;
    const passwordMatches = await bcrypt.compare(password, hashToCompare);

    if (!user) {
      await recordLoginFailure(sanitizedEmail);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.banned) return res.status(403).json({ error: 'Account banned' });
    if (!user.password_hash) {
      await recordLoginFailure(sanitizedEmail);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!passwordMatches) {
      await recordLoginFailure(sanitizedEmail);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Success — clear the failure counter so this account isn't half-locked.
    await clearLoginFailures(sanitizedEmail);
    const access_token = signJwt({ id: user.id });

    // AUTH-4: Issue refresh token with device fingerprint binding
    const rawRefresh = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'] || null;
    await prisma.refreshToken.create({
      data: {
        token_hash: tokenHash,
        user_id: user.id,
        expires_at: expiresAt,
        device_info: deviceInfo,
      },
    });

    const sanitized = sanitizeUser(user);
    const needsOnboarding = !isUserOnboardingComplete(user as any);
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
  })
);

/**
 * POST /auth/refresh
 * Exchange a valid refresh token for a new access token + rotated refresh token.
 * The old refresh token is invalidated (rotation prevents reuse).
 */
const refreshSchema = z.object({ refresh_token: z.string().min(32) });

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    if (
      !req.body?.refresh_token ||
      typeof req.body.refresh_token !== 'string' ||
      !req.body.refresh_token.trim()
    ) {
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

      // AUTH-4: Validate device fingerprint (warn-only for now to avoid breaking existing sessions)
      const currentDevice = req.headers['user-agent'] || null;
      if (stored.device_info && currentDevice && stored.device_info !== currentDevice) {
        console.warn('[auth] Refresh token used from different device', {
          userId: user.id,
          storedDevice: stored.device_info.substring(0, 50),
          currentDevice: currentDevice.substring(0, 50),
        });
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
            data: {
              token_hash: newHash,
              user_id: user.id,
              expires_at: newExpiry,
              device_info: currentDevice,
            },
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
  })
);

/**
 * POST /auth/revoke-all-tokens
 * Invalidates every refresh token for the current user.
 * Use when a security breach is detected.
 */
authRouter.post(
  '/revoke-all-tokens',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { count } = await prisma.refreshToken.deleteMany({ where: { user_id: req.user!.id } });
    return res.json({ ok: true, revoked: count });
  })
);

/**
 * POST /auth/logout
 * Invalidates the provided refresh token.
 */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refresh_token } = req.body || {};
    if (refresh_token && typeof refresh_token === 'string') {
      const tokenHash = hashRefreshToken(refresh_token);
      // Resolve the user from the refresh token BEFORE deleting it, so we can
      // also proactively clear their push token. Stale push tokens on logged-out
      // devices are a privacy leak (the device keeps receiving pushes for a user
      // who is no longer signed in) and an abuse vector if the device is shared.
      const row = await prisma.refreshToken
        .findUnique({ where: { token_hash: tokenHash }, select: { user_id: true } })
        .catch(() => null);
      await prisma.refreshToken.deleteMany({ where: { token_hash: tokenHash } }).catch(() => {});
      if (row?.user_id) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: row.user_id },
            select: { preferences: true },
          });
          const prefs =
            user?.preferences && typeof user.preferences === 'object'
              ? (user.preferences as Record<string, unknown>)
              : null;
          if (prefs && 'push_token' in prefs) {
            const { push_token: _removed, ...rest } = prefs;
            await prisma.user.update({
              where: { id: row.user_id },
              data: { preferences: rest as any },
            });
          }
        } catch (err) {
          console.warn(
            '[auth] logout push_token clear failed:',
            (err as any)?.message || err
          );
        }
      }
    }
    return res.json({ ok: true });
  })
);

/**
 * DELETE /auth/account
 *
 * Self-serve account deletion. Required for GDPR Art. 17 ("right to erasure")
 * and CCPA § 1798.105. The request is idempotent: calling on an already-
 * deleted account returns 200 with a no-op.
 *
 * Behavior:
 *   1. Re-authenticate with current password (for password accounts). OAuth-
 *      only accounts can bypass this check since they don't hold a password.
 *   2. Anonymize PII fields in place — email, display_name, username, avatar,
 *      bio, preferences — using the user's own id as the anonymization seed
 *      so uniqueness constraints hold without collision.
 *   3. Soft-delete: set `deleted_at`, `deletion_anonymized=true`, and `banned`
 *      so auth middleware refuses further access even if a stale token leaks.
 *   4. Revoke all refresh tokens.
 *   5. Related rows (posts, messages, memberships, etc.) continue to exist
 *      under the anonymized user id. A scheduled hard-delete job will remove
 *      them after the retention window — that's a follow-up pass.
 *
 * Response: 200 { ok: true, deleted_at, already_deleted?: true }
 */
const deleteAccountSchema = z.object({
  password: z.string().optional(),
});
authRouter.post(
  '/account/delete',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = deleteAccountSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password_hash: true,
        deleted_at: true,
        deletion_anonymized: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'Not found' });

    // Idempotent: already deleted → return 200 with already_deleted flag.
    if (user.deleted_at || user.deletion_anonymized) {
      return res.json({
        ok: true,
        already_deleted: true,
        deleted_at: user.deleted_at?.toISOString(),
      });
    }

    // Re-authentication gate. Password accounts require the current password.
    // OAuth-only accounts (no password_hash) bypass — they've already proven
    // identity via the valid access token used to hit this endpoint.
    if (user.password_hash) {
      const suppliedPassword = parsed.data.password;
      if (!suppliedPassword) {
        return res.status(400).json({
          error: 'PASSWORD_REQUIRED',
          message: 'Password is required to delete your account.',
        });
      }
      const ok = await bcrypt.compare(suppliedPassword, user.password_hash);
      if (!ok) {
        return res.status(401).json({
          error: 'INVALID_PASSWORD',
          message: 'Password does not match.',
        });
      }
    }

    try {
      await assertCanSelfDeleteUser(userId);
    } catch (err) {
      if ((err as any)?.code === 'SOLE_ORG_OWNER') {
        return res.status(400).json({
          error: 'You are the sole owner of an organization. Transfer ownership before deleting your account.',
          code: 'SOLE_ORG_OWNER',
          organization_id: (err as any).organization_id,
        });
      }
      throw err;
    }

    const result = await softDeleteUserAccount(userId);

    await invalidateMeCacheForUser(userId).catch(() => {});

    console.log(`[auth] Account soft-deleted and anonymized: ${userId}`);

    return res.json({
      ok: true,
      deleted_at: result.deletedAt.toISOString(),
      ...(result.alreadyDeleted ? { already_deleted: true } : {}),
    });
  })
);

const googleAuthSchema = z.object({
  id_token: z.string().min(10),
});

authRouter.post(
  '/google',
  oauthLimiter,
  asyncHandler(async (req, res) => {
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    if (process.env.NODE_ENV === 'production' && GOOGLE_ALLOWED_AUDIENCES.length === 0) {
      console.error(
        '[auth/google] rejecting Google sign-in because GOOGLE_OAUTH_CLIENT_IDS is not configured'
      );
      return res.status(503).json({ error: 'Google sign-in is temporarily unavailable' });
    }

    const { id_token } = parsed.data;

    let stage = 'verify-token';
    try {
      // Stage 1: Verify token with google-auth-library (signature + expiry, cached public keys)
      let payload: any;
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: id_token,
          ...(GOOGLE_ALLOWED_AUDIENCES.length > 0 ? { audience: GOOGLE_ALLOWED_AUDIENCES } : {}),
        });
        payload = ticket.getPayload();
      } catch (verifyErr: any) {
        const msg = verifyErr?.message || String(verifyErr);
        console.error('[auth/google] verifyIdToken failed', { message: msg });
        captureException(verifyErr instanceof Error ? verifyErr : new Error(msg), {
          stage: 'verify-token',
        });
        // Distinguish audience mismatch from other failures
        if (
          msg.includes('audience') ||
          msg.includes('Token used too late') ||
          msg.includes('Invalid token')
        ) {
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
        console.warn('[auth/google] missing sub or email', {
          hasGoogleId: !!googleId,
          hasEmail: !!email,
        });
        return res.status(400).json({ error: 'Invalid Google credential' });
      }

      if (!emailVerified) {
        console.warn('[auth/google] email not verified', { email });
        return res.status(400).json({ error: 'Google account email is not verified' });
      }

      // Use Google profile name if available, otherwise null — don't use email prefix as display name
      const displayNameSource =
        typeof payload.name === 'string' && payload.name.trim().length ? payload.name.trim() : null;
      const avatarUrl = typeof payload.picture === 'string' ? payload.picture : null;

      // Stage 4: User lookup/creation
      stage = 'user-lookup';
      let user = await prisma.user.findUnique({ where: { google_id: googleId } });
      let created = false;

      // v1.0.2: Sync email/avatar from Google on re-auth. If the user changed their
      // Google email, the DB should reflect it since they're authenticating with that
      // Google account. Avatar updates only fill a blank avatar.
      if (user) {
        const syncUpdates: any = {};
        if (user.email !== email) {
          // Check that the new email isn't taken by another account
          const emailTaken = await prisma.user.findUnique({ where: { email } });
          if (!emailTaken) {
            syncUpdates.email = email;
            syncUpdates.email_verified = true;
          }
        }
        if (avatarUrl && !user.avatar_url) syncUpdates.avatar_url = avatarUrl;
        if (displayNameSource && !user.display_name) syncUpdates.display_name = displayNameSource;
        if (Object.keys(syncUpdates).length) {
          user = await prisma.user.update({ where: { id: user.id }, data: syncUpdates });
          await invalidateMeCacheForUser(user.id);
        }
      }

      if (!user) {
        stage = 'user-resolve';
        const existingByEmail = await prisma.user.findUnique({ where: { email } });

        if (existingByEmail) {
          stage = 'link-google';
          const currentPrefs = (existingByEmail as any)?.preferences || {};
          const prefPatch: Record<string, unknown> = {};
          if (typeof currentPrefs.role !== 'string') prefPatch.role = 'fan';
          if (typeof currentPrefs.onboarding_completed === 'undefined')
            prefPatch.onboarding_completed = false;
          const updates: any = {
            google_id: googleId,
            email_verified: true,
            email_verification_code: null,
            email_verification_expires: null,
          };
          if (avatarUrl && !existingByEmail.avatar_url) updates.avatar_url = avatarUrl;
          if (displayNameSource && !existingByEmail.display_name)
            updates.display_name = displayNameSource;
          if (Object.keys(prefPatch).length) {
            updates.preferences = mergeAuthStateIntoPreferences(
              mergePreferences(currentPrefs, prefPatch),
              {
                role: getCanonicalUserRole(existingByEmail as any),
                onboarding_completed: isUserOnboardingComplete(existingByEmail as any),
              }
            );
          }
          Object.assign(
            updates,
            buildAuthStateColumns({
              role: getCanonicalUserRole(existingByEmail as any),
              onboarding_completed: isUserOnboardingComplete(existingByEmail as any),
            })
          );
          user = await prisma.user.update({ where: { id: existingByEmail.id }, data: updates });
          await invalidateMeCacheForUser(user.id);
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
              preferences: mergeAuthStateIntoPreferences({}, {
                role: 'fan',
                onboarding_completed: false,
              }),
              role: 'fan',
              onboarding_completed: false,
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
        await invalidateMeCacheForUser(user.id);
      }

      // Stage 5: Generate JWT + refresh token
      stage = 'jwt';
      const sanitized = sanitizeUser(user);
      const access_token = signJwt({ id: sanitized.id });
      const needsOnboarding = !isUserOnboardingComplete(user as any);

      const rawRefresh = generateRefreshToken();
      const rtHash = hashRefreshToken(rawRefresh);
      const rtExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: {
          token_hash: rtHash,
          user_id: sanitized.id,
          expires_at: rtExpiry,
          device_info: req.headers['user-agent'] || null,
        },
      });

      // Include is_admin so AuthProvider knows admin status immediately
      const isOAuthAdmin = isAdminEmail(sanitized.email);
      return res.json({
        access_token,
        refresh_token: rawRefresh,
        user: {
          ...sanitized,
          email_verified: true,
          is_admin: isOAuthAdmin,
          ...(isOAuthAdmin ? { role: 'admin' } : {}),
        },
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
      captureException(err instanceof Error ? err : new Error(String(err?.message || err)), {
        stage,
        context: 'google-auth',
      });
      return res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
  })
);

const appleAuthSchema = z.object({
  identity_token: z.string().min(1),
});

authRouter.post(
  '/apple',
  oauthLimiter,
  asyncHandler(async (req, res) => {
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
        return res
          .status(401)
          .json({ error: 'Simulator tokens are not accepted in this environment' });
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
          return res
            .status(400)
            .json({ error: 'Failed to verify Apple token', detail: err?.message });
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
            where: { email: { equals: email, mode: 'insensitive' } },
          });
        }

        if (existingByEmail) {
          // Link Apple ID to existing account
          const currentPrefs = (existingByEmail as any)?.preferences || {};
          const prefPatch: Record<string, unknown> = {};
          if (typeof currentPrefs.role !== 'string') prefPatch.role = 'fan';
          if (typeof currentPrefs.onboarding_completed === 'undefined')
            prefPatch.onboarding_completed = false;

          const updates: any = {
            apple_id: appleId,
            email_verified: true,
            email_verification_code: null,
            email_verification_expires: null,
          };

          if (Object.keys(prefPatch).length) {
            updates.preferences = mergeAuthStateIntoPreferences(
              mergePreferences(currentPrefs, prefPatch),
              {
                role: getCanonicalUserRole(existingByEmail as any),
                onboarding_completed: isUserOnboardingComplete(existingByEmail as any),
              }
            );
          }
          Object.assign(
            updates,
            buildAuthStateColumns({
              role: getCanonicalUserRole(existingByEmail as any),
              onboarding_completed: isUserOnboardingComplete(existingByEmail as any),
            })
          );

          user = await prisma.user.update({ where: { id: existingByEmail.id }, data: updates });
          await invalidateMeCacheForUser(user.id);
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
                preferences: mergeAuthStateIntoPreferences({}, {
                  role: 'fan',
                  onboarding_completed: false,
                }),
                role: 'fan',
                onboarding_completed: false,
              },
            });
            created = true;
          } catch (createErr: any) {
            // Handle unique constraint violation (P2002) - user may have been created concurrently
            // or exists with different apple_id
            if (createErr?.code === 'P2002') {
              debugLog('[auth/apple] User already exists, linking Apple ID');
              const existingUser = await prisma.user.findFirst({
                where: { email: { equals: userEmail, mode: 'insensitive' } },
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
                await invalidateMeCacheForUser(user.id);
              } else {
                throw createErr; // Re-throw if we still can't find the user
              }
            } else {
              throw createErr;
            }
          }
        }
      }

      user = await ensureOAuthUserVerified(user);

      const sanitized = sanitizeUser(user);
      const access_token = signJwt({ id: sanitized.id });
      const needsOnboarding = !isUserOnboardingComplete(user as any);

      // Issue refresh token
      const appleRawRefresh = generateRefreshToken();
      const appleRtHash = hashRefreshToken(appleRawRefresh);
      const appleRtExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: {
          token_hash: appleRtHash,
          user_id: sanitized.id,
          expires_at: appleRtExpiry,
          device_info: req.headers['user-agent'] || null,
        },
      });

      const isAppleOAuthAdmin = isAdminEmail(sanitized.email);
      return res.json({
        access_token,
        refresh_token: appleRawRefresh,
        user: {
          ...sanitized,
          email_verified: true,
          is_admin: isAppleOAuthAdmin,
          ...(isAppleOAuthAdmin ? { role: 'admin' } : {}),
        },
        needs_onboarding: needsOnboarding,
        created,
      });
    } catch (err) {
      console.error('[auth/apple] unexpected error', err);
      return res.status(500).json({ error: 'Failed to authenticate with Apple' });
    }
  })
);

const passwordResetRequestSchema = z.object({ email: z.string().email() });

authRouter.post(
  '/password/forgot',
  passwordResetLimiter as any,
  asyncHandler(async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const email = parsed.data.email.trim().toLowerCase();

    // SECURITY: Rate limiting to prevent password reset abuse / enumeration
    if (!(await checkAuthRateLimit(`forgot:${email}`))) {
      // Return generic success to prevent timing-based enumeration
      return res.json({ ok: true });
    }

    debugLog('[password-reset] Looking for user:', email);
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    const payload: any = { ok: true };
    if (!user) {
      debugLog('[password-reset] No user found for:', email);
      return res.json(payload);
    }
    debugLog('[password-reset] User found:', user.id, user.email);

    const code = String(crypto.randomInt(100000, 999999)); // 6-digit cryptographically secure code
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    const codeHash = hashRefreshToken(code);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_code: codeHash,
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
      (req as any).log?.warn?.({ err: e }, 'Password reset email failed');
    }

    if (shouldExposeDevCodes) payload.dev_reset_code = code;
    return res.json(payload);
  })
);

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: passwordRequirement,
});

authRouter.post(
  '/password/reset',
  asyncHandler(async (req, res) => {
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

    const user = await prisma.user.findFirst({
      where: { email: { equals: sanitizedEmail, mode: 'insensitive' } },
    });
    if (!user || !user.password_reset_code || !user.password_reset_expires) {
      await recordResetFailure(sanitizedEmail);
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }
    if (new Date() > user.password_reset_expires) {
      await recordResetFailure(sanitizedEmail);
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }
    // v1.0.2 audit fix: use timingSafeEqual on the reset code comparison.
    // Previously `!==` leaked timing info, and only the submitted code was trimmed.
    const submittedCodeHash = hashRefreshToken(String(code).trim());
    const storedCodeHash = String(user.password_reset_code).trim();
    const codesMatch = (() => {
      if (submittedCodeHash.length !== storedCodeHash.length) return false;
      try {
        return crypto.timingSafeEqual(Buffer.from(submittedCodeHash), Buffer.from(storedCodeHash));
      } catch {
        return false;
      }
    })();
    if (!codesMatch) {
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
  })
);

const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordRequirement,
});

authRouter.post(
  '/password/change',
  authLimiter,
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { current_password, new_password } = parsed.data;

    // Get user with password hash
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    if (!user.password_hash)
      return res
        .status(400)
        .json({ error: 'No password set. Use OAuth login or set a password first.' });
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
  })
);

// Upgrade a fan account to coach
const upgradeToCoachSchema = z.object({
  plan: z.enum(['rookie', 'veteran', 'legend']),
});

// v1.0.2: 48hr cooldown for rejected coach/org applications.
const REJECTION_COOLDOWN_MS = 48 * 60 * 60 * 1000;

authRouter.post(
  '/upgrade-to-coach',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = upgradeToCoachSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { plan } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        preferences: true,
        approval_status: true,
        rejected_at: true,
        rejection_reason: true,
        date_of_birth: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentPrefs = (user.preferences as any) || {};
    const currentRole = getCanonicalUserRole(user as any);
    // If already a coach, reject
    if (currentRole === 'coach') {
      return res.status(400).json({ error: 'Account is already a coach account.' });
    }

    // v1.0.2: enforce 48hr cooldown on rejected applicants to prevent admin spam.
    // v1.0.2 pass 4: legacy users REJECTED before rejected_at was added (null column) would otherwise
    // bypass the cooldown entirely. Treat null rejected_at as "reject stamp unknown — apply cooldown
    // from right now and backfill" so they can't spam admins by exploiting the legacy-null state.
    if (user.approval_status === 'REJECTED') {
      let rejectedAt = user.rejected_at;
      if (!rejectedAt) {
        rejectedAt = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { rejected_at: rejectedAt },
        });
        await invalidateMeCacheForUser(user.id);
      }
      const elapsed = Date.now() - new Date(rejectedAt).getTime();
      if (Number.isFinite(elapsed) && elapsed < REJECTION_COOLDOWN_MS) {
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
    if (!isVerifiedAdult(user)) {
      return res.status(403).json({
        error: 'You must be at least 18 years old to become a coach.',
        code: 'AGE_REQUIREMENT',
      });
    }

    const isPaidPlan = plan === 'veteran' || plan === 'legend';

    // Update role to coach and reset onboarding so they complete coach steps.
    // Paid plans are deferred until checkout succeeds; store them in pending_plan
    // so approval + paywall middleware treat the account as unpaid until billing completes.
    // CRITICAL: Set approval_status to PENDING so the coach must go through the
    // approval flow (create/join org → admin approval) before accessing coach tools.
    const merged = {
      ...currentPrefs,
      role: 'coach',
      plan: isPaidPlan ? 'rookie' : plan,
      pending_plan: isPaidPlan ? plan : null,
      payment_pending: isPaidPlan,
      onboarding_completed: false,
    };
    const billingPatch = {
      plan: (isPaidPlan ? 'rookie' : plan) as 'rookie' | 'veteran' | 'legend',
      pending_plan: (isPaidPlan ? plan : null) as 'veteran' | 'legend' | null,
      payment_pending: isPaidPlan,
      payment_approved: false,
    };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: mergeBillingStateIntoPreferences(
          mergeAuthStateIntoPreferences(merged, {
            role: 'coach',
            onboarding_completed: false,
          }),
          billingPatch
        ),
        role: 'coach',
        onboarding_completed: false,
        ...buildBillingStateColumns(billingPatch),
        approval_status: 'PENDING',
        // v1.0.2: clear rejection tracking on fresh re-apply.
        rejected_at: null,
        rejection_reason: null,
      },
    });
    await invalidateMeCacheForUser(updated.id);

    return res.json({ ok: true, preferences: updated.preferences });
  })
);

// v1.0.2: POST /auth/skip-payment
// Allows a coach stuck with payment_pending=true to escape the paywall loop by
// downgrading to the free rookie plan. Clears payment_pending, pending_plan, and
// payment_approved so the AuthProvider redirect no longer fires.
authRouter.post(
  '/skip-payment',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        preferences: true,
        plan: true,
        pending_plan: true,
        payment_pending: true,
        payment_approved: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const prefs = (user.preferences as any) || {};

    if (!isPaymentPending(user as any)) {
      return res.json({ ok: true, message: 'No pending payment to skip.' });
    }

    const { payment_pending, payment_approved, pending_plan, ...restPrefs } = prefs;
    const nextPrefs = mergeBillingStateIntoPreferences(restPrefs, {
      plan: 'rookie',
      pending_plan: null,
      payment_pending: false,
      payment_approved: false,
    }) as Record<string, any>;
    delete nextPrefs.pending_plan;
    delete nextPrefs.payment_pending;
    delete nextPrefs.payment_approved;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        preferences: nextPrefs,
        ...buildBillingStateColumns({
          plan: 'rookie',
          pending_plan: null,
          payment_pending: false,
          payment_approved: false,
        }),
      },
    });
    await invalidateMeCacheForUser(updated.id);

    return res.json({ ok: true, preferences: updated.preferences });
  })
);

// v1.0.2: POST /auth/coach/reapply
// Rejected coaches can re-apply after 48hr cooldown. Resets approval_status to PENDING
// and clears rejection tracking. Does not touch role (already coach). Protected by REJECTION_COOLDOWN_MS.
authRouter.post(
  '/coach/reapply',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        preferences: true,
        approval_status: true,
        rejected_at: true,
        rejection_reason: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const prefs = (user.preferences as any) || {};
    const currentRole = getCanonicalUserRole(user as any);
    if (currentRole !== 'coach') {
      return res.status(400).json({
        error: 'Only coach accounts can re-apply. Upgrade to coach first.',
        code: 'NOT_COACH',
      });
    }
    if (user.approval_status !== 'REJECTED') {
      return res
        .status(400)
        .json({ error: 'Your application is not in a rejected state.', code: 'NOT_REJECTED' });
    }
    // v1.0.2 pass 4: handle legacy null rejected_at by backfilling the timestamp now,
    // preventing bypass via the legacy-null state.
    let rejectedAt2 = user.rejected_at;
    if (!rejectedAt2) {
      rejectedAt2 = new Date();
      await prisma.user.update({
        where: { id: user.id },
        data: { rejected_at: rejectedAt2 },
      });
      await invalidateMeCacheForUser(user.id);
    }
    const elapsed = Date.now() - new Date(rejectedAt2).getTime();
    if (Number.isFinite(elapsed) && elapsed < REJECTION_COOLDOWN_MS) {
      const retryAfterMs = REJECTION_COOLDOWN_MS - elapsed;
      return res.status(429).json({
        error: 'Please wait before re-applying.',
        code: 'REJECTION_COOLDOWN',
        retry_after_ms: retryAfterMs,
        retry_after_hours: Math.ceil(retryAfterMs / (60 * 60 * 1000)),
        reason: user.rejection_reason || null,
      });
    }
    // Reset to PENDING, clear rejection, force re-run of onboarding (org connect)
    const merged = { ...prefs, onboarding_completed: false, join_request_pending: false };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: mergeAuthStateIntoPreferences(merged, {
          role: 'coach',
          onboarding_completed: false,
        }),
        role: 'coach',
        onboarding_completed: false,
        approval_status: 'PENDING',
        rejected_at: null,
        rejection_reason: null,
      },
    });
    await invalidateMeCacheForUser(updated.id);
    return res.json({ ok: true, preferences: updated.preferences });
  })
);

authRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Cache-aside: check Redis first (TTL 60s)
    const cacheKey = `me:${req.user.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [rawUser, activePostCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      }),
      prisma.post.count({
        where: { author_id: req.user!.id },
      }),
    ]);
    const user = await ensureOAuthUserVerified(rawUser);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const is_admin = isAdminEmail(user.email);
    const defaults = {
      notifications: {
        game_event_reminders: false,
        team_updates: false,
        comments_upvotes: false,
        follows_notifications: true,
        messages_notifications: true,
      },
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
    const normalizedRole = is_admin ? 'admin' : getCanonicalUserRole(user as any);
    const requiredCoachAgreementVersion = Number(
      process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1
    );
    const payload = {
      ...safe,
      _count: {
        ...(safe as any)._count,
        posts: activePostCount,
      },
      has_password,
      role: normalizedRole,
      preferences: prefs,
      required_coach_agreement_version: requiredCoachAgreementVersion,
      is_admin,
    };
    void cacheSet(cacheKey, payload, 60); // 60s TTL
    return res.json(payload);
  })
);

const updateMeSchema = z.object({
  display_name: z
    .string()
    .min(1)
    .max(120)
    .refine(val => val.trim().length > 0, { message: 'Display name cannot be only whitespace' })
    .optional()
    .nullable(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_.]+$/, {
      message: 'Username can only contain lowercase letters, numbers, dots, and underscores',
    })
    .optional()
    .nullable(),
  avatar_url: z
    .string()
    .url({ message: 'Avatar URL must be a valid URL' })
    .refine(
      url => {
        try {
          const parsed = new URL(url);
          // Only allow https
          if (parsed.protocol !== 'https:') return false;
          // Allow specific domains (Cloudinary, etc.)
          const allowedDomains = [
            'res.cloudinary.com',
            'varsityhub.app',
            'cdn.varsityhub.app',
            'lh3.googleusercontent.com',
            'platform-lookaside.fbsbx.com',
            'graph.facebook.com',
          ];
          return allowedDomains.some(d => parsed.hostname.endsWith(d));
        } catch (error) {
          console.warn('[auth] Invalid avatar URL format:', error);
          return false;
        }
      },
      { message: 'Avatar URL must be from an allowed domain (Cloudinary or VarsityHub CDN)' }
    )
    .optional()
    .nullable(),
  bio: z
    .string()
    .max(300)
    .transform(val => (val === '' ? null : val))
    .optional()
    .nullable(),
});

authRouter.put(
  '/me',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
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
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }
    const data = parsed.data as any;
    let patch: any = { ...data };

    // Strip null values for fields that should not be cleared (treat null as "don't change")
    // bio and avatar_url CAN be null (user wants to clear them), but display_name/username should not be wiped
    if (patch.display_name === null) delete patch.display_name;
    if (patch.username === null) delete patch.username;

    // Validate username availability if provided
    let priorUsername: string | null = null;
    if (data.username) {
      const exists = await prisma.user.findFirst({
        where: {
          username: { equals: data.username, mode: 'insensitive' },
          NOT: { id: req.user!.id },
        },
        select: { id: true },
      });
      if (exists) {
        return res.status(400).json({
          error: 'Username taken',
          message: 'This username is already in use.',
        });
      }
      // v1.0.2 pass 9: capture prior username so we can rewrite mentions in posts/comments below.
      const me = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { username: true },
      });
      priorUsername = me?.username || null;
      patch.username = data.username;
    }
    if (data.bio != null && data.bio !== '') {
      const filterResult = validateContent({ content: data.bio });
      if (!filterResult.valid) {
        return res.status(400).json({ error: filterResult.error, code: filterResult.code });
      }
    }
    const { preferences, ...rest } = patch;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { ...rest, ...(preferences ? { preferences } : {}) },
    });
    await invalidateMeCacheForUser(req.user!.id);

    // v1.0.2 pass 9: rewrite @mentions in existing posts + comments so old @oldname becomes @newname.
    // Fire-and-forget so the user's response isn't blocked. Uses raw SQL for case-insensitive
    // word-boundary replace; safe because both names are validated against /^[a-z0-9_.]+$/.
    if (
      priorUsername &&
      data.username &&
      priorUsername.toLowerCase() !== data.username.toLowerCase()
    ) {
      const oldHandle = '@' + priorUsername;
      const newHandle = '@' + data.username;
      (async () => {
        try {
          // Postgres regexp_replace with word boundaries — safe (no user-controlled regex)
          await prisma.$executeRawUnsafe(
            `UPDATE "Post" SET content = regexp_replace(content, '\\m' || $1 || '\\M', $2, 'g')
           WHERE content ILIKE '%' || $1 || '%'`,
            oldHandle,
            newHandle
          );
          await prisma.$executeRawUnsafe(
            `UPDATE "Comment" SET content = regexp_replace(content, '\\m' || $1 || '\\M', $2, 'g')
           WHERE content ILIKE '%' || $1 || '%'`,
            oldHandle,
            newHandle
          );
        } catch (err: any) {
          console.error(
            '[auth] mention rewrite after username change failed:',
            err?.message || err
          );
        }
      })();
    }

    return res.json(sanitizeUser(user));
  })
);

// PATCH /me (alias) to support partial profile updates (preferences use /me/preferences)
authRouter.patch(
  '/me',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
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
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
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
          NOT: { id: req.user!.id },
        },
        select: { id: true },
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
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { ...rest, ...(prefs2 ? { preferences: prefs2 } : {}) },
    });
    await invalidateMeCacheForUser(req.user!.id);
    return res.json(sanitizeUser(user));
  })
);

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
    } else if (
      typeof incoming[key] === 'object' &&
      !Array.isArray(incoming[key]) &&
      incoming[key] !== null &&
      incoming[key].constructor === Object
    ) {
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
  'plan',
  'pending_plan',
  'paid_by_owner',
  'payment_pending',
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
authRouter.patch(
  '/me/preferences',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const schema = z
      .object({
        notifications: z
          .object({
            game_event_reminders: z.boolean().optional(),
            team_updates: z.boolean().optional(),
            comments_upvotes: z.boolean().optional(),
            follows_notifications: z.boolean().optional(),
            messages_notifications: z.boolean().optional(),
          })
          .partial()
          .optional(),
        is_parent: z.boolean().optional(),
        zip_code: z.string().min(2).max(20).optional().nullable(),
        onboarding_completed: z.boolean().optional(),

        // New onboarding fields
        plan: z.enum(['rookie', 'veteran', 'legend']).optional(),
        // Rookie is not a role
        role: z.enum(['fan', 'coach']).optional(),
        affiliation: z
          .enum([
            'none',
            'other',
            'school',
            'independent',
            'university',
            'high_school',
            'club',
            'youth',
            'professional',
          ])
          .optional(),
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
      })
      .partial();

    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    // SECURITY: Strip any protected keys the client tries to sneak in
    const incoming = stripProtectedKeys(parsed.data as any) as any;

    // Server-side normalize: when a client writes `coach_agreement_accepted_at`
    // (the accept action), stamp the CURRENT required version alongside it so
    // the client never has to know the version number. Without this, bumping
    // REQUIRED_COACH_AGREEMENT_VERSION env var would put coaches in a re-accept
    // loop because the client patch only writes the timestamp.
    if (incoming.coach_agreement_accepted_at !== undefined) {
      incoming.coach_agreement_version = Number(
        process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1
      );
    }

    // COPPA: Reject if DOB indicates under 13 - do not store
    if (incoming.dob !== undefined && isUnder13(incoming.dob)) {
      return res.status(403).json({
        error: 'COPPA_UNDER_13',
        message:
          'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
      });
    }
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        preferences: true,
        email: true,
        approval_status: true,
        date_of_birth: true,
        dob_set_at: true,
        role: true,
        onboarding_completed: true,
        organization_id: true,
        proceeding_as_fan: true,
        coach_agreement_accepted_at: true,
        coach_agreement_version: true,
      },
    });
    const currentPrefs = (current?.preferences as any) || {};
    const currentAuthState = getCanonicalAuthState(current as any);

    // Canonical DOB gate: once the column is set and the 24h grace window has
    // lapsed, DOB is locked to normal users. Admins can still update via admin
    // routes. Within-window edits and first-time writes both flow through
    // `evaluateDobUpdate`, which returns the Date object + timestamp to write.
    let patchDobColumnWrite: { date_of_birth: Date; dob_set_at?: Date } | null = null;
    if (incoming.dob !== undefined && incoming.dob !== null && incoming.dob !== '') {
      const decision = evaluateDobUpdate({
        currentDob: current?.date_of_birth ?? null,
        currentSetAt: current?.dob_set_at ?? null,
        incomingDob: incoming.dob,
      });
      if (!decision.ok) {
        if (decision.reason === 'dob_locked') {
          return res.status(403).json({
            error: 'DOB_LOCKED',
            message:
              'Your date of birth can only be changed within 24 hours of first setting it. Contact support to correct an error.',
          });
        }
        return res.status(400).json({
          error: 'INVALID_DOB',
          message: 'Date of birth is not a valid date.',
        });
      }
      if (decision.changed) {
        patchDobColumnWrite = {
          date_of_birth: decision.newDob,
          ...(decision.newSetAt ? { dob_set_at: decision.newSetAt } : {}),
        };
      }
    }

    // SECURITY: Prevent role changes after onboarding is completed.
    // The only legitimate path to change role post-onboarding is POST /auth/upgrade-to-coach.
    if (
      incoming.role &&
      currentAuthState.onboarding_completed === true &&
      incoming.role !== currentAuthState.role
    ) {
      return res.status(403).json({
        error:
          'Cannot change role after onboarding is complete. Use the upgrade-to-coach endpoint.',
      });
    }

    // v1.0.2 pass 6: SECURITY — prevent skipping onboarding by setting onboarding_completed=true
    // directly via PATCH. The legitimate path is POST /auth/complete-onboarding which validates
    // required fields. We allow clients to set it to `false` (restart flow) and to re-affirm `true`
    // if the server state already confirms it. Any other attempt is rejected.
    if (incoming.onboarding_completed === true && currentAuthState.onboarding_completed !== true) {
      // Require the same baseline fields /complete-onboarding checks for the user's role.
      const effectiveRole = incoming.role || currentAuthState.role || 'fan';
      const currentUserRec = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { username: true },
      });
      if (effectiveRole === 'coach') {
        const hasUsername = !!currentUserRec?.username || !!incoming.username;
        const hasOrgOrTeam = !!(
          currentAuthState.organization_id ||
          currentPrefs.team_id ||
          incoming.organization_id ||
          incoming.team_id
        );
        if (!hasUsername || !hasOrgOrTeam) {
          return res.status(400).json({
            error:
              'Cannot mark onboarding complete — required coach fields missing. Use POST /auth/complete-onboarding.',
            code: 'ONBOARDING_VALIDATION_REQUIRED',
          });
        }
      } else {
        // Fan minimum: must have a username on record
        if (!currentUserRec?.username) {
          return res.status(400).json({
            error:
              'Cannot mark onboarding complete — username missing. Use POST /auth/complete-onboarding.',
            code: 'ONBOARDING_VALIDATION_REQUIRED',
          });
        }
      }
    }

    // Server-side 18+ age gate for coaches (mirrors /upgrade-to-coach and /complete-onboarding)
    if (incoming.role === 'coach' && currentAuthState.role !== 'coach') {
      const adultEligible = isVerifiedAdult({
        date_of_birth: patchDobColumnWrite?.date_of_birth ?? current?.date_of_birth ?? null,
        preferences: {
          ...currentPrefs,
          ...(incoming.dob !== undefined ? { dob: incoming.dob } : {}),
        },
      });
      if (!adultEligible) {
        return res.status(403).json({
          error: 'You must be at least 18 years old to become a coach.',
          code: 'AGE_REQUIREMENT',
        });
      }
    }

    // SECURITY: If role is being set to 'coach' and user was not previously a coach,
    // force approval_status to PENDING atomically. This ensures requireOnboarded
    // blocks all coach tools until an admin or org owner explicitly approves.
    // We do this in the same update below to avoid race conditions.
    const forceApprovalPending = incoming.role === 'coach' && currentAuthState.role !== 'coach';

    // Check if user is admin (same logic as GET /me endpoint)
    const is_admin = isAdminEmail(current?.email);
    const defaults = {
      notifications: {
        game_event_reminders: false,
        team_updates: false,
        comments_upvotes: false,
        follows_notifications: true,
        messages_notifications: true,
      },
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
    const authStatePatch: Record<string, unknown> = {};
    if (incoming.role !== undefined) authStatePatch.role = incoming.role;
    if (incoming.onboarding_completed !== undefined) {
      authStatePatch.onboarding_completed = incoming.onboarding_completed;
    }
    if (incoming.organization_id !== undefined) authStatePatch.organization_id = incoming.organization_id;
    if (incoming.proceeding_as_fan !== undefined) {
      authStatePatch.proceeding_as_fan = incoming.proceeding_as_fan;
    }
    if (incoming.coach_agreement_accepted_at !== undefined) {
      authStatePatch.coach_agreement_accepted_at = incoming.coach_agreement_accepted_at || null;
    }
    if (incoming.coach_agreement_version !== undefined) {
      authStatePatch.coach_agreement_version = incoming.coach_agreement_version ?? null;
    }
    const dualWrittenPreferences = mergeAuthStateIntoPreferences(merged, authStatePatch);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        preferences: dualWrittenPreferences,
        ...buildAuthStateColumns(authStatePatch),
        ...(forceApprovalPending ? { approval_status: 'PENDING' } : {}),
        ...(patchDobColumnWrite
          ? deriveParentalConsentFields(patchDobColumnWrite.date_of_birth)
          : {}),
        ...(patchDobColumnWrite ?? {}),
      },
    });

    // Invalidate profile cache so GET /me returns fresh data immediately
    await invalidateMeCacheForUser(req.user!.id);

    // Invalidate the private-IDs feed cache when a user toggles profile_private
    if (incoming.profile_private !== undefined) {
      invalidatePrivateIdsCache();
    }

    return res.json({ preferences: updated.preferences });
  })
);

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  // Core identity fields
  // Rookie is not a role
  role: z.enum(['fan', 'coach']).optional(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(
      /^[a-z0-9_.]+$/,
      'Username must contain only lowercase letters, numbers, dots, and underscores'
    )
    .optional(),
  display_name: z
    .string()
    .min(1)
    .max(120)
    .refine(val => val.trim().length > 0, { message: 'Display name cannot be only whitespace' })
    .optional(),
  affiliation: z
    .enum([
      'none',
      'other',
      'university',
      'high_school',
      'club',
      'youth',
      'school',
      'independent',
      'professional',
    ])
    .optional(),
  dob: z.string().optional(),
  // For 13-17 minors, parent_email is required to initiate the consent flow.
  // For adults and under-13 (rejected at COPPA gate), it's ignored.
  parent_email: z.string().email().max(320).optional(),
  zip: z.string().optional(),
  zip_code: z.string().optional(),

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
  avatar_url: z
    .string()
    .url()
    .refine(
      url => {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:') return false;
          const allowedDomains = [
            'res.cloudinary.com',
            'varsityhub.app',
            'cdn.varsityhub.app',
            'lh3.googleusercontent.com',
            'platform-lookaside.fbsbx.com',
            'graph.facebook.com',
          ];
          return allowedDomains.some(d => parsed.hostname.endsWith(d));
        } catch {
          return false;
        }
      },
      { message: 'Avatar must be an HTTPS URL from an allowed domain' }
    )
    .optional(),
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

authRouter.post(
  '/me/complete-onboarding',
  authLimiter,
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = completeOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[Onboarding] Validation failed:', parsed.error);
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    const data = parsed.data;

    // COPPA: Reject if DOB indicates under 13 - do not store
    if (data.dob !== undefined && isUnder13(data.dob)) {
      return res.status(403).json({
        error: 'COPPA_UNDER_13',
        message:
          'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
      });
    }

    // Get current preferences FIRST to preserve role if not in payload
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        preferences: true,
        approval_status: true,
        date_of_birth: true,
        dob_set_at: true,
        role: true,
        onboarding_completed: true,
        organization_id: true,
        proceeding_as_fan: true,
        plan: true,
        pending_plan: true,
        payment_pending: true,
        payment_approved: true,
      },
    });
    const currentPrefs = (current?.preferences as any) || {};
    const currentAuthState = getCanonicalAuthState(current as any);

    // COPPA gate: onboarding cannot complete without a canonical DOB. The
    // helper `isMinor()` fails closed for null DOB, but the real defense is
    // here — `onboarding_completed === true` must GUARANTEE a non-null
    // `date_of_birth`. Either the payload provides a new DOB or the user
    // already has one from registration / an earlier onboarding attempt.
    const willHaveDob =
      (data.dob !== undefined && data.dob !== null && data.dob !== '') ||
      current?.date_of_birth !== null;
    if (!willHaveDob) {
      return res.status(400).json({
        error: 'DOB_REQUIRED',
        message: 'Date of birth is required to complete onboarding.',
      });
    }

    // Canonical DOB gate — same grace-window logic as PATCH /me/preferences.
    let onboardingDobColumnWrite: { date_of_birth: Date; dob_set_at?: Date } | null = null;
    if (data.dob !== undefined && data.dob !== null && data.dob !== '') {
      const decision = evaluateDobUpdate({
        currentDob: current?.date_of_birth ?? null,
        currentSetAt: current?.dob_set_at ?? null,
        incomingDob: data.dob,
      });
      if (!decision.ok) {
        if (decision.reason === 'dob_locked') {
          return res.status(403).json({
            error: 'DOB_LOCKED',
            message:
              'Your date of birth can only be changed within 24 hours of first setting it. Contact support to correct an error.',
          });
        }
        return res.status(400).json({
          error: 'INVALID_DOB',
          message: 'Date of birth is not a valid date.',
        });
      }
      if (decision.changed) {
        onboardingDobColumnWrite = {
          date_of_birth: decision.newDob,
          ...(decision.newSetAt ? { dob_set_at: decision.newSetAt } : {}),
        };
      }
    }

    // Detect if this user is a 13-17 minor after applying any pending DOB
    // change. If so, parental consent must be initiated. The check runs against
    // the PROSPECTIVE DOB (post-update) so a first-time DOB set in this call
    // immediately triggers the consent requirement rather than waiting for the
    // next request.
    const prospectiveDob =
      onboardingDobColumnWrite?.date_of_birth ?? current?.date_of_birth ?? null;
    const minorRequiringConsent = requiresParentalConsent({
      date_of_birth: prospectiveDob,
      preferences: { ...currentPrefs, ...(data.dob !== undefined ? { dob: data.dob } : {}) },
    });
    if (minorRequiringConsent) {
      // Parent email is required exactly once, at the point we detect a minor.
      // Subsequent re-calls (e.g. resend flow) skip this because the user's
      // parental_consent_status will already be pending/approved.
      // TypeScript: `parent_email` lives on User but the Prisma client for this
      // checkout may not yet expose it; the runtime behavior is correct and
      // the cast narrows the field access only.
      const existingParentEmail = (current as any)?.parent_email as string | null | undefined;
      const providedParentEmail = data.parent_email?.trim().toLowerCase();
      const effectiveParentEmail = providedParentEmail || existingParentEmail || null;
      if (!effectiveParentEmail) {
        return res.status(400).json({
          error: 'PARENT_EMAIL_REQUIRED',
          message:
            'A parent or guardian email is required to complete onboarding for users under 18.',
        });
      }
    }

    // CRITICAL: Role MUST be preserved from onboarding step-1 or provided in payload
    // If role is undefined in payload, use existing role from preferences (set during step-1)
    const finalRole = data.role !== undefined ? data.role : currentAuthState.role || 'fan';

    // Server-side 18+ age gate for coaches (mirrors /upgrade-to-coach validation)
    if (finalRole === 'coach') {
      const adultEligible = isVerifiedAdult({
        date_of_birth: onboardingDobColumnWrite?.date_of_birth ?? current?.date_of_birth ?? null,
        preferences: {
          ...currentPrefs,
          ...(data.dob !== undefined ? { dob: data.dob } : {}),
        },
      });
      if (!adultEligible) {
        return res.status(403).json({
          error: 'You must be at least 18 years old to become a coach.',
          code: 'AGE_REQUIREMENT',
        });
      }
    }

    // CRITICAL: For coaches, validate required steps are completed
    // Fall back to existing DB values for retry scenarios where payload may be incomplete
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    // Billing-owned state must come from payment/server flows, never this endpoint.
    const persistedPlan = getCanonicalPlan(current as any);
    if (finalRole === 'coach') {
      const effectiveUsername = data.username || currentUser?.username;
      const effectivePlan = getSelectedPlan(current as any);
      const effectiveOrgId = data.organization_id || currentAuthState.organization_id;
      const effectiveTeamId = data.team_id || currentPrefs.team_id;
      if (!effectiveUsername) {
        return res.status(400).json({ error: 'Username required for coach onboarding' });
      }
      if (!effectivePlan) {
        return res.status(400).json({ error: 'Plan selection required for coach onboarding' });
      }
      if (!effectiveTeamId && !effectiveOrgId) {
        return res
          .status(400)
          .json({ error: 'Team or organization required for coach onboarding' });
      }
      // Use DB values as fallback if not in payload
      if (!data.username && effectiveUsername) data.username = effectiveUsername;
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
      plan: persistedPlan,
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
      proceeding_as_fan: data.proceeding_as_fan,
    };

    // CRITICAL: Role must NEVER be undefined - preserve from current preferences if not in payload
    // This ensures OAuth-created users (who start as 'fan') can properly become 'coach' during onboarding
    if (preferencesUpdate.role === undefined) {
      preferencesUpdate.role = currentAuthState.role || 'fan'; // Use existing role or default to fan
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
    const merged = stripProtectedKeys(
      mergePreferences(normalizedCurrent || {}, preferencesUpdate)
    ) as any;
    merged.plan = persistedPlan;
    const onboardingAuthPatch = {
      role: finalRole,
      onboarding_completed: true,
      organization_id:
        data.organization_id !== undefined
          ? data.organization_id || null
          : (currentAuthState.organization_id ?? null),
      proceeding_as_fan:
        data.proceeding_as_fan !== undefined
          ? data.proceeding_as_fan
          : isProceedingAsFan(current as any),
    };
    updateData.preferences = mergeAuthStateIntoPreferences(merged, onboardingAuthPatch);
    Object.assign(updateData, buildAuthStateColumns(onboardingAuthPatch));

    // SECURITY: If completing onboarding as coach, ensure approval_status is PENDING
    // This prevents a fan from completing onboarding with role='coach' and retaining APPROVED status
    // v1.0.2: Also guard against overwriting an already-APPROVED status from a stale client call
    if (
      finalRole === 'coach' &&
      currentAuthState.role !== 'coach' &&
      current?.approval_status !== 'APPROVED'
    ) {
      updateData.approval_status = 'PENDING';
    }

    // Persist parent_email when we detected a minor — stored alongside the
    // canonical DOB so the consent flow (below) has the address to email.
    const parentEmailToPersist = minorRequiringConsent
      ? data.parent_email?.trim().toLowerCase() || null
      : null;

    // Update user
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...updateData,
        ...(onboardingDobColumnWrite
          ? deriveParentalConsentFields(onboardingDobColumnWrite.date_of_birth)
          : {}),
        ...(onboardingDobColumnWrite ?? {}),
        ...(parentEmailToPersist ? { parent_email: parentEmailToPersist } : {}),
      } as any,
    });
    await invalidateMeCacheForUser(updated.id);

    // Kick off the parental-consent email if this is a 13-17 minor who does
    // not already have an active consent token outstanding. Fire-and-forget
    // so email provider hiccups don't 500 the onboarding request — the
    // resend endpoint handles recovery if the email fails to arrive.
    if (minorRequiringConsent) {
      void (async () => {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: updated.id },
            select: {
              parent_email: true,
              display_name: true,
              email: true,
              parental_consent_status: true,
              parental_consent_token_hash: true,
            } as any,
          });
          const freshAny = fresh as any;
          if (!freshAny) return;
          if (freshAny.parental_consent_status !== 'pending') return;
          if (freshAny.parental_consent_token_hash) return; // active link exists, don't re-issue
          if (!freshAny.parent_email) return;

          const { issueConsentToken } = await import('../lib/parentalConsent.js');
          const rawToken = await issueConsentToken(updated.id);
          const { sendParentalConsentRequestEmail } = await import('../lib/email.js');
          await sendParentalConsentRequestEmail({
            to: freshAny.parent_email,
            minorDisplayName: freshAny.display_name || undefined,
            minorEmail: freshAny.email,
            consentToken: rawToken,
            expiresInDays: 14,
          });
        } catch (err) {
          console.error(
            '[auth] Failed to send parental consent request:',
            (err as any)?.message || err
          );
        }
      })();
    }

    // Fire-and-forget: notify ALL admins about new coach application
    if (finalRole === 'coach' && updateData.approval_status === 'PENDING') {
      const { getAllAdminEmails } = await import('../lib/adminEmails.js');
      const adminEmails = getAllAdminEmails();
      for (const adminEmail of adminEmails) {
        sendCoachApplicationAdminEmail({
          to: adminEmail,
          applicantName: updated.display_name || updated.email,
          applicantEmail: updated.email,
        }).catch(err => {
          console.error(
            '[auth] Failed to send coach-application admin notification to',
            adminEmail,
            err?.message || err
          );
        });
      }
    }

    return res.json({
      message: 'Onboarding completed successfully',
      user: sanitizeUser(updated),
    });
  })
);

// Request a new email verification code (authenticated)
authRouter.post(
  '/verify/request',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const rawUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const user = await ensureOAuthUserVerified(rawUser);
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
    if (process.env.NODE_ENV === 'development')
      console.log(
        `[verify-code] [verify/request] Code generated: ${code} for user ${user.id} (${user.email})`
      );
    const exp = new Date(Date.now() + 30 * 60 * 1000);
    // AUTH-5: Hash verification code before storage (same SHA-256 as refresh tokens)
    const codeHash = hashRefreshToken(code);
    await prisma.user.update({
      where: { id: user.id },
      data: { email_verification_code: codeHash, email_verification_expires: exp },
    });
    if (process.env.NODE_ENV === 'development')
      console.log(
        `[verify-code] [verify/request] Code hash stored in DB (expires ${exp.toISOString()})`
      );
    try {
      if (process.env.NODE_ENV === 'development')
        console.log(
          `[verify-code] [verify/request] Calling sendVerificationEmail → to: ${user.email}`
        );
      const sent = await sendVerificationEmail(
        user.email,
        code,
        user.display_name || user.email.split('@')[0]
      );
      if (!sent) {
        console.error(
          '[verify-code] [verify/request] sendVerificationEmail returned false — email was NOT sent (check SendGridProvider logs above for the specific error)'
        );
      } else {
        console.log(
          '[verify-code] [verify/request] sendVerificationEmail returned true — email accepted by SendGrid'
        );
      }
    } catch (e) {
      console.error('[verify-code] [verify/request] sendVerificationEmail threw:', e);
      (req as any).log?.warn?.({ err: e }, 'Email send failed');
    }
    const payload: any = { ok: true };
    if (shouldExposeDevCodes) payload.dev_verification_code = code;
    await rlSet(verifyLastKey, String(Date.now()), 30_000);
    return res.json(payload);
  })
);

// Alias: /auth/verify/send
authRouter.post(
  '/verify/send',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    (authRouter as any).handle({ ...req, url: '/verify/request' }, res);
  })
);

// Verify code (authenticated)
authRouter.post(
  '/verify/confirm',
  verificationConfirmLimiter,
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const schema = z.object({ code: z.string().min(4).max(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { code } = parsed.data;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.email_verified) return res.json({ ok: true, already_verified: true });
    if (!user.email_verification_code || !user.email_verification_expires)
      return res.status(400).json({ error: 'No verification in progress' });
    if (new Date() > user.email_verification_expires)
      return res.status(400).json({ error: 'Code expired' });
    // AUTH-5: Compare hash of submitted code against stored hash
    if (hashRefreshToken(String(code)) !== String(user.email_verification_code))
      return res.status(400).json({ error: 'Invalid code' });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        email_verification_code: null,
        email_verification_expires: null,
      },
    });
    await invalidateMeCacheForUser(updated.id);
    return res.json({ ok: true, user: sanitizeUser(updated) });
  })
);

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
  const normalizedDob = formatDobYmd(getCanonicalDob(rest));
    const normalizedPreferences =
      rest.preferences && typeof rest.preferences === 'object' && !Array.isArray(rest.preferences)
        ? { ...(rest.preferences as Record<string, unknown>) }
        : {};
  const canonicalAuthState = getCanonicalAuthState(rest);
  const canonicalBillingState = getCanonicalBillingState(rest);
  normalizedPreferences.role = canonicalAuthState.role;
  normalizedPreferences.onboarding_completed = canonicalAuthState.onboarding_completed;
  if (canonicalAuthState.organization_id) {
    normalizedPreferences.organization_id = canonicalAuthState.organization_id;
  } else {
    delete normalizedPreferences.organization_id;
  }
  normalizedPreferences.proceeding_as_fan = canonicalAuthState.proceeding_as_fan;
  if (canonicalAuthState.coach_agreement_accepted_at) {
    normalizedPreferences.coach_agreement_accepted_at =
      canonicalAuthState.coach_agreement_accepted_at instanceof Date
        ? canonicalAuthState.coach_agreement_accepted_at.toISOString()
        : canonicalAuthState.coach_agreement_accepted_at;
  } else {
    delete normalizedPreferences.coach_agreement_accepted_at;
  }
  if (canonicalAuthState.coach_agreement_version !== null) {
    normalizedPreferences.coach_agreement_version = canonicalAuthState.coach_agreement_version;
  } else {
    delete normalizedPreferences.coach_agreement_version;
  }
  normalizedPreferences.plan = canonicalBillingState.plan;
  normalizedPreferences.pending_plan = canonicalBillingState.pending_plan;
  normalizedPreferences.payment_pending = canonicalBillingState.payment_pending;
  normalizedPreferences.payment_approved = canonicalBillingState.payment_approved;
  if (normalizedDob) {
    normalizedPreferences.dob = normalizedDob;
  }
  const aliasKeys = [
    'zip_code',
    'location',
    'affiliation',
    'header_image_url',
    'header_image_focus_y',
    'theme_color',
    'sports_interests',
    'primary_sport',
  ] as const;
  const topLevelAliases = Object.fromEntries(
    aliasKeys
      .filter(key => rest[key] === undefined && normalizedPreferences[key] !== undefined)
      .map(key => [key, normalizedPreferences[key]])
  );
  return {
    ...rest,
    ...topLevelAliases,
    preferences: normalizedPreferences,
    role: canonicalAuthState.role,
    onboarding_completed: canonicalAuthState.onboarding_completed,
    organization_id: canonicalAuthState.organization_id,
    proceeding_as_fan: canonicalAuthState.proceeding_as_fan,
    coach_agreement_accepted_at: canonicalAuthState.coach_agreement_accepted_at,
    coach_agreement_version: canonicalAuthState.coach_agreement_version,
    plan: canonicalBillingState.plan,
    pending_plan: canonicalBillingState.pending_plan,
    payment_pending: canonicalBillingState.payment_pending,
    payment_approved: canonicalBillingState.payment_approved,
    dob: normalizedDob,
    date_of_birth: normalizedDob,
  };
}

// Test email endpoint (development only)
authRouter.post(
  '/test-email',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
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
  })
);

export default authRouter;
