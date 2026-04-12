import './lib/load-env.js';
import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import adminRouter from './routes/admin.js';
import { adsRouter } from './routes/ads.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { gamesRouter } from './routes/games.js';
import { groupChatsRouter } from './routes/group-chats.js';
import { organizationsRouter } from './routes/organizations.js';
import { paymentsRouter } from './routes/payments.js';
import { postsRouter } from './routes/posts.js';
import { teamsRouter } from './routes/teams.js';
import { uploadRouter } from './routes/upload.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

const app = express();

app.use(express.json());
app.use(authMiddleware);

app.use('/admin', adminRouter);
app.use('/ads', adsRouter);
app.use('/auth', authRouter);
app.use('/events', eventsRouter);
app.use('/games', gamesRouter);
app.use('/group-chats', groupChatsRouter);
app.use('/organizations', organizationsRouter);
app.use('/payments', paymentsRouter);
app.use('/posts', postsRouter);
app.use('/teams', teamsRouter);
app.use('/upload', uploadRouter);
app.use('/uploads', uploadsRouter);
app.use('/users', usersRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (typeof err?.toJSON === 'function') {
    return res.status(status).json(err.toJSON());
  }
  return res.status(status).json({ error: err?.message || 'Internal server error' });
});

export { app };
