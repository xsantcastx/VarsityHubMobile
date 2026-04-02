import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { startAdGoLiveCheck, startMessageCleanup, startOvernightMonitoring, startQueueCleanup } from './cron/overnightTasks.js';
import { debugLog } from './lib/debugLog.js';
import { verifyMediaSignature } from './lib/mediaAccess.js';
import { addSentryErrorHandler, initSentry } from './lib/sentry.js';
import { swaggerSpec } from './lib/swagger.js';
import { authMiddleware } from './middleware/auth.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireVerified } from './middleware/requireVerified.js';
import { requireOnboarded } from './middleware/requireOnboarded.js';
import adminRouter from './routes/admin.js';
import { adminReportsRouter } from './routes/adminReports.js';
import { adsRouter, handleAdSubmitForApproval } from './routes/ads.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { followsRouter } from './routes/follows.js';
import { gamesRouter } from './routes/games.js';
import { geocodingRouter } from './routes/geocoding.js';
import { groupChatsRouter } from './routes/group-chats.js';
import { healthRouter } from './routes/health.js';
import { highlightsRouter } from './routes/highlights.js';
import { messagesRouter } from './routes/messages.js';
import { notificationsRouter } from './routes/notifications.js';
import { organizationsRouter } from './routes/organizations.js';
import { paymentsRouter } from './routes/payments.js';
import { postsRouter } from './routes/posts.js';
import { promosRouter } from './routes/promos.js';
import { reportsRouter } from './routes/reports.js';
import { rsvpsRouter } from './routes/rsvps.js';
import { searchRouter } from './routes/search.js';
import { supportRouter } from './routes/support.js';
import { teamInvitesRouter } from './routes/team-invites.js';
import { teamMembershipsRouter } from './routes/team-memberships.js';
import { teamsRouter } from './routes/teams.js';
import { testEmailsRouter } from './routes/test-emails.js';
import { testNotificationsRouter } from './routes/test-notifications.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';
import { wellKnownRouter } from './routes/well-known.js';

const app = express();
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;

// Initialize Sentry for error tracking (must be before other middleware)
if (!isTest) {
  initSentry(app);
}

// Trust proxy headers from Railway (required for express-rate-limit and IP detection)
app.set('trust proxy', 1);

// pino-http ESM interop can require using the default property in some setups
const pinoMiddleware = (typeof (pinoHttp as any) === 'function' ? (pinoHttp as any) : (pinoHttp as any).default) || pinoHttp;
app.use(pinoMiddleware(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}));
// In dev, disable CSP to allow loading media from API when app runs on a different origin.
// In prod, enable CSP with sensible defaults for a mobile API backend.
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.googleapis.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'https://*.stripe.com', 'https://*.sentry.io'],
    },
  } : false,
}));

const isProd = process.env.NODE_ENV === 'production';
const defaultProdOrigins = [
  'https://varsityhub.app',
  'https://app.varsityhub.app',
  'https://lime.varsityhub.app',
  'https://lime-productions.varsityhub.app',
];
const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
];
const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (isProd && envAllowedOrigins.length === 0) {
  console.warn('[cors] ALLOWED_ORIGINS not set in production. Using defaults. Set explicit domains in Railway for full control.');
}
const hasWildcardOrigin = envAllowedOrigins.some((origin) => origin === '*');
if (hasWildcardOrigin) {
  const message = '[cors] ALLOWED_ORIGINS includes "*"; configure explicit origins instead.';
  if (isProd) {
    throw new Error(`${message} Wildcards are not permitted in production.`);
  }
  console.warn(`${message} Wildcards are only allowed during development.`);
}
const wildcardOriginMatchers = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*varsityhub\.app$/,
];
const allowedOrigins = Array.from(
  new Set([
    ...defaultProdOrigins,
    ...(isProd ? [] : defaultDevOrigins),
    ...envAllowedOrigins.filter((origin) => origin !== '*'),
  ])
).filter(Boolean);
if (isProd && allowedOrigins.length === 0) {
  throw new Error('[cors] No allowed origins configured for production environment.');
}
const isAllowedOrigin = (origin?: string | null) => {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) return true;
  // Allow exact matches
  if (allowedOrigins.includes(origin)) return true;
  // Allow wildcard pattern matches
  return wildcardOriginMatchers.some((pattern) => pattern.test(origin));
};
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) {
      return cb(null, true);
    }
    debugLog(`[cors] blocked origin ${origin}`);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};
