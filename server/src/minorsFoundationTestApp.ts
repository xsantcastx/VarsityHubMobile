import 'dotenv/config';
import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { adsRouter } from './routes/ads.js';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { usersRouter } from './routes/users.js';

const app = express();
app.disable('x-powered-by');

app.use(express.json());
app.use(authMiddleware);

app.use('/ads', adsRouter);
app.use('/auth', authRouter);
app.use('/messages', messagesRouter);
app.use('/users', usersRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (typeof err?.toJSON === 'function') {
    return res.status(status).json(err.toJSON());
  }
  return res.status(status).json({ error: err?.message || 'Internal server error' });
});

export { app };
