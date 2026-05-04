import crypto from 'node:crypto';
import escapeHtml from 'escape-html';
import express, { type Request, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendVerificationEmail } from '../lib/email.js';
import { hashRefreshToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const publicAppHandoffRouter = Router();
const handoffPageStyle = `body{font-family:-apple-system,Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{color:#1B3A6B}h2{color:#2563eb;margin-top:24px}a{color:#2563eb}`;
const APP_SCHEME = (process.env.APP_SCHEME || 'varsityhubmobile').replace(/:.*$/, '');
const publicVerifyResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many verification resend attempts. Please try again later.',
});

type VerifyHandoffState =
  | { kind: 'valid'; email: string; code: string }
  | { kind: 'expired'; email: string; code: string }
  | { kind: 'already_verified'; email: string }
  | { kind: 'invalid'; email: string | null };

type ResetHandoffState =
  | { kind: 'valid'; email: string; code: string }
  | { kind: 'expired'; email: string; code: string }
  | { kind: 'invalid'; email: string | null };

function noStore(_req: Request, res: express.Response, next: express.NextFunction) {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');
  next();
}

function buildNativeHandoffUrl(pathname: string, req: Request): string {
  return buildNativeHandoffUrlFromQuery(pathname, req.query || {});
}

// Strict allowlist for query params forwarded into the native scheme URL.
// Without this, attacker-controlled params (`?redirect_override=...`,
// `?next=...`) get piped into the deep-link parser, which may interpret
// them as routing intent. Verify/reset links and payment handoff routes
// only forward the minimal params the native screens require.
const ALLOWED_HANDOFF_QUERY_PARAMS = new Set([
  'token',
  'email',
  'code',
  'delivery',
  'session_id',
  'type',
]);

function buildNativeHandoffUrlFromQuery(pathname: string, query: Request['query']): string {
  const normalizedPath = pathname.replace(/^\/+/, '');
  const url = new URL(`${APP_SCHEME}://${normalizedPath}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (!ALLOWED_HANDOFF_QUERY_PARAMS.has(key)) continue;
    if (typeof value === 'string' && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function renderAppHandoffPage(
  title: string,
  description: string,
  nativeUrl: string,
  extraHtml = '',
  options: { autoRedirect?: boolean } = {}
): string {
  const redirectScript =
    options.autoRedirect === true
      ? `<script>window.setTimeout(function(){window.location.replace(${JSON.stringify(nativeUrl)});},75);</script>`
      : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>${handoffPageStyle}.card{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:28px 24px;box-shadow:0 12px 32px rgba(15,23,42,.08)}.btn{display:inline-block;background:#1B3A6B;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:600;margin-top:8px;border:0;cursor:pointer;font-size:16px}.btn-secondary{background:#EFF6FF;color:#1D4ED8}.code-card{margin-top:20px;padding:18px;border-radius:12px;background:#F8FAFC;border:1px solid #CBD5E1}.code-label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin:0 0 8px}.code-value{font-size:32px;font-weight:700;letter-spacing:.24em;color:#0F172A;margin:0 0 10px}.meta{font-size:14px;color:#475569;margin:6px 0 0}.stack{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}form{margin:0}</style></head><body><div class="card"><h1>${title}</h1><p>${description}</p><div class="stack"><a class="btn" href="${escapeHtml(nativeUrl)}">Open in VarsityHub</a></div><p>If the app does not open automatically, tap the button again from this page.</p>${extraHtml}</div>${redirectScript}</body></html>`;
}

function isMobileUserAgent(req: Request): boolean {
  const userAgent = String(req.get('user-agent') || '');
  return /iphone|ipad|ipod|android|mobile/i.test(userAgent);
}

function sanitizeEmailQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function sanitizeSixDigitValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^0-9]/g, '').slice(0, 6);
  if (normalized.length !== 6) return null;
  return normalized;
}

function buildVerifyResendCtaHtml(email: string): string {
  return `<div class="stack"><form method="post" action="/verify/resend"><input type="hidden" name="email" value="${escapeHtml(email)}"><button type="submit" class="btn btn-secondary">Request a New Code</button></form></div>`;
}

