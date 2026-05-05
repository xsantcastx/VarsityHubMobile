import 'dotenv/config';
import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { requireParentalConsent } from './middleware/requireParentalConsent.js';
import adminRouter from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { adsRouter } from './routes/ads.js';
import { consentRouter, handleConsentResend } from './routes/consent.js';
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
import { publicSiteRouter } from './routes/publicSite.js';

const app = express();
app.disable('x-powered-by');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(authMiddleware);

const meProxy = (req: any, res: any, next: any) => {
  const suffix = req.url === '/' ? '' : req.url;
  req.url = '/me' + suffix;
  authRouter(req, res, next);
};

function mountApiRoutes(parent: any) {
  // Mirror app.ts: the consent firewall runs inside the mounted API bundle so
  // /v1-prefixed requests are evaluated on the stripped path, not the raw
  // outer URL. That keeps allowlist behavior identical to production.
  parent.use(requireParentalConsent as any);
  parent.use('/auth', authRouter);
  parent.use('/consent', consentRouter);
  parent.post('/me/consent/resend', ...handleConsentResend);
  parent.use(dataExportRouter);
  parent.use('/me', meProxy);
  parent.use('/ads', adsRouter);
  parent.use('/admin', adminRouter);
  parent.use('/events', eventsRouter);
  parent.use('/feed', feedRouter);
  parent.use('/follows', followsRouter);
  parent.use('/games', gamesRouter);
  parent.use('/geocoding', geocodingRouter);
  parent.use('/highlights', highlightsRouter);
  parent.use('/notifications', notificationsRouter);
  parent.use('/organizations', organizationsRouter);
  parent.use('/payments', paymentsRouter);
  parent.use('/posts', postsRouter);
  parent.use('/messages', messagesRouter);
  parent.use('/promos', promosRouter);
  parent.use('/reports', reportsRouter);
  parent.use('/rsvps', rsvpsRouter);
  parent.use('/support', supportRouter);
  parent.use('/team-invites', teamInvitesRouter);
  parent.use('/team-memberships', teamMembershipsRouter);
  parent.use('/teams', teamsRouter);
  parent.use('/uploads', uploadsRouter);
  parent.use('/users', usersRouter);
  parent.use('/group-chats', groupChatsRouter);
  parent.use('/admin/reports', adminReportsRouter);
  parent.use('/search', searchRouter);
}

mountApiRoutes(app);
const v1 = express.Router();
mountApiRoutes(v1);
app.use('/v1', v1);
app.use(publicAppHandoffRouter);
app.use(publicSiteRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (typeof err?.toJSON === 'function') {
    return res.status(status).json(err.toJSON());
  }
  return res.status(status).json({ error: err?.message || 'Internal server error' });
});

export { app };
