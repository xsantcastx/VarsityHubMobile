/**
 * GET /games/:id and GET /events/:id grace-window VIEW access — real-DB
 * integration tests (mirrors the api-events.test.ts / game-approval.test.ts
 * pattern rather than mocking, since these routes' visibility gates touch
 * several DB tables and the real wiring is what matters here).
 *
 * Product rule (2026-07-14, owner decision, verbatim): "When a user posts to
 * an event while they are there, they can continue to post to the event for
 * up to a week. After that week they no longer can." That same contributor
 * must also be able to VIEW the game/event detail page during that week —
 * previously a contributor who posted got a 404 the instant the entity lost
 * public visibility (e.g. an opponent-consent re-flip on a game, or a
 * fan-created event still pending approval). This is a real bug affecting a
 * real user who posted but is now locked out; the fix must be general
 * (keyed off "did this viewer post here while it was live/open", not any
 * hardcoded user id).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

// 3 days ago -> well inside the 7-day post-live grace window.
const RECENT_ENTITY_DATE = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
// 20 days ago -> liveCutoff (+2h) + 7d grace is long past; window is closed.
const STALE_ENTITY_DATE = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

describe('Grace-window VIEW access', () => {
  let orgId: string;
  let homeTeamId: string;
  let awayTeamId: string;
  let creatorId: string;
  let creatorToken: string;
  let contributorId: string;
  let contributorToken: string;
  let outsiderId: string;
  let outsiderToken: string;

  const gameIds: string[] = [];
  const eventIds: string[] = [];
  const postIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const org = await prisma.organization.create({
      data: {
        name: `Grace View League ${ts}`,
        org_type: 'league',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({ data: { name: `Grace Home ${ts}`, organization_id: orgId } }),
      prisma.team.create({ data: { name: `Grace Away ${ts}`, organization_id: orgId } }),
    ]);
    homeTeamId = homeTeam.id;
    awayTeamId = awayTeam.id;

    async function makeUser(label: string) {
      const user = await prisma.user.create({
        data: {
          email: `grace-view-${label}-${ts}@example.com`,
          password_hash: hash,
          display_name: `Grace ${label}`,
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'fan', plan: 'rookie', onboarding_completed: true },
        },
      });
      return { id: user.id, token: signJwt({ id: user.id }) };
    }

    // Creator has no team/org staff role, so visibility for everyone else
    // depends purely on the gates under test, not an incidental staff grant.
    const creator = await makeUser('creator');
    creatorId = creator.id;
    creatorToken = creator.token;

    const contributor = await makeUser('contributor');
    contributorId = contributor.id;
    contributorToken = contributor.token;

    const outsider = await makeUser('outsider');
    outsiderId = outsider.id;
    outsiderToken = outsider.token;
  });

  afterAll(async () => {
    try {
      await prisma.post.deleteMany({ where: { id: { in: postIds } } }).catch(() => {});
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } }).catch(() => {});
      await prisma.game.deleteMany({ where: { id: { in: gameIds } } }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: { in: [homeTeamId, awayTeamId] } } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [creatorId, contributorId, outsiderId] } } })
        .catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  describe('GET /games/:id', () => {
    async function makeNonPublicGame(date: Date) {
      // approved + opponent-pending is treated as non-public (same as a
      // moderation-pending game) by canViewGameRecord — this is the exact
      // "opponent-consent re-flip" shape described in the bug report.
      const game = await prisma.game.create({
        data: {
          title: `Grace Game ${ts}-${Math.random()}`,
          date,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          approval_status: 'approved',
          opponent_approval_status: 'pending',
          created_by_id: creatorId,
        },
      });
      gameIds.push(game.id);
      return game;
    }

    it('is 404 for an unrelated, unauthenticated viewer (control: gate still enforced)', async () => {
      const game = await makeNonPublicGame(RECENT_ENTITY_DATE);
      await request(app).get(`/games/${game.id}`).expect(404);
    });

    it('is 404 for a signed-in outsider with no post on the game (control)', async () => {
      const game = await makeNonPublicGame(RECENT_ENTITY_DATE);
      await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
    });

    it('is 200 for a contributor who posted to the game, within the 7-day grace window', async () => {
      const game = await makeNonPublicGame(RECENT_ENTITY_DATE);
      const post = await prisma.post.create({
        data: {
          author_id: contributorId,
          game_id: game.id,
          content: 'On the ground recap',
        },
      });
      postIds.push(post.id);

      const res = await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);
      expect(res.body.id).toBe(game.id);
    });

    it('is 200 for the same contributor on GET /games/:id/summary', async () => {
      const game = await makeNonPublicGame(RECENT_ENTITY_DATE);
      const post = await prisma.post.create({
        data: {
          author_id: contributorId,
          game_id: game.id,
          content: 'On the ground recap',
        },
      });
      postIds.push(post.id);

      await request(app)
        .get(`/games/${game.id}/summary`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);
    });

    it('is 404 again for a contributor once the 7-day grace window has elapsed', async () => {
      const game = await makeNonPublicGame(STALE_ENTITY_DATE);
      const post = await prisma.post.create({
        data: {
          author_id: contributorId,
          game_id: game.id,
          content: 'Old recap, window long closed',
        },
      });
      postIds.push(post.id);

      await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(404);
    });

    it('creator and staff visibility is unaffected (still 200)', async () => {
      const game = await makeNonPublicGame(RECENT_ENTITY_DATE);
      await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
    });
  });

  describe('GET /events/:id', () => {
    async function makePendingEvent(date: Date) {
      const event = await prisma.event.create({
        data: {
          title: `Grace Event ${ts}-${Math.random()}`,
          date,
          approval_status: 'pending',
          status: 'draft',
          creator_id: creatorId,
          creator_role: 'fan',
        },
      });
      eventIds.push(event.id);
      return event;
    }

    it('is 404 for an unrelated, unauthenticated viewer (control: gate still enforced)', async () => {
      const event = await makePendingEvent(RECENT_ENTITY_DATE);
      await request(app).get(`/events/${event.id}`).expect(404);
    });

    it('is 404 for a signed-in outsider with no post on the event (control)', async () => {
      const event = await makePendingEvent(RECENT_ENTITY_DATE);
      await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
    });

    it('is 200 for a contributor who posted to the event, within the 7-day grace window', async () => {
      const event = await makePendingEvent(RECENT_ENTITY_DATE);
      const post = await prisma.post.create({
        data: {
          author_id: contributorId,
          event_id: event.id,
          content: 'Event recap',
        },
      });
      postIds.push(post.id);

      const res = await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);
      expect(res.body.id).toBe(event.id);
    });

    it('is 404 again for a contributor once the 7-day grace window has elapsed', async () => {
      const event = await makePendingEvent(STALE_ENTITY_DATE);
      const post = await prisma.post.create({
        data: {
          author_id: contributorId,
          event_id: event.id,
          content: 'Old event recap, window long closed',
        },
      });
      postIds.push(post.id);

      await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(404);
    });

    it('creator visibility is unaffected (still 200)', async () => {
      const event = await makePendingEvent(RECENT_ENTITY_DATE);
      await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
    });
  });
});
