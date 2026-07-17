/**
 * GET /highlights?v2=1&sort=... — per-tab sort invariants.
 *
 * These started as the 2026-07-04 audit fix: the client used to derive
 * Recent/Top/Trending from one trending-shaped pool, so Recent missed brand-new
 * zero-engagement posts, Top missed comment-heavy posts, and Trending mixed
 * incompatible score scales.
 *
 * Re-pinned 2026-07-16 to the owner's definitions (Fanatics Fest punch list),
 * which the per-tab sorts still did not match:
 *   Recent   = most recent post, newest-first, no window.
 *   Trending = posts NEAR the viewer — proximity is the selection, not a
 *              tiebreak nudge on an engagement score.
 *   Top      = top 10 by engagement THIS CALENDAR MONTH.
 *
 * Each describe uses a unique country code so ordering assertions are isolated
 * from other test data.
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
  opts: {
    upvotes?: number;
    createdDaysAgo?: number;
    content?: string;
    createdAt?: Date;
    lat?: number;
    lng?: number;
  } = {}
) {
  return prisma.post.create({
    data: {
      author_id: authorId,
      content: opts.content ?? 'hl sort test post',
      type: 'highlight',
      media_url: 'https://res.cloudinary.com/test/image/upload/sort.jpg',
      country_code: country,
      upvotes_count: opts.upvotes ?? 0,
      created_at: opts.createdAt ?? daysAgo(opts.createdDaysAgo ?? 0),
      lat: opts.lat ?? null,
      lng: opts.lng ?? null,
      deleted_at: null,
    },
  });
}

/**
 * Start of the current UTC calendar month — the Top tab's window. Mirrors the
 * route so the test moves with the calendar instead of pinning a fixed date.
 */
function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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

  it('has no date window — an old post still shows when nothing newer exists', async () => {
    // Owner rule: "Recents should be most recent post." A 90-day cutoff used to
    // silently blank the tab for quiet regions; Recent is now purely an order.
    const ancient = await createPost(authorId, 'AQ', { upvotes: 0, createdDaysAgo: 400 });
    try {
      const res = await request(app).get('/highlights?v2=1&country=AQ&sort=recent');
      expect(res.status).toBe(200);
      expect(res.body.items.map((p: any) => p.id)).toContain(ancient.id);
    } finally {
      await prisma.post.deleteMany({ where: { id: ancient.id } });
    }
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

  it('block filter still applies on the proximity path (trending) and on top', async () => {
    // The trending rewrite added a lat/lng bounding box to the WHERE clause —
    // it must AND with the privacy clause, never replace it (CLAUDE.md:
    // "block filters merge, never clobber"). A blocked author's post sitting
    // right next to the viewer must still be invisible.
    const nearby = await prisma.post.update({
      where: { id: blockedPostId },
      data: { lat: 41.09, lng: -73.52 },
    });
    for (const url of [
      '/highlights?v2=1&country=IS&sort=trending&lat=41.09&lng=-73.52',
      '/highlights?v2=1&country=IS&sort=top',
    ]) {
      const res = await request(app).get(url).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.items.map((p: any) => p.id)).not.toContain(nearby.id);
    }
  });
});

/**
 * Owner rule (Fanatics Fest punch list, 2026-07-16):
 *   "top should top 10 post with the most engagement that month."
 * CALENDAR month, and exactly 10 — not a rolling 30-day window, and not a
 * client-tunable page size.
 */
describe('GET /highlights?v2=1&sort=top — country FJ', () => {
  let authorId: string;
  let commentHeavyPost: string; // 2 upvotes + 4 comments = engagement 8
  let upvoteOnlyPost: string; // 5 upvotes = engagement 5
  let lastMonthViralPost: string; // 1ms before this month — must never appear
  let monthStartPost: string; // exactly at monthStart — must appear (inclusive)
  const cleanup: string[] = [];
  const commentIds: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('top');
    authorId = author.id;
    commentHeavyPost = (await createPost(authorId, 'FJ', { upvotes: 2, createdAt: new Date() })).id;
    upvoteOnlyPost = (await createPost(authorId, 'FJ', { upvotes: 5, createdAt: new Date() })).id;
    // The exact boundary: the final millisecond of the previous calendar month.
    // Under the old rolling-30-day rule this 900-upvote post dominated Top for
    // the first ~29 days of every month.
    lastMonthViralPost = (
      await createPost(authorId, 'FJ', {
        upvotes: 900,
        createdAt: new Date(monthStart().getTime() - 1),
      })
    ).id;
    monthStartPost = (await createPost(authorId, 'FJ', { upvotes: 1, createdAt: monthStart() })).id;
    cleanup.push(commentHeavyPost, upvoteOnlyPost, lastMonthViralPost, monthStartPost);
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

  it('ranks by engagement (upvotes + comments*1.5 + bookmarks*1.5)', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    // Comment-heavy (engagement 8) beats upvote-only (engagement 5) — Bug D repro
    expect(ids.indexOf(commentHeavyPost)).toBeLessThan(ids.indexOf(upvoteOnlyPost));
  });

  it('excludes last calendar month, even 1ms before the boundary and even when viral', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.body.items.map((p: any) => p.id)).not.toContain(lastMonthViralPost);
  });

  it('includes a post created exactly at the month boundary (gte, not gt)', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.body.items.map((p: any) => p.id)).toContain(monthStartPost);
  });

  it('caps at exactly 10 — ?limit= must never widen it', async () => {
    const extra: string[] = [];
    for (let i = 0; i < 12; i++) {
      extra.push(
        (await createPost(authorId, 'FJ', { upvotes: 500 + i, createdAt: new Date() })).id
      );
    }
    try {
      const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top&limit=50');
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(10);
    } finally {
      await prisma.post.deleteMany({ where: { id: { in: extra } } });
    }
  });

  it('never returns more than 10 even when the client asks for fewer', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top&limit=1');
    expect(res.body.items.length).toBeLessThanOrEqual(10);
  });
});

