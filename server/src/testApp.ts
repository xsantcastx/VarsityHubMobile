import 'dotenv/config';
import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { organizationsRouter } from './routes/organizations.js';
import { postsRouter } from './routes/posts.js';
import { teamsRouter } from './routes/teams.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

const app = express();

app.use(express.json());
app.use(authMiddleware);

app.use('/auth', authRouter);
app.use('/events', eventsRouter);
app.use('/organizations', organizationsRouter);
app.use('/posts', postsRouter);
app.use('/teams', teamsRouter);
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
