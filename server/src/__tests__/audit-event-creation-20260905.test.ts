/** Real HTTP/PostgreSQL event duration and venue contract, isolated local fixtures only. */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
const url = new URL(process.env.DATABASE_URL || '');
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(url.hostname) ||
  !url.pathname.startsWith('/varsityhub_audit_')
)
  throw new Error('Requires isolated local audit database');
let prisma: typeof import('../lib/prisma.js').prisma;
let signJwt: typeof import('../lib/jwt.js').signJwt;
let serializeLiveWindow: typeof import('../lib/geofencing.js').serializeLiveWindow;
const app = express();
let userId: string;
let teamId: string;
let orgId: string;
let token: string;
const start = new Date(Date.now() + 7 * 86400000);
const gameIds: string[] = [];
const eventIds: string[] = [];
const banner = 'https://res.cloudinary.com/varsityhub/image/upload/audit-banner.jpg';
beforeAll(async () => {
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signJwt } = await import('../lib/jwt.js'));
  ({ serializeLiveWindow } = await import('../lib/geofencing.js'));
  // Load the real route graph sequentially: importing the complete testApp can
  // collide in Jest's experimental ESM registry before these assertions execute.
  const { authMiddleware } = await import('../middleware/auth.js');
  await import('../lib/userAge.js');
  await import('../lib/userAuthState.js');
  await import('../lib/userBillingState.js');
  await import('../lib/planDefinitions.js');
  await import('../lib/appReviewFixture.js');
  await import('../lib/adminEmails.js');
  await import('../middleware/requireAdmin.js');
  const { requireParentalConsent } = await import('../middleware/requireParentalConsent.js');
  await import('../lib/privacyUtils.js');
  await import('../lib/entityVisibility.js');
  await import('../lib/cache.js');
  await import('../lib/email.js');
  await import('../lib/teamAuthorization.js');
  await import('../lib/adminActivityLogger.js');
  await import('../lib/mediaHosts.js');
  await import('../lib/reviewPage.js');
  await import('../lib/debugLog.js');
  await import('../lib/eventReviewNotifications.js');
  await import('../lib/http/sendError.js');
  await import('../lib/mediaUtils.js');
  await import('../lib/reviewTokens.js');
  await import('../lib/sanitizeHtml.js');
  await import('../lib/serializeGame.js');
  await import('../lib/proSchedule/venuePhotos.js');
  await import('../lib/gameApproval.js');
  await import('../lib/formatEventTime.js');
  await import('../lib/voteSummary.js');
  await import('../middleware/asyncHandler.js');
  await import('../middleware/rateLimiters.js');
  await import('../lib/geoUtils.js');
  await import('../lib/geocoding.js');
  await import('../middleware/requireAuth.js');
  await import('../middleware/requireOnboarded.js');
  await import('../middleware/requireVerified.js');
  await import('../middleware/validateParams.js');
  const { gamesRouter } = await import('../routes/games.js');
  await import('../lib/approvalService.js');
  await import('../lib/proSchedule/leagueSport.js');
  await import('../lib/proSchedule/types.js');
  await import('../lib/notifications.js');
  await import('../lib/sideEffect.js');
  await import('../lib/sportsLeagueCatalog.js');
  const { eventsRouter } = await import('../routes/events.js');
  app.use(express.json());
  app.use(authMiddleware);
  app.use(requireParentalConsent);
  app.use('/games', gamesRouter);
  app.use('/events', eventsRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return res
      .status(status)
      .json(
        typeof err?.toJSON === 'function'
          ? err.toJSON()
          : { error: err?.message || 'Internal server error' }
      );
  });
  const user = await prisma.user.create({
    data: {
      email: `eventaudit${Date.now()}@example.test`,
      password_hash: 'unused-local-audit',
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      date_of_birth: new Date('1990-01-01'),
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: 1,
      preferences: { role: 'coach', onboarding_completed: true },
    },
  });
  userId = user.id;
  token = signJwt({ id: user.id });
  const org = await prisma.organization.create({
    data: {
      name: `Event audit ${Date.now()}`,
      league_owner_id: user.id,
      admin_approved: true,
      status: 'active',
    },
  });
  orgId = org.id;
  const team = await prisma.team.create({
    data: {
      name: `Event audit ${Date.now()}`,
      organization_id: orgId,
      is_private: false,
    },
  });
  teamId = team.id;
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: user.id, role: 'owner', status: 'active' },
  });
});
afterAll(async () => {
  if (!userId) return;
  await prisma.event.deleteMany({
    where: { OR: [{ creator_id: userId }, { id: { in: eventIds } }] },
  });
  await prisma.game.deleteMany({
    where: { OR: [{ created_by_id: userId }, { id: { in: gameIds } }] },
  });
  if (teamId) await prisma.team.deleteMany({ where: { id: teamId } });
  if (orgId) await prisma.organization.delete({ where: { id: orgId } });
  await prisma.user.delete({ where: { id: userId } });
});
function body(hours?: number) {
  return {
    title: 'Vipers vs Manual Rivals',
    home_team_id: teamId,
    home_team: 'Vipers',
    away_team: 'Manual Rivals',
    away_team_name: 'Manual Rivals',
    date: start.toISOString(),
    location: 'Audit Field',
    latitude: 40,
    longitude: -73,
    event_type: 'game',
    live_window_hours_after_start: hours,
    banner_url: banner,
    cover_image_url: banner,
  };
}
async function createGame(hours?: number) {
  const response = await request(app)
    .post('/games')
    .set('Authorization', `Bearer ${token}`)
    .send(body(hours));
  expect({ status: response.status, error: response.body.error }).toEqual({
    status: 201,
    error: undefined,
  });
  gameIds.push(response.body.id);
  return response.body;
}
describe('event creation PDF requirements', () => {
  it.each([5, 12])(
    'persists a %ih game duration with banner/manual opponent and returns its actual live bounds',
    async hours => {
      const game = await createGame(hours);
      const stored = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { events: true },
      });
      expect(stored).toMatchObject({
        home_team_id: teamId,
        away_team_id: null,
        away_team_name: 'Manual Rivals',
        location: 'Audit Field',
        banner_url: banner,
        cover_image_url: banner,
      });
      expect(stored.events[0]).toMatchObject({
        live_window_hours_after_start: hours,
        location: 'Audit Field',
        latitude: 40,
        longitude: -73,
      });
      const detail = await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body).toMatchObject(serializeLiveWindow(start, hours));
    }
  );
  it('persists a noncompetitive standalone event duration and enforces the same location requirement', async () => {
    const response = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body(12), title: 'Fundraiser', event_type: 'fundraiser' })
      .expect(201);
    eventIds.push(response.body.id);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: response.body.id } })).toMatchObject(
      { live_window_hours_after_start: 12, location: 'Audit Field', banner_url: banner }
    );
    await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body(5), event_type: 'fundraiser', location: '   ' })
      .expect(400);
  });
  it('preserves existing defaults/pro overrides when not selected and supports explicit updates', async () => {
    const game = await createGame();
    let event = await prisma.event.findFirstOrThrow({ where: { game_id: game.id } });
    expect(event.live_window_hours_after_start).toBeNull();
    await prisma.event.update({
      where: { id: event.id },
      data: { live_window_hours_after_start: 18 },
    });
    await request(app)
      .put(`/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Edited notes' })
      .expect(200);
    event = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(event.live_window_hours_after_start).toBe(18);
    await request(app)
      .put(`/games/${game.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ live_window_hours_after_start: 5 })
      .expect(200);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .live_window_hours_after_start
    ).toBe(5);
    await request(app)
      .patch(`/events/${event.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ live_window_hours_after_start: 12 })
      .expect(200);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .live_window_hours_after_start
    ).toBe(12);
    for (const [method, route] of [
      ['put', `/games/${game.id}`],
      ['patch', `/events/${event.id}`],
    ] as const) {
      await request(app)
        [method](route)
        .set('Authorization', `Bearer ${token}`)
        .send({ location: ' ' })
        .expect(400);
      await request(app)
        [method](route)
        .set('Authorization', `Bearer ${token}`)
        .send({ live_window_hours_after_start: 999 })
        .expect(400);
    }
  });
  it.each([0, 3, 18, 999])('rejects forged duration %i on game/event creation', async hours => {
    await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${token}`)
      .send(body(hours))
      .expect(400);
    await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send(body(hours))
      .expect(400);
  });
  it('carries duration through bulk creation and rejects missing venue', async () => {
    const response = await request(app)
      .post('/games/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ games: [body(5), { ...body(12), title: 'Second game' }] })
      .expect(201);
    const stored = await prisma.game.findMany({
      where: { created_by_id: userId, title: 'Second game' },
      include: { events: true },
      take: 10,
    });
    gameIds.push(...stored.map(game => game.id));
    expect(stored).toHaveLength(1);
    expect(stored[0].events[0].live_window_hours_after_start).toBe(12);
    await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body(5), location: '' })
      .expect(400);
    expect(response.body).toBeTruthy();
  });
});