debugLog(`[cors] allowed origins: ${allowedOrigins.join(', ') || '(regex only)'}`);
app.use(cors(corsOptions));

// Disable ETag generation globally (simplest)
app.set('etag', false);

// No-store for personalized endpoints
const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');
  res.set('Vary', 'Authorization, Origin');
  next();
};

// Stripe webhook must be registered before body parsing so we can verify signatures
// Special raw body parser for Stripe webhooks
const rawBodyPaths = ['/payments/webhook'];
rawBodyPaths.forEach((path) => {
  app.use(path, express.raw({ type: 'application/json', limit: '5mb' }));
});

app.use((req, res, next) => {
  if (rawBodyPaths.some((path) => req.originalUrl.startsWith(path))) {
    return next();
  }
  return express.json({ limit: '10mb' })(req, res, next);
});

// Handle malformed JSON body (returns 400 instead of 500)
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

app.use(authMiddleware);

// ID param validation is applied per-router (params not available at app level)
// Serve uploaded files
const isUploadsApiRequest = (req: Request) =>
  req.path === '/cloudinary-signature' ||
  req.path === '/sign' ||
  req.path === '/files' ||
  (req.path === '/' && req.method === 'POST');

app.use(
  '/uploads',
  (req, res, next) => {
    if (isUploadsApiRequest(req)) return next();
    const allowPublic = process.env.UPLOADS_PUBLIC === '1';
    if (allowPublic) return next();
    const authed = Boolean((req as any).user?.id);
    if (authed) return next();
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    const expRaw = typeof req.query.exp === 'string' ? req.query.exp : null;
    const exp = expRaw ? Number.parseInt(expRaw, 10) : null;
    const mediaPath = `/uploads${req.path}`;
    if (token && exp && verifyMediaSignature(mediaPath, token, exp)) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  },
  (req, res, next) => {
    if (isUploadsApiRequest(req)) return next();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  },
  express.static(path.resolve(process.cwd(), 'uploads'))
);

const isDev = process.env.NODE_ENV !== 'production';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});
// Increased limits for read operations - app makes multiple requests on startup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 2000, // Increased from 500 to 2000 for normal app usage
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev || req.path === '/health',
});

app.use('/health', healthRouter);

// Universal links - must be at /.well-known/ for iOS and Android
app.use('/.well-known', wellKnownRouter);

// API Documentation
const swaggerUiOptions = swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    persistAuthorization: !isProd,
  },
});
if (isProd) {
  app.use('/api-docs', requireAuth as any, requireAdmin as any, swaggerUi.serve, swaggerUiOptions);
} else {
  app.use('/api-docs', swaggerUi.serve, swaggerUiOptions);
}
debugLog('📚 API documentation available at /api-docs');

app.use('/auth', authLimiter, authRouter);
// Proxy shorthand /me/* routes to authRouter (rewrite URL so the router sees /me/*)
app.use('/me', noStore, (req, res, next) => {
  // Express strips the mount path (/me), so req.url is "/" or "/preferences" etc.
  // Prepend /me back so the authRouter matches its /me, /me/preferences, etc. routes
  const suffix = req.url === '/' ? '' : req.url;  // avoid double slash for bare /me
  req.url = '/me' + suffix;
  authRouter(req, res, next);
});
app.use('/games', apiLimiter, gamesRouter);
app.use('/posts', apiLimiter, postsRouter);
app.use('/notifications', noStore, apiLimiter, notificationsRouter);
app.use('/events', apiLimiter, eventsRouter);
app.use('/messages', noStore, apiLimiter, messagesRouter);
app.use('/group-chats', noStore, apiLimiter, groupChatsRouter);
app.use('/uploads', uploadsRouter);

