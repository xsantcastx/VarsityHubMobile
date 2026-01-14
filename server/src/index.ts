import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cron from 'node-cron';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import './lib/load-env.js';
import { env } from './lib/env.js';
import { addSentryErrorHandler, initSentry } from './lib/sentry.js';
import { swaggerSpec } from './lib/swagger.js';
import { authMiddleware } from './middleware/auth.js';
import { paymentLogging, requestLogging } from './middleware/logging.js';
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
import { tournamentsRouter } from './routes/tournaments.js';
import { uploadRouter } from './routes/upload.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';
import { startEmailWorker } from './workers/emailWorker.js';

import rateLimit from 'express-rate-limit';
import adminRouter from './routes/admin.js';
import { adsRouter } from './routes/ads.js';
import geocodingRouter from './routes/geocoding.js';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';
import { reportsRouter } from './routes/reports.js';
import { testNotificationsRouter } from './routes/test-notifications.js';

// Node's default max listeners (10) is too low once Commander-based CLIs are mounted.
// Raise the ceiling globally to avoid MaxListenersExceeded warnings during startup scripts.
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners ?? 10, 25);

const app = express();

// Validate required environment variables at startup
function validateEnvironmentVariables() {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ALLOWED_ORIGINS',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_FROM_PHONE',
    'TWILIO_VERIFY_SERVICE_SID',
    'SENDGRID_API_KEY',
  ];

  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `❌ Missing required environment variables:\n${missing.map((v) => `   - ${v}`).join('\n')}\n\nPlease check your .env file and ensure all variables are set.`;
    console.error(errorMsg);
    throw new Error(`Environment validation failed: ${missing.join(', ')}`);
  }

  console.log(`✅ Environment validation: ${requiredVars.length} required variables loaded`);
}

validateEnvironmentVariables();

// Initialize Sentry for error tracking (must be before other middleware)
initSentry(app);

// Verify Sentry initialization
if (process.env.SENTRY_DSN) {
  console.log('✅ Sentry error tracking enabled');
} else {
  console.warn('⚠️  Sentry DSN not configured - error tracking disabled');
}

// Initialize SendGrid email service
initEmailService();

// Initialize queue system and email worker
await initializeQueue();
await startEmailWorker();

// Start overnight monitoring and cron tasks
const { startOvernightMonitoring, startQueueCleanup, startAdGoLiveCheck } = await import('./cron/overnightTasks.js');
startOvernightMonitoring();
startQueueCleanup();
startAdGoLiveCheck();

// Trust proxy headers from Railway (required for express-rate-limit and IP detection)
app.set('trust proxy', true);

// pino-http ESM interop can require using the default property in some setups
const pinoMiddleware = (typeof (pinoHttp as any) === 'function' ? (pinoHttp as any) : (pinoHttp as any).default) || pinoHttp;
app.use(pinoMiddleware({ transport: { target: 'pino-pretty' } }));
// In dev, disable CSP to allow loading media from API when app runs on a different origin
app.use(helmet({ contentSecurityPolicy: false }));

const rawOrigins = (env.ALLOWED_ORIGINS ?? (env.NODE_ENV === 'development' ? '*' : ''))
=======
// SECURITY: Parse ALLOWED_ORIGINS from environment
const rawOrigins = (env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// SECURITY: In production, require explicit origin allowlist - fail closed
const isProduction = env.NODE_ENV === 'production';
const allowWildcard = !isProduction && (rawOrigins.length === 0 || rawOrigins.includes('*'));

if (isProduction && rawOrigins.length === 0) {
  console.error('[security] CRITICAL: ALLOWED_ORIGINS is not set for production. CORS will reject all cross-origin requests.');
  console.error('[security] Set ALLOWED_ORIGINS environment variable to allow specific origins.');
}

if (isProduction && rawOrigins.includes('*')) {
  console.error('[security] CRITICAL: ALLOWED_ORIGINS contains wildcard (*) in production. This is a security risk.');
  console.error('[security] Remove wildcard and specify explicit origins.');
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (same-origin, mobile apps, server-to-server)
    if (!origin) return cb(null, true);

    // In development with no explicit config, allow all origins
    if (allowWildcard) return cb(null, true);

    // Check against explicit allowlist
    if (rawOrigins.includes(origin)) return cb(null, true);

    // SECURITY: Reject unauthorized origins
    console.warn(`[security] CORS rejected origin: ${origin}`);
    return cb(new Error('Not allowed by CORS'));
  },
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
  credentials: false,
};
console.log(`[cors] Configured with ${allowedOrigins.length} allowed origin(s)`);
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