/**
 * Owner rule (Fanatics Fest punch list, 2026-07-16):
 *   "Trending should be post nearby them."
 * Proximity IS the selection. Before this, proximity was a +6 additive nudge on
 * an engagement score, so a viral post ~3900km away outranked every local one
 * (live-reproduced against a local API, 2026-07-16). These pin the inversion.
 */
describe('GET /highlights?v2=1&sort=trending — proximity (country PE)', () => {
  // Stamford CT — the owner's real profile zip (06907) resolves near here.
  const VIEWER = { lat: 41.09, lng: -73.52 };
  let authorId: string;
  let nearQuietPost: string; // ~1km away, zero engagement
  let midPost: string; // ~55km away (Manhattan-ish)
  let farViralPost: string; // Los Angeles, 900 upvotes — must NOT win
  const cleanup: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('trend');
    authorId = author.id;
    nearQuietPost = (await createPost(authorId, 'PE', { upvotes: 0, lat: 41.1, lng: -73.53 })).id;
    midPost = (await createPost(authorId, 'PE', { upvotes: 2, lat: 40.76, lng: -74.0 })).id;
    farViralPost = (await createPost(authorId, 'PE', { upvotes: 900, lat: 34.05, lng: -118.24 }))
      .id;
    cleanup.push(nearQuietPost, midPost, farViralPost);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: cleanup } } });
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  it('orders strictly nearest-first, ignoring engagement', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids.indexOf(nearQuietPost)).toBeLessThan(ids.indexOf(midPost));
  });

  it('a zero-engagement post nearby outranks a viral post far away (the owner bug)', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids[0]).toBe(nearQuietPost);
  });

  it('excludes posts beyond the radius entirely', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    expect(res.body.items.map((p: any) => p.id)).not.toContain(farViralPost);
  });

  it('items carry _distance_km ascending so the client can show proximity', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const distances = res.body.items.map((p: any) => p._distance_km);
    expect(typeof distances[0]).toBe('number');
    expect(distances).toEqual([...distances].sort((a: number, b: number) => a - b));
  });

  it('falls back to newest-first (never an empty tab) when the viewer has no location', async () => {
    // No lat/lng, and an anonymous viewer has no preferences.zip_code to fall
    // back to. Today this is EVERY user: 0/46 in prod have preferences.lat.
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const times = res.body.items.map((p: any) => new Date(p.created_at).getTime());
    expect(times).toEqual([...times].sort((a: number, b: number) => b - a));
  });

  it('falls back to newest-first when the viewer is nowhere near any post', async () => {
    // Mid-Pacific: nothing within RADIUS_KM. Must degrade, not blank out.
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending&lat=0&lng=-160');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });
});

describe('GET /highlights?v2=1&sort=trending — zip fallback (country GH)', () => {
  let viewerId: string;
  let viewerToken: string;
  let authorId: string;
  let nearPost: string;
  let farPost: string;

  beforeAll(async () => {
    // Manhattan zip: '100' is in the static ZIP_PREFIX_COORDS table, so this
    // resolves without touching the geocoder.
    const viewer = await createAuthor('zipv');
    viewerId = viewer.id;
    await prisma.user.update({
      where: { id: viewerId },
      data: {
        preferences: { role: 'fan', onboarding_completed: true, zip_code: '10001' },
      },
    });
    viewerToken = signJwt({ id: viewerId });
    const author = await createAuthor('zipa');
    authorId = author.id;
    nearPost = (await createPost(authorId, 'GH', { upvotes: 0, lat: 40.71, lng: -74.01 })).id;
    farPost = (await createPost(authorId, 'GH', { upvotes: 900, lat: 34.05, lng: -118.24 })).id;
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: [nearPost, farPost] } } });
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, authorId] } } });
  });

  it('resolves proximity from preferences.zip_code when the client sends no coords', async () => {
    // The real-world path: the client has never had preferences.lat to send.
    const res = await request(app)
      .get('/highlights?v2=1&country=GH&sort=trending')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids).toContain(nearPost);
    expect(ids).not.toContain(farPost);
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
