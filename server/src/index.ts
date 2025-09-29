import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import pinoHttp from 'pino-http';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { followsRouter } from './routes/follows.js';
import { gamesRouter } from './routes/games.js';
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
import { adsRouter } from './routes/ads.js';
import { paymentsRouter } from './routes/payments.js';

const app = express();
// pino-http ESM interop can require using the default property in some setups
const pinoMiddleware = (typeof (pinoHttp as any) === 'function' ? (pinoHttp as any) : (pinoHttp as any).default) || pinoHttp;
app.use(pinoMiddleware({ transport: { target: 'pino-pretty' } }));
// In dev, disable CSP to allow loading media from API when app runs on a different origin
app.use(helmet({ contentSecurityPolicy: false }));

const allowed = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: false,
};
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
import expressPkg from 'express';
app.post('/payments/webhook', expressPkg.raw({ type: 'application/json' }), (_req, _res, next) => next());
app.use((req, res, next) => { if (req.originalUrl === '/payments/webhook') return next(); return expressPkg.json()(req, res, next); });
app.use(authMiddleware);
// Serve uploaded files
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  },
  expressPkg.static(path.resolve(process.cwd(), 'uploads'))
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

app.get('/health', (_req, res) => res.json({ ok: true }));
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
app.use('/uploads', uploadsRouter);

app.use('/ads', adsRouter);
app.use('/payments', paymentsRouter);
app.use('/teams', apiLimiter, teamsRouter);
app.use('/organizations', apiLimiter, organizationsRouter);
app.use('/users', noStore, apiLimiter, usersRouter);
app.use('/rsvps', noStore, apiLimiter, rsvpsRouter);
app.use('/follows', noStore, apiLimiter, followsRouter);
app.use('/support', noStore, apiLimiter, supportRouter);
app.use('/team-memberships', noStore, apiLimiter, teamMembershipsRouter);
app.use('/team-invites', noStore, apiLimiter, teamInvitesRouter);
app.use('/upload', noStore, apiLimiter, uploadRouter);
app.use('/highlights', noStore, apiLimiter, highlightsRouter);
app.use('/promos', noStore, apiLimiter, promosRouter);

const PORT = Number(process.env.PORT || 4000);
// Bind to 0.0.0.0 so the API is reachable from other devices on the LAN (useful for Expo on a phone/emulator)
const HOST: string = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});