// SECURITY: Special raw body parser for Stripe webhook signature verification
// The webhook handler is at /payments/webhook - this must match!
app.use('/payments/webhook', expressPkg.raw({ type: 'application/json' }));

app.use((req, res, next) => {
  // For Stripe webhook, skip JSON parsing (raw body needed for signature verification)
  if (req.originalUrl === '/payments/webhook') {
    return next();
  }
  return expressPkg.json()(req, res, next);
});

app.use(authMiddleware);

// Request logging with IDs and timing
app.use(requestLogging);

// Serve uploaded files
app.use(
  '/uploads',
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  },
  express.static(path.resolve(process.cwd(), 'uploads'))
);

const isDev = env.NODE_ENV !== 'production' || env.RATE_LIMIT_DISABLE === '1';
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
app.get('/me', noStore, (req: Request, res: Response, next: NextFunction) => (authRouter as any).handle({ ...req, url: '/me' }, res, next));
app.patch('/me/preferences', noStore, (req: Request, res: Response, next: NextFunction) => (authRouter as any).handle({ ...req, url: '/me/preferences' }, res, next));
app.patch('/me', noStore, (req: Request, res: Response, next: NextFunction) => (authRouter as any).handle({ ...req, url: '/me' }, res, next));
app.post('/me/complete-onboarding', noStore, (req: Request, res: Response, next: NextFunction) => (authRouter as any).handle({ ...req, url: '/me/complete-onboarding' }, res, next));
app.use('/games', apiLimiter, gamesRouter);
app.use('/posts', apiLimiter, postsRouter);
app.use('/notifications', noStore, apiLimiter, notificationsRouter);
app.use('/events', apiLimiter, eventsRouter);
app.use('/messages', noStore, apiLimiter, messagesRouter);
app.use('/group-chats', noStore, apiLimiter, groupChatsRouter);
app.use('/uploads', uploadsRouter);

app.use('/ads', apiLimiter, adsRouter);
app.use('/payments', noStore, apiLimiter, paymentsRouter);
app.use('/admin', noStore, apiLimiter, adminRouter);
app.use('/geocoding', noStore, apiLimiter, geocodingRouter);
app.use('/teams', apiLimiter, teamsRouter);
app.use('/tournaments', apiLimiter, tournamentsRouter);
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
app.use('/reports', noStore, apiLimiter, reportsRouter);

// Test endpoints (consider removing in production or adding auth)
if (env.NODE_ENV !== 'production') {
  app.use('/test-notifications', testNotificationsRouter);
  app.use('/test-emails', testEmailsRouter);
  debugLog('📱 Test notification endpoints available at /test-notifications/*');
  debugLog('📧 Test email endpoints available at /test-emails/*');
}

const PORT = env.PORT ? Number(env.PORT) : 4000;
// Bind to 0.0.0.0 so the API is reachable from other devices on the LAN (useful for Expo on a phone/emulator)
const HOST: string = env.HOST || '0.0.0.0';

// Add Sentry error handler (must be last)
addSentryErrorHandler(app);

app.listen(PORT, HOST, () => {
  debugLog(`API listening on http://${HOST}:${PORT}`);
});
