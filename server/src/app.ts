import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cron from 'node-cron';
import path from 'node:path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { runGameReminders } from './cron/game-reminders.js';
import { debugLog } from './lib/debugLog.js';
import { verifyMediaSignature } from './lib/mediaAccess.js';
import { addSentryErrorHandler, initSentry } from './lib/sentry.js';
import { swaggerSpec } from './lib/swagger.js';
import { authMiddleware } from './middleware/auth.js';
import adminRouter from './routes/admin.js';
import { adminReportsRouter } from './routes/adminReports.js';
import { adsRouter } from './routes/ads.js';
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
import { uploadRouter } from './routes/upload.js';
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
app.set('trust proxy', true);

// pino-http ESM interop can require using the default property in some setups
const pinoMiddleware = (typeof (pinoHttp as any) === 'function' ? (pinoHttp as any) : (pinoHttp as any).default) || pinoHttp;
app.use(pinoMiddleware({ transport: { target: 'pino-pretty' } }));
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
  app.use(path, express.raw({ type: 'application/json' }));
});

app.use((req, res, next) => {
  if (rawBodyPaths.some((path) => req.originalUrl.startsWith(path))) {
    return next();
  }
  return express.json()(req, res, next);
});

app.use(authMiddleware);
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

const isDev = process.env.NODE_ENV !== 'production' || process.env.RATE_LIMIT_DISABLE === '1';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 50,
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    persistAuthorization: true,
  },
}));
debugLog('📚 API documentation available at /api-docs');

app.use('/auth', authLimiter, authRouter);
app.get('/me', noStore, (req, res, next) => (authRouter as any).handle({ ...req, url: '/me' }, res, next));
app.patch('/me/preferences', noStore, (req, res, next) => (authRouter as any).handle({ ...req, url: '/me/preferences' }, res, next));
app.patch('/me', noStore, (req, res, next) => (authRouter as any).handle({ ...req, url: '/me' }, res, next));
app.post('/me/complete-onboarding', noStore, (req, res, next) => (authRouter as any).handle({ ...req, url: '/me/complete-onboarding' }, res, next));
app.get('/me/subscription', noStore, (req, res, next) => (authRouter as any).handle({ ...req, url: '/me/subscription' }, res, next));
app.use('/games', apiLimiter, gamesRouter);
app.use('/posts', apiLimiter, postsRouter);
app.use('/notifications', noStore, apiLimiter, notificationsRouter);
app.use('/events', apiLimiter, eventsRouter);
app.use('/messages', noStore, apiLimiter, messagesRouter);
app.use('/group-chats', noStore, apiLimiter, groupChatsRouter);
app.use('/uploads', uploadsRouter);

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
app.use('/upload', noStore, apiLimiter, uploadRouter);
app.use('/highlights', noStore, apiLimiter, highlightsRouter);
app.use('/promos', noStore, apiLimiter, promosRouter);

// Test endpoints (consider removing in production or adding auth)
if (process.env.NODE_ENV !== 'production') {
  app.use('/test-notifications', testNotificationsRouter);
  app.use('/test-emails', testEmailsRouter);
  debugLog('📱 Test notification endpoints available at /test-notifications/*');
  debugLog('📧 Test email endpoints available at /test-emails/*');
}

// Add centralized error handler (must be before Sentry)
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);

// Add Sentry error handler (must be last)
if (!isTest) {
  addSentryErrorHandler(app);
}

// Game reminder cron — runs every hour, checks for games starting in 12h and 1h
if (!isTest) {
  cron.schedule('0 * * * *', () => {
    void runGameReminders().catch((err) =>
      console.error('[cron] game-reminders failed:', err)
    );
  });
  debugLog('[cron] Game reminder job scheduled (every hour)');
}

export { app };
