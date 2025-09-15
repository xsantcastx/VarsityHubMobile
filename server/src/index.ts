import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// The default export of pino-http is not a function, so we have to use require
const pinoHttp = require('pino-http');
import path from 'node:path';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { postsRouter } from './routes/posts.js';
import { eventsRouter } from './routes/events.js';
import { messagesRouter } from './routes/messages.js';
import { uploadsRouter } from './routes/uploads.js';
import { teamsRouter } from './routes/teams.js';
import { usersRouter } from './routes/users.js';

import { adsRouter } from './routes/ads.js';
import { paymentsRouter } from './routes/payments.js';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(pinoHttp({ transport: { target: 'pino-pretty' } }));
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
app.use('/games', apiLimiter, gamesRouter);
app.use('/posts', apiLimiter, postsRouter);
app.use('/events', apiLimiter, eventsRouter);
app.use('/messages', noStore, apiLimiter, messagesRouter);
app.use('/uploads', uploadsRouter);

app.use('/ads', adsRouter);
app.use('/payments', paymentsRouter);
app.use('/teams', apiLimiter, teamsRouter);
app.use('/users', apiLimiter, usersRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});


