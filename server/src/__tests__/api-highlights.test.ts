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
        type: 'highlight',
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
        type: 'highlight',
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
    await prisma.user.deleteMany({
      where: { id: { in: [viewerId, blockedAuthorId, visibleAuthorId] } },
    });
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
    const allPosts = [...(res.body.nationalTop ?? []), ...(res.body.ranked ?? [])];
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
        type: 'highlight',
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
    const allPosts = [...(res.body.nationalTop ?? []), ...(res.body.ranked ?? [])];
    const postIds = allPosts.map((p: any) => p.id);
    expect(postIds).not.toContain(privatePostId);
  });
});

describe('GET /highlights — type filter', () => {
  let authorId: string;
  let highlightPostId: string;
  let regularPostId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    const author = await prisma.user.create({
      data: {
        email: `hl-type-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Type Author',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    authorId = author.id;

    const highlightPost = await prisma.post.create({
      data: {
        author_id: authorId,
        content: 'Real highlight',
        type: 'highlight',
        media_url: 'https://res.cloudinary.com/test/image/upload/highlight-type.jpg',
        country_code: 'US',
        upvotes_count: 75,
        deleted_at: null,
      },
    });
    highlightPostId = highlightPost.id;

    const regularPost = await prisma.post.create({
      data: {
        author_id: authorId,
        content: 'Regular media post',
        type: 'post',
        media_url: 'https://res.cloudinary.com/test/image/upload/post-type.jpg',
        country_code: 'US',
        upvotes_count: 999,
        deleted_at: null,
      },
    });
    regularPostId = regularPost.id;
  });

  afterAll(async () => {
    await prisma.post
      .deleteMany({ where: { id: { in: [highlightPostId, regularPostId] } } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  // REGRESSION GUARD: Highlights must NOT filter on `post.type`.
  //
  // `Post.type` is nullable with no default and has no backfill, and the main
  // create-post surface tags normal uploads `type: 'post'` (create-post.tsx:100
  // only sends 'highlight' when routed from a game's add-highlight button).
  // A `type: 'highlight'` WHERE clause therefore hides every regular media post
  // AND every legacy (type: null) post from Highlights forever — the recurring
  // "posted but not showing: it's a filter, not a save failure" incident.
  // Highlights is scoped by media_url + country + recency + privacy. Not by type.
  it('includes BOTH highlight-typed and generic media posts (no type filter)', async () => {
    const res = await request(app).get('/highlights?country=US&v2=1&sort=recent');

    expect(res.status).toBe(200);
    const ids = (res.body.items ?? []).map((p: any) => p.id);
    expect(ids).toContain(highlightPostId);
    expect(ids).toContain(regularPostId);
  });
});
