/**
 * Post <-> event/game link integrity.
 *
 * Guarantees that a post created against a game or event is ALWAYS tied to it
 * in BOTH directions:
 *   - post created with game_id       -> also carries event_id (game's event)
 *   - post created with event_id      -> also carries game_id  (event's game)
 *   - event-only post (event, no game) -> keeps event_id, game_id stays null
 * and that a legacy row carrying only one column is still found by the other
 * page's query (symmetric reads).
 *
 * Admin posts bypass the venue geofence, which keeps the test focused on the
 * linkage logic rather than GPS.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './helpers/dbTestSuite.js';

let prisma: any;
let signJwt: any;

describeDb('Post <-> event/game link denormalization', () => {
  let adminUser: any;
  let adminToken: string;
  let reusedAdmin = false;
  let orgId: string;
  let gameId: string;
  let eventId: string; // event linked to gameId
  let eventOnlyId: string; // event with no game
  const created: string[] = [];

  // Admin ACCESS is the hardcoded PLATFORM_ADMIN_EMAILS floor (not ADMIN_EMAILS),
  // and admins bypass the venue geofence — which keeps this test about linkage,
  // not GPS. Upsert by that email so we don't collide with a leftover row.
  const ADMIN_EMAIL = 'emancero@varsityhub.app';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existingAdmin) {
      adminUser = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { email_verified: true },
      });
      reusedAdmin = true;
    } else {
      adminUser = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          password_hash: await bcrypt.hash('TestPassword123!', 10),
          display_name: 'Link Denorm Admin',
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'fan', onboarding_completed: true },
        },
      });
    }
    adminToken = signJwt({ id: adminUser.id });

    const org = await prisma.organization.create({
      data: { name: `Link denorm org ${Date.now()}`, org_type: 'club', updated_at: new Date() },
    });
    orgId = org.id;

    const game = await prisma.game.create({
      data: {
        title: `Link denorm game ${Date.now()}`,
        date: new Date(Date.now() + 60 * 60 * 1000),
        location: 'Denorm Stadium',
        approval_status: 'approved',
      },
    });
    gameId = game.id;

    const event = await prisma.event.create({
      data: {
        title: `Link denorm event ${Date.now()}`,
        date: new Date(Date.now() + 60 * 60 * 1000),
        location: 'Denorm Stadium',
        latitude: 40.7128,
        longitude: -74.006,
        game_id: gameId,
        status: 'approved',
        approval_status: 'approved',
        creator_id: adminUser.id,
        creator_role: 'coach',
      },
    });
    eventId = event.id;

    const eventOnly = await prisma.event.create({
      data: {
        title: `Link denorm event-only ${Date.now()}`,
        date: new Date(Date.now() + 60 * 60 * 1000),
        location: 'Community Hall',
        latitude: 40.7128,
        longitude: -74.006,
        status: 'approved',
        approval_status: 'approved',
        creator_id: adminUser.id,
        creator_role: 'coach',
      },
    });
    eventOnlyId = eventOnly.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (created.length) {
      await prisma.post.deleteMany({ where: { id: { in: created } } }).catch(() => {});
    }
    await prisma.event
      .deleteMany({ where: { id: { in: [eventId, eventOnlyId].filter(Boolean) } } })
      .catch(() => {});
    await prisma.game.delete({ where: { id: gameId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    // Only remove the admin if we created it — never delete a pre-existing row.
    if (!reusedAdmin) {
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
  });

  it('posting with game_id backfills event_id from the game event', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'game-linked recap', game_id: gameId });
    expect(res.status).toBe(201);
    created.push(res.body.id);

    const row = await prisma.post.findUnique({
      where: { id: res.body.id },
      select: { game_id: true, event_id: true },
    });
    expect(row.game_id).toBe(gameId);
    expect(row.event_id).toBe(eventId); // denormalized
  });

  it('posting with event_id backfills game_id from the event game', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'event-linked recap', event_id: eventId });
    expect(res.status).toBe(201);
    created.push(res.body.id);

    const row = await prisma.post.findUnique({
      where: { id: res.body.id },
      select: { game_id: true, event_id: true },
    });
    expect(row.event_id).toBe(eventId);
    expect(row.game_id).toBe(gameId); // denormalized
  });

  it('event-only post keeps event_id and leaves game_id null', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'community meetup recap', event_id: eventOnlyId });
    expect(res.status).toBe(201);
    created.push(res.body.id);

    const row = await prisma.post.findUnique({
      where: { id: res.body.id },
      select: { game_id: true, event_id: true },
    });
    expect(row.event_id).toBe(eventOnlyId);
    expect(row.game_id).toBeNull();
  });

  it('GET /games/:id/posts finds a legacy post tied only via event_id', async () => {
    // Simulate a legacy row that never got game_id denormalized.
    const legacy = await prisma.post.create({
      data: { author_id: adminUser.id, content: 'legacy event-only post', event_id: eventId },
    });
    created.push(legacy.id);

    const res = await request(app)
      .get(`/games/${gameId}/posts`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map(p => p.id);
    expect(ids).toContain(legacy.id);
  });
});
