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
