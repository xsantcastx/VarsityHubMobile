import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import {
    startAdGoLiveCheck,
    startMessageCleanup,
    startOvernightMonitoring,
    startQueueCleanup,
} from './cron/overnightTasks.js';
import { debugLog } from './lib/debugLog.js';
import { verifyMediaSignature } from './lib/mediaAccess.js';
import { addBreadcrumb, addSentryErrorHandler, initSentry } from './lib/sentry.js';
import { swaggerSpec } from './lib/swagger.js';
import { authMiddleware } from './middleware/auth.js';
import { requestLogging } from './middleware/logging.js';
import { defaultApiLimiter, publicRouteLimiter } from './middleware/rateLimiters.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireParentalConsent } from './middleware/requireParentalConsent.js';
import adminRouter from './routes/admin.js';
import { adminReportsRouter } from './routes/adminReports.js';
import { adsRouter } from './routes/ads.js';
import { authRouter } from './routes/auth.js';
import { consentRouter, handleConsentResend } from './routes/consent.js';
import { dataExportRouter } from './routes/dataExport.js';
import { eventsRouter } from './routes/events.js';
import { feedRouter } from './routes/feed.js';
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
import { publicAppHandoffRouter } from './routes/publicAppHandoff.js';
import { publicSiteRouter } from './routes/publicSite.js';
import { reportsRouter } from './routes/reports.js';
import { rsvpsRouter } from './routes/rsvps.js';
import { searchRouter } from './routes/search.js';
import { shareLandingRouter } from './routes/shareLanding.js';
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
const pinoMiddleware =
  (typeof (pinoHttp as any) === 'function' ? (pinoHttp as any) : (pinoHttp as any).default) ||
  pinoHttp;
app.use(
  pinoMiddleware(
    process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}
  )
);
// In dev, disable CSP to allow loading media from API when app runs on a different origin.
// In prod, enable CSP with sensible defaults for a mobile API backend.
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.googleapis.com'],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              connectSrc: ["'self'", 'https://*.stripe.com', 'https://*.sentry.io'],
            },
          }
        : false,
  })
);

const isProd = process.env.NODE_ENV === 'production';
const defaultProdOrigins = [
  'https://varsityhub.app',
  'https://www.varsityhub.app',
  // Transitional Expo-hosted web origin until the custom web app domain
  // is pointed at the actual web bundle instead of the Railway site shell.
  'https://varsity-hub-varsityhub.expo.app',
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
  .map(s => s.trim())
  .filter(Boolean);
if (isProd && envAllowedOrigins.length === 0) {
  console.warn(
    '[cors] ALLOWED_ORIGINS not set in production. Using defaults. Set explicit domains in Railway for full control.'
  );
}
const hasWildcardOrigin = envAllowedOrigins.some(origin => origin === '*');
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
  // Explicit subdomains only — no wildcard *.varsityhub.app to prevent subdomain takeover attacks
];
const allowedOrigins = Array.from(
  new Set([
    ...defaultProdOrigins,
    ...(isProd ? [] : defaultDevOrigins),
    ...envAllowedOrigins.filter(origin => origin !== '*'),
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
  return wildcardOriginMatchers.some(pattern => pattern.test(origin));
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
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-VarsityHub-Device-Id',
    'If-None-Match',
    'Cache-Control',
    'Pragma',
  ],
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
rawBodyPaths.forEach(path => {
  app.use(path, express.raw({ type: 'application/json', limit: '5mb' }));
});

app.use((req, res, next) => {
  if (rawBodyPaths.some(path => req.originalUrl.startsWith(path))) {
    return next();
  }
  return express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: false }));

// Handle malformed JSON body (returns 400 instead of 500)
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

app.use(requestLogging);
app.use(authMiddleware);

const shouldCaptureRequestBreadcrumb = (req: Request) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  return (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/payments')
  );
};

app.use((req, _res, next) => {
  if (!isTest && shouldCaptureRequestBreadcrumb(req)) {
    addBreadcrumb('HTTP request received', 'http.request', 'info', {
      method: req.method,
      path: req.path,
      authed: Boolean((req as any).user?.id),
      has_body: Boolean(req.body && Object.keys(req.body).length > 0),
    });
  }
  next();
});

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