// App-level route for submit-for-approval (guarantees it's registered before any router)
app.post('/ads/:id/submit-for-approval', requireAuth as any, requireVerified as any, requireOnboarded as any, handleAdSubmitForApproval as any);
app.use('/ads', adsRouter);
app.use('/payments', paymentsRouter);
app.use('/admin', noStore, apiLimiter, adminRouter);
app.use('/geocoding', noStore, apiLimiter, geocodingRouter);
app.use('/teams', apiLimiter, teamsRouter);
app.use('/organizations', apiLimiter, organizationsRouter);
app.use('/users', noStore, apiLimiter, usersRouter);
app.use('/search', noStore, apiLimiter, searchRouter);
app.use('/reports', noStore, apiLimiter, reportsRouter);
app.use('/rsvps', noStore, apiLimiter, rsvpsRouter);
app.use('/follows', noStore, apiLimiter, followsRouter);
app.use('/support', noStore, apiLimiter, supportRouter);
app.use('/admin/reports', noStore, apiLimiter, adminReportsRouter);
app.use('/team-memberships', noStore, apiLimiter, teamMembershipsRouter);
app.use('/team-invites', noStore, apiLimiter, teamInvitesRouter);
// Legacy /upload/avatar consolidated into /uploads/avatar (see uploads.ts)
app.use('/highlights', noStore, apiLimiter, highlightsRouter);
app.use('/promos', noStore, apiLimiter, promosRouter);

// Test endpoints (consider removing in production or adding auth)
if (process.env.NODE_ENV !== 'production') {
  app.use('/test-notifications', testNotificationsRouter);
  app.use('/test-emails', testEmailsRouter);
  debugLog('📱 Test notification endpoints available at /test-notifications/*');
  debugLog('📧 Test email endpoints available at /test-emails/*');
}

// Public legal pages (no auth required — Apple App Store review needs these accessible)
const legalPageStyle = `body{font-family:-apple-system,Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{color:#1B3A6B}h2{color:#2563eb;margin-top:24px}a{color:#2563eb}`;

