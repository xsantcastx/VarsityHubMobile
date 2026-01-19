import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { debugLog } from './lib/debugLog.js';
import { initEmailService } from './lib/email.js';
import { addSentryErrorHandler, initSentry } from './lib/sentry.js';
import { swaggerSpec } from './lib/swagger.js';
import { initializeQueues, shutdownQueues } from './jobs/queues.js';
import { captureException } from './lib/sentry.js';
import { authMiddleware } from './middleware/auth.js';
import { adminReportsRouter } from './routes/adminReports.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { followsRouter } from './routes/follows.js';
import { gamesRouter } from './routes/games.js';
import { groupChatsRouter } from './routes/group-chats.js';
import { highlightsRouter } from './routes/highlights.js';
import { messagesRouter } from './routes/messages.js';
import { notificationsRouter } from './routes/notifications.js';
import { organizationsRouter } from './routes/organizations.js';
import { postsRouter } from './routes/posts.js';
import { promosRouter } from './routes/promos.js';
import { rsvpsRouter } from './routes/rsvps.js';
import { supportRouter } from './routes/support.js';
import { teamInvitesRouter } from './routes/team-invites.js';
import { teamMembershipsRouter } from './routes/team-memberships.js';
import { teamsRouter } from './routes/teams.js';
import { uploadRouter } from './routes/upload.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

import rateLimit from 'express-rate-limit';
import adminRouter from './routes/admin.js';
import { adsRouter } from './routes/ads.js';
import geocodingRouter from './routes/geocoding.js';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';
import { testEmailsRouter } from './routes/test-emails.js';
import { testNotificationsRouter } from './routes/test-notifications.js';

const app = express();

// Initialize Sentry for error tracking (must be before other middleware)
initSentry(app);

// Initialize SendGrid email service
initEmailService();

// Initialize job queues (async, non-blocking)
initializeQueues().catch((error) => {
  console.error('[startup] Failed to initialize queues:', error);
  captureException(error, { context: 'queue_initialization' });
});

// Trust proxy headers from Railway (required for express-rate-limit and IP detection)
app.set('trust proxy', true);

// pino-http ESM interop can require using the default property in some setups
const pinoMiddleware = (typeof (pinoHttp as any) === 'function' ? (pinoHttp as any) : (pinoHttp as any).default) || pinoHttp;
app.use(pinoMiddleware({ transport: { target: 'pino-pretty' } }));
// In dev, disable CSP to allow loading media from API when app runs on a different origin
app.use(helmet({ contentSecurityPolicy: false }));

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
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
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
  credentials: false,
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

// Special raw body parser for Stripe webhooks (payments + legacy billing path)
const rawBodyPaths = ['/payments/webhook', '/billing/webhooks/stripe'];
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
app.use(
  '/uploads',
  (req, res, next) => {
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
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

app.use('/health', healthRouter);

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

const PORT = Number(process.env.PORT || 4000);
// Bind to 0.0.0.0 so the API is reachable from other devices on the LAN (useful for Expo on a phone/emulator)
const HOST: string = process.env.HOST || '0.0.0.0';

// Add Sentry error handler (must be last)
addSentryErrorHandler(app);

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  debugLog(`\n[shutdown] Received ${signal}, shutting down gracefully...`);
  try {
    await shutdownQueues();
    debugLog('[shutdown] Queues closed');
    process.exit(0);
  } catch (error) {
    console.error('[shutdown] Error during shutdown:', error);
    captureException(error as Error, { context: 'graceful_shutdown' });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  captureException(error, { context: 'uncaught_exception' });
  shutdown('uncaughtException').finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
  captureException(reason as Error, { context: 'unhandled_rejection', promise: String(promise) });
});

// Export app for testing
export { app };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    debugLog(`API listening on http://${HOST}:${PORT}`);
  });
}