app.use('/health', publicRouteLimiter, healthRouter);

// Universal links - must be at /.well-known/ for iOS and Android
app.use('/.well-known', publicRouteLimiter, wellKnownRouter);

// Share-landing fallback: serves an HTML page with OG metadata + smart
// "Open in app" UX when a browser hits a universal-link URL (e.g.
// https://varsityhub.app/posts/abc when the app isn't installed).
// JSON clients (Accept: application/json) fall through to the API
// routers below — no behavior change for the mobile app or web fetches.
// MUST be mounted before mountApiRoutes so the API GET /:id handlers
// don't intercept browser requests first.
app.use(shareLandingRouter);

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

// --- API route mounting ---
// All routes mounted via mountApiRoutes so they can be served at both / and /v1/.
// Existing clients hit / (backward compat). New clients can use /v1/.
const meProxy = (req: any, res: any, next: any) => {
  const suffix = req.url === '/' ? '' : req.url;
  req.url = '/me' + suffix;
  authRouter(req, res, next);
};

function mountApiRoutes(parent: any) {
  parent.use(defaultApiLimiter);
  // Firewall 13–17 minors with pending/denied consent off everything except
  // the allowlist (/auth/me, /consent, /me/consent/resend, /health, …). The
  // middleware handles its own bypass for admins and non-minors, so it's safe
  // to run before every route in this bundle.
  parent.use(requireParentalConsent as any);
  parent.use('/auth', authLimiter, authRouter);
  parent.use('/consent', consentRouter);
  parent.post('/me/consent/resend', noStore, ...handleConsentResend);
  parent.use(dataExportRouter);
  parent.use('/me', noStore, meProxy);
  parent.use('/games', gamesRouter);
  parent.use('/posts', postsRouter);
  parent.use('/notifications', noStore, notificationsRouter);
  parent.use('/events', eventsRouter);
  parent.use('/feed', noStore, feedRouter);
  parent.use('/messages', noStore, messagesRouter);
  parent.use('/group-chats', noStore, groupChatsRouter);
  parent.use('/uploads', uploadsRouter);
  parent.use('/ads', adsRouter);
  parent.use('/payments', paymentsRouter);
  parent.use('/admin', noStore, adminRouter);
  parent.use('/geocoding', noStore, geocodingRouter);
  parent.use('/teams', teamsRouter);
  parent.use('/organizations', organizationsRouter);
  parent.use('/users', noStore, usersRouter);
  parent.use('/search', noStore, searchRouter);
  parent.use('/reports', noStore, reportsRouter);
  parent.use('/rsvps', noStore, rsvpsRouter);
  parent.use('/follows', noStore, followsRouter);
  parent.use('/support', noStore, supportRouter);
  parent.use('/admin/reports', noStore, adminReportsRouter);
  parent.use('/team-memberships', noStore, teamMembershipsRouter);
  parent.use('/team-invites', noStore, teamInvitesRouter);
  parent.use('/highlights', noStore, highlightsRouter);
  parent.use('/promos', noStore, promosRouter);
}

// Mount at root (backward compat for existing app versions in the wild)
mountApiRoutes(app);
// Mount at /v1 (new clients should target this prefix for future versioning)
const v1 = express.Router();
mountApiRoutes(v1);
app.use('/v1', v1);

// Test endpoints (consider removing in production or adding auth)
if (process.env.NODE_ENV !== 'production') {
  app.use('/test-notifications', testNotificationsRouter);
  app.use('/test-emails', testEmailsRouter);
  debugLog('📱 Test notification endpoints available at /test-notifications/*');
  debugLog('📧 Test email endpoints available at /test-emails/*');
}

app.use(publicRouteLimiter, publicAppHandoffRouter);
app.use(publicRouteLimiter, publicSiteRouter);

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
  debugLog(
    '[cron] Overnight tasks scheduled (ad go-live, monitoring, queue cleanup, message cleanup)'
  );
}

export { app };