async function getVerifyHandoffState(req: Request): Promise<VerifyHandoffState> {
  const email = sanitizeEmailQuery(req.query.email);
  const code = sanitizeSixDigitValue(req.query.token);
  if (!email || !code) {
    return { kind: 'invalid', email };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      email: true,
      email_verified: true,
      email_verification_code: true,
      email_verification_expires: true,
    },
  });

  if (!user) return { kind: 'invalid', email };
  if (user.email_verified) return { kind: 'already_verified', email };
  if (!user.email_verification_code || !user.email_verification_expires) {
    return { kind: 'invalid', email };
  }
  if (new Date() > user.email_verification_expires) {
    return { kind: 'expired', email, code };
  }
  if (hashRefreshToken(code) !== String(user.email_verification_code)) {
    return { kind: 'invalid', email };
  }
  return { kind: 'valid', email, code };
}

async function getResetHandoffState(req: Request): Promise<ResetHandoffState> {
  const email = sanitizeEmailQuery(req.query.email);
  const code = sanitizeSixDigitValue(req.query.code);
  if (!email || !code) {
    return { kind: 'invalid', email };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      email: true,
      password_reset_code: true,
      password_reset_expires: true,
    },
  });

  if (!user || !user.password_reset_code || !user.password_reset_expires) {
    return { kind: 'invalid', email };
  }
  if (new Date() > user.password_reset_expires) {
    return { kind: 'expired', email, code };
  }
  if (hashRefreshToken(code) !== String(user.password_reset_code)) {
    return { kind: 'invalid', email };
  }
  return { kind: 'valid', email, code };
}

function buildVerifyFallbackHtml(req: Request): string {
  const token = sanitizeSixDigitValue(req.query.token);
  if (!token) return '';
  const email = sanitizeEmailQuery(req.query.email);
  const emailLine = email
    ? `<p class="meta">This code is for <strong>${escapeHtml(email)}</strong>.</p>`
    : '';
  return `<div class="code-card"><p class="code-label">Manual Backup Code</p><p class="code-value">${escapeHtml(token)}</p><p class="meta">If your email app blocks the handoff, open VarsityHub manually and enter this 6-digit code on the verification screen.</p>${emailLine}</div>`;
}

function buildResetFallbackHtml(req: Request): string {
  const code = sanitizeSixDigitValue(req.query.code);
  if (!code) return '';
  const email = sanitizeEmailQuery(req.query.email);
  const emailLine = email
    ? `<p class="meta">This reset code is for <strong>${escapeHtml(email)}</strong>.</p>`
    : '';
  return `<div class="code-card"><p class="code-label">Manual Backup Code</p><p class="code-value">${escapeHtml(code)}</p><p class="meta">If your email app blocks the handoff, open VarsityHub manually and enter this 6-digit code on the password reset screen.</p>${emailLine}</div>`;
}

const genericHandoffRoutes: Array<{ path: string; title: string; description: string }> = [
  {
    path: '/settings/manage-subscription',
    title: 'Manage Your Subscription',
    description: 'Open VarsityHub to view billing details and manage your subscription.',
  },
  {
    path: '/admin-dashboard',
    title: 'Open Admin Review',
    description: 'Open VarsityHub with an admin account to review this request.',
  },
  {
    path: '/admin-ads',
    title: 'Open Ad Review',
    description: 'Open VarsityHub with an admin account to review this ad.',
  },
  {
    path: '/event-approvals',
    title: 'Open Event Review',
    description: 'Open VarsityHub with a coach or admin account to review this event.',
  },
  {
    path: '/organization',
    title: 'Open Organization Tools',
    description: 'Open VarsityHub to continue in organization tools.',
  },
  {
    path: '/approvals',
    title: 'Open Organization Requests',
    description: 'Open VarsityHub to review organization requests.',
  },
  {
    path: '/organization-join-requests',
    title: 'Open Join Requests',
    description: 'Open VarsityHub to review this organization join request.',
  },
  {
    path: '/team-hub',
    title: 'Open Team Hub',
    description: 'Open VarsityHub to continue in Team Hub.',
  },
  {
    path: '/create-fan-event',
    title: 'Open VarsityHub',
    description: 'Open VarsityHub to continue this event flow.',
  },
  {
    path: '/event-detail',
    title: 'Open Event Detail',
    description: 'Open VarsityHub to view this event.',
  },
  {
    path: '/payment-success',
    title: 'Return to VarsityHub',
    description: 'Open VarsityHub to finish processing your payment.',
  },
  {
    path: '/payment-cancel',
    title: 'Return to VarsityHub',
    description: 'Open VarsityHub to continue after cancelling payment.',
  },
];

