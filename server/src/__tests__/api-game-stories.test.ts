import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Game stories API geofencing', () => {
  let testUser: any;
  let testUserToken: string;
  let gameId: string;
  let eventId: string;
  let adminUser: any;
  let adminToken: string;
  let bypassMemberUser: any;
  let bypassMemberToken: string;
  let orgId: string;
  let homeTeamId: string;
  let awayTeamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    testUser = await prisma.user.create({
      data: {
        email: `test-story-geofence-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Story Geofence User',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    testUserToken = signJwt({ id: testUser.id });

    const priorAdminEmails = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = ['admin-story-geofence@varsityhub.app', priorAdminEmails]
      .filter(Boolean)
      .join(',');
    // Admin ACCESS comes from the hardcoded floor; ADMIN_EMAILS grants nothing.
    // TEST_PLATFORM_ADMIN_EMAILS is the test-only seam (honored only in NODE_ENV=test).
    process.env.TEST_PLATFORM_ADMIN_EMAILS = 'admin-story-geofence@varsityhub.app';

    adminUser = await prisma.user.create({
      data: {
        email: 'admin-story-geofence@varsityhub.app',
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Story Admin',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    adminToken = signJwt({ id: adminUser.id });

    bypassMemberUser = await prisma.user.create({
      data: {
        email: `story-bypass-member-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Story Team Member',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    bypassMemberToken = signJwt({ id: bypassMemberUser.id });

    const org = await prisma.organization.create({
      data: {
        name: `Story geofence org ${Date.now()}`,
        org_type: 'club',
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Story bypass home ${Date.now()}`,
          organization_id: orgId,
        },
      }),
      prisma.team.create({
        data: {
          name: `Story bypass away ${Date.now()}`,
          organization_id: orgId,
        },
      }),
    ]);
    homeTeamId = homeTeam.id;
    awayTeamId = awayTeam.id;

    const game = await prisma.game.create({
      data: {
        title: `Story geofence game ${Date.now()}`,
        date: new Date(),
        location: 'VarsityHub Fieldhouse',
        approval_status: 'approved',
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      },
    });
    gameId = game.id;

    const event = await prisma.event.create({
      data: {
        title: `Story geofence event ${Date.now()}`,
        date: new Date(),
        location: 'VarsityHub Fieldhouse',
        latitude: 40.7128,
        longitude: -74.006,
        game_id: gameId,
        status: 'approved',
        approval_status: 'approved',
        creator_id: testUser.id,
        creator_role: 'coach',
      },
    });
    eventId = event.id;

    await prisma.teamMembership.create({
      data: {
        team_id: homeTeamId,
        user_id: bypassMemberUser.id,
        role: 'coach',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
    await prisma.story.deleteMany({ where: { game_id: gameId } }).catch(() => {});
    if (eventId) {
      await prisma.event.delete({ where: { id: eventId } }).catch(() => {});
    }
    if (gameId) {
      await prisma.game.delete({ where: { id: gameId } }).catch(() => {});
    }
    await prisma.teamMembership
      .deleteMany({ where: { user_id: bypassMemberUser?.id } })
      .catch(() => {});
    await prisma.team
      .deleteMany({ where: { id: { in: [homeTeamId, awayTeamId].filter(Boolean) } } })
      .catch(() => {});
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { id: adminUser?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: bypassMemberUser?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  });

  it.each(['zip', 'derived', 'places'] as const)(
    'rejects story uploads when location source is %s',
    async source => {
      const res = await request(app)
        .post(`/games/${gameId}/stories`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          media_url: 'https://res.cloudinary.com/demo/image/upload/story.jpg',
          caption: 'Trying to post with non-device coordinates',
          location: {
            lat: 40.7128,
            lng: -74.006,
            source,
          },
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('LOCATION_REQUIRED');
      expect(res.body.message).toMatch(/device location/i);
    }
  );

  it('rejects story uploads when location source is missing', async () => {
    const res = await request(app)
      .post(`/games/${gameId}/stories`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        media_url: 'https://res.cloudinary.com/demo/image/upload/story-missing-source.jpg',
        caption: 'Trying to post without an explicit device source',
        location: {
          lat: 40.7128,
          lng: -74.006,
        },
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('LOCATION_REQUIRED');
    expect(res.body.message).toMatch(/device location/i);
  });

  it('allows story uploads when device-origin coordinates are within 1 km', async () => {
    const res = await request(app)
      .post(`/games/${gameId}/stories`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        media_url: 'https://res.cloudinary.com/demo/image/upload/story-device.jpg',
        caption: 'Posting with device coordinates',
        location: {
          lat: 40.7128,
          lng: -74.006,
          source: 'device',
        },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();

    await prisma.story.delete({ where: { id: res.body.id } }).catch(() => {});
  });

  it('rejects story uploads when the linked event has no venue coordinates', async () => {
    const missingCoordsGame = await prisma.game.create({
      data: {
        title: `Story no-coords game ${Date.now()}`,
        date: new Date(),
        location: 'Venue name only',
        approval_status: 'approved',
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      },
    });

    const missingCoordsEvent = await prisma.event.create({
      data: {
        title: `Story no-coords event ${Date.now()}`,
        date: new Date(),
        location: 'Venue name only',
        game_id: missingCoordsGame.id,
        status: 'approved',
        approval_status: 'approved',
        creator_id: testUser.id,
        creator_role: 'coach',
      },
    });

    try {
      const res = await request(app)
        .post(`/games/${missingCoordsGame.id}/stories`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          media_url: 'https://res.cloudinary.com/demo/image/upload/story-no-coords.jpg',
          caption: 'Story should fail without venue coordinates',
          location: {
            lat: 40.7128,
            lng: -74.006,
            source: 'device',
          },
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('NO_EVENT_LOCATION');
      expect(res.body.message).toMatch(/disabled until the location is configured/i);
    } finally {
      await prisma.event.delete({ where: { id: missingCoordsEvent.id } }).catch(() => {});
      await prisma.game.delete({ where: { id: missingCoordsGame.id } }).catch(() => {});
    }
  });

  it('lets admins bypass story geofencing without device-origin location', async () => {
    const res = await request(app)
      .post(`/games/${gameId}/stories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        media_url: 'https://res.cloudinary.com/demo/image/upload/story-admin-bypass.jpg',
        caption: 'Admin bypasses geofence',
        location: {
          source: 'places',
        },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();

    await prisma.story.delete({ where: { id: res.body.id } }).catch(() => {});
  });

  it('rejects active team members without device-origin location', async () => {
    const res = await request(app)
      .post(`/games/${gameId}/stories`)
      .set('Authorization', `Bearer ${bypassMemberToken}`)
      .send({
        media_url: 'https://res.cloudinary.com/demo/image/upload/story-team-bypass.jpg',
        caption: 'Team member bypasses geofence',
        location: {
          source: 'derived',
        },
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('LOCATION_REQUIRED');
  });
});