app.get('/privacy-policy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub — Privacy Policy</title><style>${legalPageStyle}</style></head><body>
<h1>VarsityHub Privacy Policy</h1><p><em>Last updated: March 25, 2026</em></p>
<h2>What We Collect</h2><p>Email, username, profile info, posts, photos, videos, messages, team/game data, event RSVPs, device info, usage data, and approximate location (when enabled). Payments are processed by Stripe and Apple — we never store card numbers.</p>
<h2>How We Use It</h2><p>To run VarsityHub: deliver the service, process payments, send notifications, show nearby events, personalize your experience, and prevent abuse.</p>
<h2>Who We Share With</h2><p>We do not sell your data. We share only with: service providers (Stripe, Cloudinary, Railway, Google, Sentry), when you post publicly, or when required by law. We do not share data with sports leagues or universities.</p>
<h2>Your Rights</h2><p>You can access, correct, delete, or export your data. Delete your account in Settings — we anonymize immediately. Contact <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a> for account requests or <a href="mailto:support@varsityhub.app">support@varsityhub.app</a> to report content.</p>
<h2>Children</h2><p>You must be 13+ to use VarsityHub. Users 13-17 need parental consent. We delete data from under-13 users immediately.</p>
<h2>Security</h2><p>Data encrypted in transit (HTTPS), stored on Railway (PostgreSQL). US-based; by using the app you consent to US data transfer.</p>
<h2>Contact</h2><p>Customer service: <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a><br>Report content: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p>
<p>&copy; 2025 Lime Productions. All rights reserved.</p></body></html>`);
});

app.get('/terms', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub — Terms of Service</title><style>${legalPageStyle}</style></head><body>
<h1>VarsityHub Terms of Service</h1><p><em>Last updated: March 25, 2026</em></p>
<h2>1. Agreement</h2><p>By using VarsityHub you agree to these Terms. You must be 13+ (parental consent required for 13-17).</p>
<h2>2. The Service</h2><p>VarsityHub lets you create/manage sports teams, schedule games, share content, and access premium features via paid subscriptions.</p>
<h2>3. Your Account</h2><p>Provide accurate info. Keep credentials secure. You are responsible for all activity on your account.</p>
<h2>4. Rules</h2><p>Do not: post illegal or abusive content; impersonate others; upload content you don't own; spam; interfere with the app; bully or threaten users; upload broadcast/official sports footage.</p>
<h2>5. Content</h2><p>You own your content. By posting, you grant us a license to display it. All fan content must be personally filmed. Official broadcast content is prohibited. VarsityHub has no affiliation with any league or broadcaster.</p>
<h2>6. Subscriptions</h2><p>Rookie: Free (2 teams). Veteran: $1/mo per additional team. Legend: $20/yr unlimited. Auto-renew unless cancelled. Payments via Apple IAP (iOS), Google Play (Android), or Stripe. Cancel anytime in Settings.</p>
<h2>7. DMCA</h2><p>Registered DMCA Designated Service Provider (No. DMCA-1070362). Takedown notices: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a>. Response within 24 hours.</p>
<h2>8. Disclaimers</h2><p>App provided "AS IS." Not liable for indirect damages. Total liability capped at 12 months of payments. You indemnify us against claims from your use.</p>
<h2>9. Disputes</h2><p>Connecticut law. Binding arbitration (small claims excepted). Class action waiver.</p>
<h2>Contact</h2><p>Customer service: <a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a><br>Report content: <a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p>
<p>&copy; 2025 Lime Productions. All rights reserved.</p></body></html>`);
});

app.get('/support', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VarsityHub — Support</title><style>${legalPageStyle}</style></head><body>
<h1>VarsityHub Support</h1>
<p>Need help? We're here for you.</p>
<h2>Contact Us</h2>
<p><strong>Customer Service</strong> (account, billing, subscriptions):<br><a href="mailto:customerservice@varsityhub.app">customerservice@varsityhub.app</a></p>
<p><strong>Report Content/Users</strong> (abuse, DMCA, content moderation):<br><a href="mailto:support@varsityhub.app">support@varsityhub.app</a></p>
<h2>Common Topics</h2>
<ul><li><strong>Account issues:</strong> Password reset, email verification, account deletion</li>
<li><strong>Team management:</strong> Creating teams, inviting members, managing rosters</li>
<li><strong>Subscriptions:</strong> Upgrading, downgrading, billing questions</li>
<li><strong>Content:</strong> Reporting abuse, DMCA takedowns, content guidelines</li>
<li><strong>Technical:</strong> App crashes, bugs, feature requests</li></ul>
<p>We typically respond within 24 hours.</p>
<p>&copy; 2025 Lime Productions. All rights reserved.</p></body></html>`);
});

// Add centralized error handler (must be before Sentry)
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);

// Add Sentry error handler (must be last)
if (!isTest) {
  addSentryErrorHandler(app);
}

// Overnight tasks — ad go-live, monitoring, and stale hold cleanup
// (Game reminders are handled by the scheduler service in src/jobs/scheduler.ts)
if (!isTest) {
  startAdGoLiveCheck();
  startOvernightMonitoring();
  startQueueCleanup();
  startMessageCleanup();
  debugLog('[cron] Overnight tasks scheduled (ad go-live, monitoring, queue cleanup, message cleanup)');
}

export { app };
