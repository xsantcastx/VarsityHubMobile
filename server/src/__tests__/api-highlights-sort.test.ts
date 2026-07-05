/**
 * GET /highlights?v2=1&sort=... — per-tab sort invariants.
 *
 * These exist because the client used to derive Recent/Top/Trending from one
 * trending-shaped pool (audit 2026-07-04): Recent missed brand-new
 * zero-engagement posts, Top missed comment-heavy posts, and Trending mixed
 * incompatible score scales. Each describe uses a unique country code so
 * ordering assertions are isolated from other test data.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const PASSWORD = 'TestPassword123!';
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

async function createAuthor(tag: string) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.create({
    data: {
      email: `hl-sort-${tag}-${Date.now()}@test.com`,
      password_hash: hash,
      display_name: `HL Sort ${tag}`,
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
}

async function createPost(
  authorId: string,
  country: string,
  opts: { upvotes?: number; createdDaysAgo?: number; content?: string } = {}
) {
  return prisma.post.create({
    data: {
      author_id: authorId,
      content: opts.content ?? 'hl sort test post',
      media_url: 'https://res.cloudinary.com/test/image/upload/sort.jpg',
      country_code: country,
      upvotes_count: opts.upvotes ?? 0,
      created_at: daysAgo(opts.createdDaysAgo ?? 0),
      deleted_at: null,
    },
  });
}

beforeAll(async () => {
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signJwt } = await import('../lib/jwt.js'));
});

describe('GET /highlights?v2=1&sort=recent — country NZ', () => {
  let authorId: string;
  let newestZeroEngagement: string; // Bug C repro: new post, zero engagement
  let midPost: string;
  let oldViralPost: string;
  const cleanup: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('recent');
    authorId = author.id;
    newestZeroEngagement = (await createPost(authorId, 'NZ', { upvotes: 0, createdDaysAgo: 0 })).id;
    midPost = (await createPost(authorId, 'NZ', { upvotes: 5, createdDaysAgo: 1 })).id;
    oldViralPost = (await createPost(authorId, 'NZ', { upvotes: 500, createdDaysAgo: 2 })).id;
    cleanup.push(newestZeroEngagement, midPost, oldViralPost);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: cleanup } } });
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  it('returns items strictly newest-first, ignoring engagement', async () => {
    const res = await request(app).get('/highlights?v2=1&country=NZ&sort=recent');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    const ids = res.body.items.map((p: any) => p.id);
    // The brand-new zero-engagement post MUST be present and first (Bug C repro)
    expect(ids.indexOf(newestZeroEngagement)).toBe(0);
    expect(ids.indexOf(midPost)).toBeLessThan(ids.indexOf(oldViralPost));
  });

  it('sorted response echoes the sort mode and omits legacy buckets', async () => {
    const res = await request(app).get('/highlights?v2=1&country=NZ&sort=recent');
    expect(res.body.sort).toBe('recent');
    expect(res.body.nationalTop).toBeUndefined();
    expect(res.body.ranked).toBeUndefined();
  });
});

describe('GET /highlights?v2=1&sort=recent — block filter applies (country IS)', () => {
  let viewerId: string;
  let viewerToken: string;
  let blockedAuthorId: string;
  let blockedPostId: string;

  beforeAll(async () => {
    const viewer = await createAuthor('blk-viewer');
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewerId });
    const blocked = await createAuthor('blk-author');
    blockedAuthorId = blocked.id;
    await prisma.blockedUser.create({
      data: { blocker_id: viewerId, blocked_id: blockedAuthorId },
    });
    blockedPostId = (await createPost(blockedAuthorId, 'IS', { upvotes: 50 })).id;
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: blockedPostId } });
    await prisma.blockedUser.deleteMany({ where: { blocker_id: viewerId } });
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, blockedAuthorId] } } });
  });

  it('excludes blocked authors from sorted items', async () => {
    const res = await request(app)
      .get('/highlights?v2=1&country=IS&sort=recent')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((p: any) => p.id)).not.toContain(blockedPostId);
  });
});

describe('GET /highlights?v2=1&sort=top — country FJ', () => {
  let authorId: string;
  let commentHeavyPost: string; // 2 upvotes + 4 comments = engagement 8
  let upvoteOnlyPost: string; // 5 upvotes = engagement 5
  let tooOldViralPost: string; // 40 days old — outside the 30-day window
  const cleanup: string[] = [];
  const commentIds: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('top');
    authorId = author.id;
    commentHeavyPost = (await createPost(authorId, 'FJ', { upvotes: 2, createdDaysAgo: 10 })).id;
    upvoteOnlyPost = (await createPost(authorId, 'FJ', { upvotes: 5, createdDaysAgo: 5 })).id;
    tooOldViralPost = (await createPost(authorId, 'FJ', { upvotes: 900, createdDaysAgo: 40 })).id;
    cleanup.push(commentHeavyPost, upvoteOnlyPost, tooOldViralPost);
    for (let i = 0; i < 4; i++) {
      const c = await prisma.comment.create({
        data: { post_id: commentHeavyPost, author_id: authorId, content: `comment ${i}` },
      });
      commentIds.push(c.id);
    }
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { id: { in: commentIds } } });
    await prisma.post.deleteMany({ where: { id: { in: cleanup } } });
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  it('ranks by upvotes + comments*1.5 within the last 30 days', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    // Comment-heavy (engagement 8) beats upvote-only (engagement 5) — Bug D repro
    expect(ids.indexOf(commentHeavyPost)).toBeLessThan(ids.indexOf(upvoteOnlyPost));
  });

  it('excludes posts older than 30 days regardless of upvotes', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.body.items.map((p: any) => p.id)).not.toContain(tooOldViralPost);
  });

  it('respects the limit param', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top&limit=1');
    expect(res.body.items.length).toBe(1);
  });
});

describe('GET /highlights?v2=1&sort=trending — country PE', () => {
  let authorId: string;
  let engagedPost: string; // 10 upvotes, 5 days old — score ~29
  let freshEmptyPost: string; // 0 engagement, brand new — score ~17
  let stalePost: string; // 20 days old — outside the 14-day trending window
  const cleanup: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('trend');
    authorId = author.id;
    engagedPost = (await createPost(authorId, 'PE', { upvotes: 10, createdDaysAgo: 5 })).id;
    freshEmptyPost = (await createPost(authorId, 'PE', { upvotes: 0, createdDaysAgo: 0 })).id;
    stalePost = (await createPost(authorId, 'PE', { upvotes: 300, createdDaysAgo: 20 })).id;
    cleanup.push(engagedPost, freshEmptyPost, stalePost);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: cleanup } } });
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  it('ranks real engagement above fresh zero-engagement posts (Bug A repro)', async () => {
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids.indexOf(engagedPost)).toBeLessThan(ids.indexOf(freshEmptyPost));
  });

  it('excludes posts older than 14 days', async () => {
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(res.body.items.map((p: any) => p.id)).not.toContain(stalePost);
  });

  it('items carry _score so the client can display it', async () => {
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(typeof res.body.items[0]._score).toBe('number');
  });
});

describe('GET /highlights — legacy shape unchanged when sort is absent', () => {
  it('v2 without sort still returns nationalTop + ranked (old OTA clients)', async () => {
    const res = await request(app).get('/highlights?v2=1&country=US');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nationalTop');
    expect(res.body).toHaveProperty('ranked');
    expect(res.body.items).toBeUndefined();
  });

  it('legacy (no v2) still returns nationalTop + local', async () => {
    const res = await request(app).get('/highlights?country=US');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nationalTop');
    expect(res.body).toHaveProperty('local');
    expect(res.body.items).toBeUndefined();
  });

  it('sort without v2 is ignored (legacy shape preserved)', async () => {
    const res = await request(app).get('/highlights?country=US&sort=recent');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('local');
    expect(res.body.items).toBeUndefined();
  });
});
