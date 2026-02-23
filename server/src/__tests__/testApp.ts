/**
 * Minimal Express app for integration tests.
 * Mounts auth routes and essential middleware without Sentry, email, queue, cron, etc.
 */
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.js';
import { authRouter } from '../routes/auth.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
});

const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');
  res.set('Vary', 'Authorization, Origin');
  next();
};

const delegateToAuth = (path: string) => (req: Request, res: Response, next: NextFunction) => {
  const r = { ...req, url: path } as Request;
  authRouter.handle(r, res, next);
};

export function createTestApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/auth', authLimiter, authRouter);
  app.get('/me', noStore, delegateToAuth('/me'));
  app.patch('/me/preferences', noStore, delegateToAuth('/me/preferences'));
  app.patch('/me', noStore, delegateToAuth('/me'));
  app.post('/me/complete-onboarding', noStore, delegateToAuth('/me/complete-onboarding'));
  return app;
}
