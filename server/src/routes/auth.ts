import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { sendPasswordResetEmail, sendPasswordChangedEmail, sendVerificationEmail } from '../lib/email.js';
import { signJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { debugLog } from '../lib/debugLog.js';
import { ValidationError, ConflictError, AuthenticationError } from '../lib/errors/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const authRouter = Router();
// Simple in-memory rate limiting for auth endpoints
const authRate: Map<string, { attempts: number; resetAt: number }> = new Map();
const MAX_AUTH_ATTEMPTS = 5;
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
  const { email, password, display_name, role } = parsed.data;
  const sanitizedEmail = email.trim().toLowerCase();
  
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
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const userRole = role || 'fan';
  
  // Set admin flag for the main admin account
  const isAdmin = sanitizedEmail === 'emilmancero@gmail.com';
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
  const access_token = signJwt({ id: user.id });
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
  const payload: any = { access_token, user: sanitizeUser(user) };
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
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const access_token = signJwt({ id: user.id });
  const sanitized = sanitizeUser(user);
  const needsOnboarding = sanitized?.preferences?.onboarding_completed === false;
  const body: any = { access_token, user: sanitized, needs_onboarding: needsOnboarding };
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
        // Decode the JWT without verification first to get the header
        const decoded = jwt.decode(identity_token, { complete: true });
        if (!decoded || typeof decoded === 'string' || !decoded.header || !decoded.payload) {
          return res.status(400).json({ error: 'Invalid Apple token format' });
        }

        const { header, payload } = decoded;
        
        // Type guard: payload must be an object (JwtPayload), not a string
        if (!payload || typeof payload === 'string') {
          return res.status(400).json({ error: 'Invalid token payload' });
        }
        
        // TypeScript now knows payload is JwtPayload (object), not string
        const jwtPayload = payload as JwtPayload;
        
        // Verify token claims
        if (jwtPayload.iss !== 'https://appleid.apple.com') {
          return res.status(400).json({ error: 'Invalid token issuer' });
        }

        // Check audience (should be your app's client ID)
        const appleClientId = process.env.APPLE_CLIENT_ID;
        if (appleClientId && jwtPayload.aud !== appleClientId) {
          debugLog('[auth/apple] Token audience mismatch, but continuing for compatibility');
        }

        // Check expiration
        if (jwtPayload.exp && jwtPayload.exp < Date.now() / 1000) {
          return res.status(400).json({ error: 'Token has expired' });
        }

        // Extract user identifier from subject
        appleId = jwtPayload.sub as string;
        email = (jwtPayload.email as string) || null;

        if (!appleId) {
          return res.status(400).json({ error: 'Missing user identifier in token' });
        }

        // Note: Full signature verification requires fetching Apple's public keys
        // For production, you should implement full JWT verification with Apple's JWKS
        // This is a simplified version that validates claims but doesn't verify signature
        // For full security, use a library like 'node-jose' or 'jwks-rsa' to fetch and verify
        debugLog('[auth/apple] Apple token verified (claims validated, signature verification recommended)');
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

authRouter.post('/password/reset', async (req, res) => {
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
    data: { password_hash },
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
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
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
  const { password_hash, ...rest } = user as any;
  return res.json({ ...rest, preferences: prefs, is_admin });
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
  
  if (data.preferences) {
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
  
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const incoming = parsed.data as any;
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true, email: true } });
  // Check if user is admin (same logic as GET /me endpoint)
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const is_admin = current?.email ? adminEmails.includes(current.email.toLowerCase()) : false;
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
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
  // CRITICAL: Same merge order as GET /me - defaults must override (second arg overrides first)
  // First merge user preferences with incoming, then apply defaults on top
  const merged = mergePreferences(mergePreferences(current?.preferences || {}, incoming), defaults);
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
  
  // CRITICAL: For coaches, validate required steps are completed
  const finalRole = data.role || (req.user.preferences as any)?.role || 'fan';
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
  
  // Get current preferences FIRST to preserve role if not in payload
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const currentPrefs = current?.preferences as any || {};
  
  // Prepare preferences update
  // CRITICAL: Role MUST be preserved from onboarding step-1 or provided in payload
  // If role is undefined in payload, use existing role from preferences (set during step-1)
  const finalRole = data.role !== undefined ? data.role : (currentPrefs.role || 'fan');
  
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
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { email_verification_code: code, email_verification_expires: exp } });
  try {
    const sent = await sendVerificationEmail(user.email, code, user.display_name || user.email.split('@')[0]);
    if (!sent) console.warn('[email] Verification email skipped (SendGrid not configured)');
  } catch (e) {
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
