import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

const PASSWORD = 'TestPassword123!';
const ts = Date.now();

describeDb('GET /feed/bundle', () => {
  const userIds: string[] = [];
  const postIds: string[] = [];
  const teamIds: string[] = [];
  const orgIds: string[] = [];
  const adIds: string[] = [];

  let viewerToken = '';
  let viewerId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const viewer = await prisma.user.create({
      data: {
        email: `feed-viewer-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Feed Viewer',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1992-01-01'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: {
          role: 'fan',
          onboarding_completed: true,
          country_code: 'US',
        },
      },
    });
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewer.id });
    userIds.push(viewer.id);

    const followedAuthor = await prisma.user.create({
      data: {
        email: `feed-followed-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Followed Author',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-05-05'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userIds.push(followedAuthor.id);

    const actor = await prisma.user.create({
      data: {
        email: `feed-actor-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Actor',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1991-06-06'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userIds.push(actor.id);

    await prisma.follows.create({
      data: {
        follower_id: viewer.id,
        following_id: followedAuthor.id,
        status: 'accepted',
      },
    });

    const organization = await prisma.organization.create({
      data: {
        name: `Feed Bundle Org ${ts}`,
        location: 'New York, NY',
        zip_code: '10001',
        admin_approved: true,
        status: 'active',
      },
    });
    orgIds.push(organization.id);

    const team = await prisma.team.create({
      data: {
        name: `Feed Bundle Team ${ts}`,
        organization_id: organization.id,
        sport: 'Basketball',
        status: 'active',
      },
    });
    teamIds.push(team.id);

    await prisma.teamFollow.create({
      data: {
        user_id: viewer.id,
        team_id: team.id,
      },
    });

    const followedPost = await prisma.post.create({
      data: {
        author_id: followedAuthor.id,
        title: 'Followed post',
        content: 'From followed user',
        type: 'post',
        country_code: 'US',
      },
    });
    postIds.push(followedPost.id);

    const teamPost = await prisma.post.create({
      data: {
        author_id: actor.id,
        team_id: team.id,
        title: 'Team post',
        content: 'From followed team',
        type: 'post',
        country_code: 'US',
      },
    });
    postIds.push(teamPost.id);

    await prisma.postUpvote.create({
      data: {
        user_id: viewer.id,
        post_id: followedPost.id,
      },
    });

    await prisma.notification.create({
      data: {
        user_id: viewer.id,
        actor_id: actor.id,
        type: 'FOLLOW',
      },
    });

    await prisma.message.create({
      data: {
        sender_id: actor.id,
        recipient_id: viewer.id,
        conversation_id: `dm:${[actor.id, viewer.id].sort().join('__')}`,
        content: 'Unread bundle message',
        read: false,
      },
    });

    const ad = await prisma.ad.create({
      data: {
        user_id: actor.id,
        contact_name: 'Bundle Advertiser',
        contact_email: `feed-ad-${ts}@example.com`,
        business_name: 'Bundle Ad',
        banner_url: 'https://example.com/banner.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        target_lat: 40.7506,
        target_lng: -73.9972,
        radius: 25,
        description: 'Feed ad',
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: {
            date: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
          },
        },
      },
    });
    adIds.push(ad.id);
  });

  afterAll(async () => {
    try {
      await prisma.message.deleteMany({
        where: {
          OR: [{ sender_id: { in: userIds } }, { recipient_id: { in: userIds } }],
        },
      }).catch(() => {});
      await prisma.notification.deleteMany({
        where: {
          OR: [{ user_id: { in: userIds } }, { actor_id: { in: userIds } }],
        },
      }).catch(() => {});
      await prisma.postUpvote.deleteMany({
        where: {
          user_id: { in: userIds },
          post_id: { in: postIds },
        },
      }).catch(() => {});
      await prisma.teamFollow.deleteMany({
        where: { user_id: { in: userIds }, team_id: { in: teamIds } },
      }).catch(() => {});
      await prisma.follows.deleteMany({
        where: {
          OR: [{ follower_id: { in: userIds } }, { following_id: { in: userIds } }],
        },
      }).catch(() => {});
      await prisma.ad.deleteMany({ where: { id: { in: adIds } } }).catch(() => {});
      await prisma.post.deleteMany({ where: { id: { in: postIds } } }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: { in: teamIds } } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } }).catch(() => {});
      await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  it('returns the bundled feed contract with unread counts and reservation-free ads', async () => {
    const res = await request(app)
      .get('/feed/bundle')
      .set('Authorization', `Bearer ${viewerToken}`)
      .query({
        country: 'US',
        date: new Date().toISOString().slice(0, 10),
        lat: 40.7506,
        lng: -73.9972,
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.posts?.items)).toBe(true);
    expect(Array.isArray(res.body?.posts_followed_teams?.items)).toBe(true);
    expect(Array.isArray(res.body?.highlights?.nationalTop)).toBe(true);
    expect(Array.isArray(res.body?.highlights?.ranked)).toBe(true);
    expect(res.body?.unread_notifications).toBe(1);
    expect(res.body?.unread_messages).toBe(1);

    const followedIds = (res.body?.posts?.items ?? []).map((item: any) => item.id);
    const teamIdsFromBundle = (res.body?.posts_followed_teams?.items ?? []).map((item: any) => item.id);
    expect(followedIds.length).toBeGreaterThan(0);
    expect(teamIdsFromBundle.length).toBeGreaterThan(0);
    expect(res.body?.posts?.followed_feed_meta?.following_count).toBe(1);
    expect(res.body?.posts_followed_teams?.followed_teams_feed_meta?.followed_teams_count).toBe(1);

    expect(res.body?.ads?.date).toBe(new Date().toISOString().slice(0, 10));
    expect(Array.isArray(res.body?.ads?.ads)).toBe(true);
    expect(res.body?.ads?.ads.length).toBeGreaterThan(0);
    expect(res.body.ads.ads[0]).not.toHaveProperty('reservations');

    const viewerRow = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { id: true },
    });
    expect(viewerRow?.id).toBe(viewerId);
  });
});
