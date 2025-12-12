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

import rateLimit from 'express-rate-limit';
import adminRouter from './routes/admin.js';
import { adsRouter } from './routes/ads.js';
import geocodingRouter from './routes/geocoding.js';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';
import { testEmailsRouter } from './routes/test-emails.js';
import { testNotificationsRouter } from './routes/test-notifications.js';

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

// Initialize SendGrid email service
initEmailService();

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
  origin: isAllowedOrigin,
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

// Special raw body parser for Stripe webhooks (payments + legacy billing path)
const rawBodyPaths = ['/payments/webhook', '/billing/webhooks/stripe'];
rawBodyPaths.forEach((path) => {
  app.use(path, express.raw({ type: 'application/json' }));
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (rawBodyPaths.some((path) => req.originalUrl.startsWith(path))) {
    return next();
  }
  return express.json()(req, res, next);
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

app.use('/ads', adsRouter);
app.use('/payments', paymentLogging, paymentsRouter);
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

app.listen(PORT, HOST, () => {
  debugLog(`API listening on http://${HOST}:${PORT}`);
});