publicAppHandoffRouter.get('/verify', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  const nativeUrl = buildNativeHandoffUrl('/verify', req);
  const autoRedirect = isMobileUserAgent(req);
  const state = await getVerifyHandoffState(req);

  if (state.kind === 'valid') {
    return res.send(
      renderAppHandoffPage(
        'Verify Your Email',
        'Open VarsityHub to finish verifying your email address.',
        nativeUrl,
        buildVerifyFallbackHtml(req),
        { autoRedirect }
      )
    );
  }
  if (state.kind === 'expired') {
    return res.send(
      renderAppHandoffPage(
        'Verification Link Expired',
        `This verification link for ${escapeHtml(state.email)} has expired. Request a fresh code, then open VarsityHub to finish verifying your email address.`,
        nativeUrl,
        buildVerifyResendCtaHtml(state.email)
      )
    );
  }
  if (state.kind === 'already_verified') {
    return res.send(
      renderAppHandoffPage(
        'Email Already Verified',
        `The email address ${escapeHtml(state.email)} is already verified. Open VarsityHub to continue signing in.`,
        nativeUrl
      )
    );
  }
  return res.send(
    renderAppHandoffPage(
      'Verification Link Invalid',
      state.email
        ? `This verification link for ${escapeHtml(state.email)} is no longer valid. Request a fresh code, then open VarsityHub to continue.`
        : 'This verification link is no longer valid. Open VarsityHub and request a fresh code to continue.',
      nativeUrl,
      state.email ? buildVerifyResendCtaHtml(state.email) : ''
    )
  );
});

publicAppHandoffRouter.post(
  '/verify/resend',
  noStore,
  publicVerifyResendLimiter,
  async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    const email = sanitizeEmailQuery(req.body?.email);
    const nativeUrl = buildNativeHandoffUrlFromQuery('/verify', email ? { email } : {});

    if (email) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          email: true,
          display_name: true,
          email_verified: true,
        },
      });

      if (user && !user.email_verified) {
        const code = String(crypto.randomInt(100000, 999999));
        const exp = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            email_verification_code: hashRefreshToken(code),
            email_verification_expires: exp,
          },
        });

        sendVerificationEmail(
          user.email,
          code,
          user.display_name || user.email.split('@')[0]
        ).catch(err =>
          console.warn('[verify-handoff] sendVerificationEmail failed:', err?.message || err)
        );
      }
    }

    return res.send(
      renderAppHandoffPage(
        'Check Your Email',
        email
          ? `If an unverified account exists for ${escapeHtml(email)}, we sent a fresh verification code. Open VarsityHub after the email arrives to finish verifying your account.`
          : 'If an unverified account exists for this email address, we sent a fresh verification code. Open VarsityHub after the email arrives to finish verifying your account.',
        nativeUrl
      )
    );
  }
);

publicAppHandoffRouter.get('/reset-password', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  const nativeUrl = buildNativeHandoffUrl('/reset-password', req);
  const autoRedirect = isMobileUserAgent(req);
  const state = await getResetHandoffState(req);

  if (state.kind === 'valid') {
    return res.send(
      renderAppHandoffPage(
        'Reset Your Password',
        'Open VarsityHub to continue your password reset.',
        nativeUrl,
        buildResetFallbackHtml(req),
        { autoRedirect }
      )
    );
  }
  if (state.kind === 'expired') {
    return res.send(
      renderAppHandoffPage(
        'Reset Link Expired',
        `This password reset link for ${escapeHtml(state.email)} has expired. Open VarsityHub and request a fresh reset email to continue.`,
        nativeUrl
      )
    );
  }
  return res.send(
    renderAppHandoffPage(
      'Reset Link Invalid',
      state.email
        ? `This password reset link for ${escapeHtml(state.email)} is no longer valid. Open VarsityHub and request a fresh reset email to continue.`
        : 'This password reset link is no longer valid. Open VarsityHub and request a fresh reset email to continue.',
      nativeUrl
    )
  );
});

for (const route of genericHandoffRoutes) {
  publicAppHandoffRouter.get(route.path, (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(
      renderAppHandoffPage(
        route.title,
        route.description,
        buildNativeHandoffUrl(route.path, req),
        '',
        { autoRedirect: isMobileUserAgent(req) }
      )
    );
  });
}

export { publicAppHandoffRouter };
