/**
 * GET /games/:id and GET /events/:id VIEW access — real-DB integration.
 *
 * Owner rule (2026-07-14, verbatim): "Any user can view any past game at any
 * time — it will always be on the app. It'll lock posting, but any user can
 * view any past game at any time." So:
 *   - A moderation-approved game that is PAST is public to everyone, forever,
 *     regardless of opponent-consent status (an opponent-consent re-flip must
 *     never make an already-played game disappear).
 *   - UPCOMING games still awaiting opponent consent stay gated (don't publicly
 *     attribute a future fixture to a team that hasn't confirmed) — but a
 *     contributor who posted there can always view it.
 *   - Viewing NEVER expires. The 7-day cap applies only to POSTING
 *     (geofencing-post-grace-window.test.ts).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

const FUTURE_DATE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // upcoming
const PAST_DATE = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // recently played
const OLD_PAST_DATE = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // long past

describe('VIEW access (viewing is permanent + universal for past games)', () => {
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
        name: `View Rules League ${ts}`,
        org_type: 'league',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({ data: { name: `View Home ${ts}`, organization_id: orgId } }),
      prisma.team.create({ data: { name: `View Away ${ts}`, organization_id: orgId } }),
    ]);
    homeTeamId = homeTeam.id;
    awayTeamId = awayTeam.id;

    async function makeUser(label: string) {
      const user = await prisma.user.create({
        data: {
          email: `view-rules-${label}-${ts}@example.com`,
          password_hash: hash,
          display_name: `View ${label}`,
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'fan', plan: 'rookie', onboarding_completed: true },
        },
      });
      return { id: user.id, token: signJwt({ id: user.id }) };
    }

    // Creator holds no team/org staff role, so everyone else's visibility
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
      await prisma.team
        .deleteMany({ where: { id: { in: [homeTeamId, awayTeamId] } } })
        .catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [creatorId, contributorId, outsiderId] } } })
        .catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  // approved + opponent-pending == the "opponent-consent re-flip" shape that
  // used to make a game non-public.
  async function makeGame(date: Date) {
    const game = await prisma.game.create({
      data: {
        title: `View Game ${ts}-${Math.random()}`,
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

  describe('GET /games/:id', () => {
    it('PAST approved game is 200 for an unauthenticated outsider (any user, any past game)', async () => {
      const game = await makeGame(PAST_DATE);
      await request(app).get(`/games/${game.id}`).expect(200);
    });

    it('a long-past game is STILL 200 — viewing never expires', async () => {
      const game = await makeGame(OLD_PAST_DATE);
      await request(app).get(`/games/${game.id}`).expect(200);
    });

    it('UPCOMING opponent-pending game is 404 for an unauthenticated outsider (still gated)', async () => {
      const game = await makeGame(FUTURE_DATE);
      await request(app).get(`/games/${game.id}`).expect(404);
    });

    it('UPCOMING opponent-pending game is 404 for a signed-in outsider with no post', async () => {
      const game = await makeGame(FUTURE_DATE);
      await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
    });

    it('a contributor who posted can view an UPCOMING opponent-pending game (permanent, read-only)', async () => {
      const game = await makeGame(FUTURE_DATE);
      const post = await prisma.post.create({
        data: { author_id: contributorId, game_id: game.id, content: 'pre-game hype' },
      });
      postIds.push(post.id);
      const res = await request(app)
        .get(`/games/${game.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);
      expect(res.body.id).toBe(game.id);
    });

    it('creator visibility is unaffected (200) on an upcoming game', async () => {
      const game = await makeGame(FUTURE_DATE);
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
          title: `View Event ${ts}-${Math.random()}`,
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

    it('non-approved event is 404 for an unauthenticated outsider (control)', async () => {
      const event = await makePendingEvent(PAST_DATE);
      await request(app).get(`/events/${event.id}`).expect(404);
    });

    it('non-approved event is 404 for a signed-in outsider with no post (control)', async () => {
      const event = await makePendingEvent(PAST_DATE);
      await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
    });

    it('a contributor who posted can view the event (200)', async () => {
      const event = await makePendingEvent(PAST_DATE);
      const post = await prisma.post.create({
        data: { author_id: contributorId, event_id: event.id, content: 'event recap' },
      });
      postIds.push(post.id);
      const res = await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);
      expect(res.body.id).toBe(event.id);
    });

    it('a contributor STILL views a long-stale event — viewing never expires (was: 404 after 7 days)', async () => {
      const event = await makePendingEvent(OLD_PAST_DATE);
      const post = await prisma.post.create({
        data: { author_id: contributorId, event_id: event.id, content: 'old recap' },
      });
      postIds.push(post.id);
      await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);
    });

    it('creator visibility is unaffected (200)', async () => {
      const event = await makePendingEvent(PAST_DATE);
      await request(app)
        .get(`/events/${event.id}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
    });
  });
});
