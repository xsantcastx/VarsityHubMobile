import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { postsRouter } from './routes/posts.js';
import { eventsRouter } from './routes/events.js';
import { messagesRouter } from './routes/messages.js';
import { uploadsRouter } from './routes/uploads.js';
import { uploadsS3Router } from './routes/uploads-s3.js';
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
app.use(express.json());
app.use(authMiddleware);
// Serve uploaded files
import expressPkg from 'express';
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  },
  expressPkg.static(path.resolve(process.cwd(), 'uploads'))
);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authLimiter, authRouter);
app.get('/me', (req, res, next) => (authRouter as any).handle({ ...req, url: '/me' }, res, next));
app.use('/games', apiLimiter, gamesRouter);
app.use('/posts', apiLimiter, postsRouter);
app.use('/events', apiLimiter, eventsRouter);
app.use('/messages', apiLimiter, messagesRouter);
app.use('/uploads', uploadsRouter);
app.use('/uploads', uploadsS3Router);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
