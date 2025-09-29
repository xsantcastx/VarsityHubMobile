import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { signJwt } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const authRouter = Router();
// simple in-memory rate limiting for verification send: 1/30s, 5/hour per user
const verifyRate: Map<string, { last: number; count: number; hourStart: number }> = new Map();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().optional(),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, password, display_name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const password_hash = await bcrypt.hash(password, 10);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const exp = new Date(Date.now() + 30 * 60 * 1000);
  const user = await prisma.user.create({ data: { email, password_hash, display_name, email_verified: false, email_verification_code: code, email_verification_expires: exp } });
  const access_token = signJwt({ id: user.id });
  try { 
    console.log('[email] Sending verification email to:', email);
    await sendVerificationEmail(email, code); 
    console.log('[email] Verification email sent successfully');
  } catch (e) { 
    console.error('[email] Email send failed:', e);
    req.log?.warn?.({ err: e }, 'Email send failed; returning code in dev'); 
  }
  const payload: any = { access_token, user: sanitizeUser(user) };
  if (process.env.NODE_ENV !== 'production') payload.dev_verification_code = code;
  return res.status(201).json(payload);
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({ error: 'Account banned' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const access_token = signJwt({ id: user.id });
  const body: any = { access_token, user: sanitizeUser(user) };
  if (!user.email_verified) body.needs_verification = true;
  return res.json(body);
});

const passwordResetRequestSchema = z.object({ email: z.string().email() });

authRouter.post('/password/forgot', async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const email = parsed.data.email.trim();
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  const payload: any = { ok: true };
  if (!user) return res.json(payload);

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
    console.log('[email] Sending password reset email to:', user.email);
    await sendPasswordResetEmail(user.email, code);
    console.log('[email] Password reset email sent successfully');
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
    onboarding_completed: true,
  };
  const prefs = mergePreferences(defaults, (user as any).preferences || {});
  const { password_hash, ...rest } = user as any;
  return res.json({ ...rest, preferences: prefs, is_admin });
});

const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  preferences: z.any().optional(),
});

authRouter.put('/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = updateMeSchema.safeParse(req.body);
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
authRouter.patch('/me', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = updateMeSchema.safeParse(req.body);
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

// Utility to deep-merge preferences, preserving nested notification keys
function mergePreferences(base: any, incoming: any) {
  const out = { ...(base || {}), ...(incoming || {}) };
  if (base?.notifications || incoming?.notifications) {
    out.notifications = { ...(base?.notifications || {}), ...(incoming?.notifications || {}) };
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
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const incoming = parsed.data as any;
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const defaults = {
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
    is_parent: false,
    zip_code: null,
    onboarding_completed: true,
    plan: 'rookie',
    role: 'fan',
    sports_interests: [],
    personalization_goals: [],
    primary_intents: [],
    location_enabled: false,
    notifications_enabled: true,
    messaging_policy_accepted: false,
  };
  const merged = mergePreferences(defaults, mergePreferences(current?.preferences || {}, incoming));
  const updated = await prisma.user.update({ where: { id: req.user.id }, data: { preferences: merged } });
  return res.json({ preferences: updated.preferences });
});

// Complete onboarding endpoint
const completeOnboardingSchema = z.object({
  role: z.enum(['fan', 'coach']).optional(),
  plan: z.enum(['rookie', 'veteran', 'legend']).optional(),
  username: z.string().min(3).max(20).optional(),
  affiliation: z.enum(['school', 'independent']).optional(),
  dob: z.string().optional(),
  zip: z.string().optional(),
  team_name: z.string().optional(),
  organization_name: z.string().optional(),
  sport: z.string().optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  sports_interests: z.array(z.string()).optional(),
  personalization_goals: z.array(z.string()).optional(),
  location_enabled: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  messaging_policy_accepted: z.boolean().optional(),
});

authRouter.post('/me/complete-onboarding', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = completeOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  const data = parsed.data;
  
  // Update user with direct fields
  const updateData: any = {};
  if (data.username) updateData.username = data.username;
  
  // Prepare preferences update
  const preferencesUpdate: any = {
    onboarding_completed: true,
    role: data.role,
    plan: data.plan,
    affiliation: data.affiliation,
    dob: data.dob,
    zip_code: data.zip,
    sports_interests: data.sports_interests,
    personalization_goals: data.personalization_goals,
    primary_intents: data.personalization_goals, // Alias
    location_enabled: data.location_enabled,
    notifications_enabled: data.notifications_enabled,
    messaging_policy_accepted: data.messaging_policy_accepted,
  };
  
  // Clean up undefined values
  Object.keys(preferencesUpdate).forEach(key => {
    if (preferencesUpdate[key] === undefined) {
      delete preferencesUpdate[key];
    }
  });
  
  // Get current preferences and merge
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const merged = mergePreferences(current?.preferences || {}, preferencesUpdate);
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
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || 'no-reply@example.com';
  if (!host || !user || !pass || !port) {
    console.log(`[dev] Email verification code for ${to}: ${code}`);
    return;
  }
  const nodemailerModule = await import('nodemailer');
  const nodemailer = (nodemailerModule as any).default ?? nodemailerModule;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } } as any);
  await transporter.sendMail({
    from,
    to,
    subject: 'Verify your email',
    text: `Your VarsityHub verification code is ${code}.`,
  });
  console.log(`Verification email sent to ${to}`);
}






async function sendPasswordResetEmail(to: string, code: string) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || 'no-reply@example.com';
  if (!host || !user || !pass || !port) {
    console.log(`[dev] Password reset code for ${to}: ${code}`);
    return;
  }
  const nodemailerModule = await import('nodemailer');
  const nodemailer = (nodemailerModule as any).default ?? nodemailerModule;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } } as any);
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your VarsityHub password',
    text: `Use code ${code} to reset your VarsityHub password. This code expires in 30 minutes.`,
  });
  console.log(`Password reset email sent to ${to}`);
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

export default authRouter;
