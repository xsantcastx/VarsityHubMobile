import 'dotenv/config';
import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { requireParentalConsent } from './middleware/requireParentalConsent.js';
import adminRouter from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { adsRouter } from './routes/ads.js';
import { consentRouter } from './routes/consent.js';
import { followsRouter } from './routes/follows.js';
import { eventsRouter } from './routes/events.js';
import { feedRouter } from './routes/feed.js';
import { gamesRouter } from './routes/games.js';
import { geocodingRouter } from './routes/geocoding.js';
import { highlightsRouter } from './routes/highlights.js';
import { notificationsRouter } from './routes/notifications.js';
import { organizationsRouter } from './routes/organizations.js';
import { paymentsRouter } from './routes/payments.js';
import { postsRouter } from './routes/posts.js';
import { messagesRouter } from './routes/messages.js';
import { promosRouter } from './routes/promos.js';
import { reportsRouter } from './routes/reports.js';
import { rsvpsRouter } from './routes/rsvps.js';
import { supportRouter } from './routes/support.js';
import { teamInvitesRouter } from './routes/team-invites.js';
import { teamMembershipsRouter } from './routes/team-memberships.js';
import { teamsRouter } from './routes/teams.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';
import { groupChatsRouter } from './routes/group-chats.js';
import { adminReportsRouter } from './routes/adminReports.js';
import { searchRouter } from './routes/search.js';
import { dataExportRouter } from './routes/dataExport.js';
import { publicAppHandoffRouter } from './routes/publicAppHandoff.js';

const app = express();
app.disable('x-powered-by');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(authMiddleware);
// Mirror app.ts: parental consent firewall runs before all API routes so
// minors with pending/denied consent are blocked from non-allowlisted
// endpoints. Without this in the test app, the firewall never executes
// and security tests give false-greens.
app.use(requireParentalConsent as any);

app.use('/auth', authRouter);
app.use('/ads', adsRouter);
app.use('/admin', adminRouter);
app.use('/consent', consentRouter);
app.use('/events', eventsRouter);
app.use('/feed', feedRouter);
app.use('/follows', followsRouter);
app.use('/games', gamesRouter);
app.use('/geocoding', geocodingRouter);
app.use('/highlights', highlightsRouter);
app.use('/notifications', notificationsRouter);
app.use('/organizations', organizationsRouter);
app.use('/payments', paymentsRouter);
app.use('/posts', postsRouter);
app.use('/messages', messagesRouter);
app.use('/promos', promosRouter);
app.use('/reports', reportsRouter);
app.use('/rsvps', rsvpsRouter);
app.use('/support', supportRouter);
app.use('/team-invites', teamInvitesRouter);
app.use('/team-memberships', teamMembershipsRouter);
app.use('/teams', teamsRouter);
app.use('/uploads', uploadsRouter);
app.use('/users', usersRouter);
app.use('/group-chats', groupChatsRouter);
app.use('/admin/reports', adminReportsRouter);
app.use('/search', searchRouter);
app.use(dataExportRouter);
app.use(publicAppHandoffRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (typeof err?.toJSON === 'function') {
    return res.status(status).json(err.toJSON());
  }
  return res.status(status).json({ error: err?.message || 'Internal server error' });
});

export { app };
