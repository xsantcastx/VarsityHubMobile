import 'dotenv/config';
import express from 'express';
import { authMiddleware } from './middleware/auth.js';

await import('./lib/debugLog.js');
await import('./lib/userCache.js');
await import('./lib/pushNotifications.js');
await import('./middleware/rateLimiters.js');
const { authRouter } = await import('./routes/auth.js');
const { teamsRouter } = await import('./routes/teams.js');

const app = express();
app.disable('x-powered-by');

app.use(express.json());
app.use(authMiddleware);
app.use('/auth', authRouter);
app.use('/teams', teamsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (typeof err?.toJSON === 'function') {
    return res.status(status).json(err.toJSON());
  }
  return res.status(status).json({ error: err?.message || 'Internal server error' });
});

export { app };
