/**
 * Highlights endpoint — privacy and block filter regression tests.
 *
 * These tests exist because:
 *   1. The block filter was missing from highlights entirely (found in code audit).
 *   2. The privacy filter existed but had no automated regression guard.
 *
 * If either filter is removed or broken, these tests catch it immediately.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';
import { invalidatePrivateIdsCache } from '../lib/privacyUtils.js';

let prisma: any;
let signJwt: any;

const PASSWORD = 'TestPassword123!';

describe('GET /highlights — block filter', () => {
  let viewerId: string;
  let viewerToken: string;
  let blockedAuthorId: string;
  let visibleAuthorId: string;
  let blockedPostId: string;
  let visiblePostId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const viewer = await prisma.user.create({
      data: {
        email: `hl-viewer-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'HL Viewer',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewerId });

    const blockedAuthor = await prisma.user.create({
      data: {
        email: `hl-blocked-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'HL Blocked',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    blockedAuthorId = blockedAuthor.id;

    const visibleAuthor = await prisma.user.create({
      data: {
        email: `hl-visible-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'HL Visible',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    visibleAuthorId = visibleAuthor.id;

    // Viewer blocks blockedAuthor (bidirectional — either direction should filter)
    await prisma.blockedUser.create({
      data: { blocker_id: viewerId, blocked_id: blockedAuthorId },
    });

    // Both authors create posts with media (highlights only includes media posts)
    const blockedPost = await prisma.post.create({
      data: {
        author_id: blockedAuthorId,
        content: 'HL blocked post',
        media_url: 'https://res.cloudinary.com/test/image/upload/blocked.jpg',
        country_code: 'US',
        upvotes_count: 100,
        deleted_at: null,
      },
    });
    blockedPostId = blockedPost.id;

    const visiblePost = await prisma.post.create({
      data: {
        author_id: visibleAuthorId,
        content: 'HL visible post',
        media_url: 'https://res.cloudinary.com/test/image/upload/visible.jpg',
        country_code: 'US',
        upvotes_count: 100,
        deleted_at: null,
      },
    });
    visiblePostId = visiblePost.id;
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: [blockedPostId, visiblePostId] } } });
    await prisma.blockedUser.deleteMany({ where: { blocker_id: viewerId } });
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, blockedAuthorId, visibleAuthorId] } } });
  });

  it('excludes posts from blocked users', async () => {
    const res = await request(app)
      .get('/highlights?country=US&v2=1')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);

    const allPosts = [
      ...(res.body.nationalTop ?? []),
      ...(res.body.ranked ?? []),
      ...(res.body.local ?? []),
    ];

    const postIds = allPosts.map((p: any) => p.id);
    expect(postIds).not.toContain(blockedPostId);
  });

  it('includes posts from non-blocked authors', async () => {
    const res = await request(app)
      .get('/highlights?country=US&v2=1')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    // visiblePostId should appear in nationalTop or ranked (it has upvotes_count=100)
    const allPosts = [
      ...(res.body.nationalTop ?? []),
      ...(res.body.ranked ?? []),
    ];
    const postIds = allPosts.map((p: any) => p.id);
    expect(postIds).toContain(visiblePostId);
  });

  it('returns 200 for unauthenticated request (no block filter applied)', async () => {
    const res = await request(app).get('/highlights?country=US&v2=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nationalTop');
  });
});

describe('GET /highlights — privacy filter', () => {
  let viewerId: string;
  let viewerToken: string;
  let privateAuthorId: string;
  let privatePostId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    const viewer = await prisma.user.create({
      data: {
        email: `hl-priv-viewer-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Priv Viewer',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewerId });

    // Private-profile author (viewer does not follow them).
    // profile_private lives in preferences, not as a DB column.
    const privateAuthor = await prisma.user.create({
      data: {
        email: `hl-private-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Private Author',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true, profile_private: true },
      },
    });
    privateAuthorId = privateAuthor.id;

    // Bust the module-level cache so the new private user is picked up immediately
    invalidatePrivateIdsCache();

    const privatePost = await prisma.post.create({
      data: {
        author_id: privateAuthorId,
        content: 'HL private post',
        media_url: 'https://res.cloudinary.com/test/image/upload/private.jpg',
        country_code: 'US',
        upvotes_count: 200,
        deleted_at: null,
      },
    });
    privatePostId = privatePost.id;
  });

  afterAll(async () => {
    await prisma.post.delete({ where: { id: privatePostId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, privateAuthorId] } } });
  });

  it('excludes posts from private-profile authors the viewer does not follow', async () => {
    const res = await request(app)
      .get('/highlights?country=US&v2=1')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    const allPosts = [
      ...(res.body.nationalTop ?? []),
      ...(res.body.ranked ?? []),
    ];
    const postIds = allPosts.map((p: any) => p.id);
    expect(postIds).not.toContain(privatePostId);
  });
});

/**
 * Global-feed regression: Highlights must NOT hard-filter on country_code.
 * Previously a post whose country_code was null or a different country than the
 * viewer's was permanently invisible in Highlights — the root cause of
 * "I only ever see some users' posts". These two posts must now be reachable
 * for a US viewer.
 */
describe('GET /highlights — global feed (no country hard-filter)', () => {
  let viewerId: string;
  let viewerToken: string;
  let foreignAuthorId: string;
  let nullCountryAuthorId: string;
  let foreignPostId: string;
  let nullCountryPostId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    const viewer = await prisma.user.create({
      data: {
        email: `hl-global-viewer-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Global Viewer',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true, country_code: 'US' },
      },
    });
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewerId });

    const foreignAuthor = await prisma.user.create({
      data: {
        email: `hl-foreign-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Foreign Author',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    foreignAuthorId = foreignAuthor.id;

    const nullCountryAuthor = await prisma.user.create({
      data: {
        email: `hl-nullcountry-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Null Country Author',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    nullCountryAuthorId = nullCountryAuthor.id;

    const foreignPost = await prisma.post.create({
      data: {
        author_id: foreignAuthorId,
        content: 'HL foreign-country post',
        media_url: 'https://res.cloudinary.com/test/image/upload/foreign.jpg',
        country_code: 'GB',
        upvotes_count: 5,
        deleted_at: null,
      },
    });
    foreignPostId = foreignPost.id;

    const nullCountryPost = await prisma.post.create({
      data: {
        author_id: nullCountryAuthorId,
        content: 'HL null-country post',
        media_url: 'https://res.cloudinary.com/test/image/upload/nullcountry.jpg',
        country_code: null,
        upvotes_count: 5,
        deleted_at: null,
      },
    });
    nullCountryPostId = nullCountryPost.id;
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: [foreignPostId, nullCountryPostId] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [viewerId, foreignAuthorId, nullCountryAuthorId] } },
    });
  });

  it('includes a post from a different country for a US viewer', async () => {
    const res = await request(app)
      .get('/highlights?country=US&v2=1&limit=100')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    const postIds = [
      ...(res.body.nationalTop ?? []),
      ...(res.body.ranked ?? []),
    ].map((p: any) => p.id);
    expect(postIds).toContain(foreignPostId);
  });

  it('includes a post with a null country_code for a US viewer', async () => {
    const res = await request(app)
      .get('/highlights?country=US&v2=1&limit=100')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    const postIds = [
      ...(res.body.nationalTop ?? []),
      ...(res.body.ranked ?? []),
    ].map((p: any) => p.id);
    expect(postIds).toContain(nullCountryPostId);
  });
});
