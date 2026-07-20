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

  it('block filter still applies on the trending and top paths', async () => {
    // Trending scores a country-scoped candidate pool; the privacy clause lives
    // in baseWhere and must AND into every path, never be dropped (CLAUDE.md:
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
 * Owner rule (2026-07-20): Trending BLENDS engagement with proximity + recency
 * — "hot near you". This supersedes the 2026-07-16 pure-proximity rule, which
 * crowned zero-engagement posts #1 and, for viewers with no coords, degraded to
 * newest-first (indistinguishable from Recent). Engagement is the primary
 * signal; proximity is a graded boost (not a hard radius filter), so a hot post
 * outside the radius can still surface and equal-engagement posts sort by
 * nearness. These pin the blend.
 */
describe('GET /highlights?v2=1&sort=trending — engagement+proximity blend (country PE)', () => {
  // Stamford CT — the owner's real profile zip (06907) resolves near here.
  const VIEWER = { lat: 41.09, lng: -73.52 };
  let authorId: string;
  let nearQuietPost: string; // ~1km away, zero engagement
  let nearViralPost: string; // ~1km away, 900 upvotes  -> should be #1
  let farQuietPost: string; // Los Angeles, zero engagement
  let farViralPost: string; // Los Angeles, 900 upvotes
  const cleanup: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('trend');
    authorId = author.id;
    // All same recency (1 day) so engagement + proximity are the only movers.
    nearQuietPost = (
      await createPost(authorId, 'PE', { upvotes: 0, lat: 41.1, lng: -73.53, createdDaysAgo: 1 })
    ).id;
    nearViralPost = (
      await createPost(authorId, 'PE', { upvotes: 900, lat: 41.1, lng: -73.53, createdDaysAgo: 1 })
    ).id;
    farQuietPost = (
      await createPost(authorId, 'PE', { upvotes: 0, lat: 34.05, lng: -118.24, createdDaysAgo: 1 })
    ).id;
    farViralPost = (
      await createPost(authorId, 'PE', {
        upvotes: 900,
        lat: 34.05,
        lng: -118.24,
        createdDaysAgo: 1,
      })
    ).id;
    cleanup.push(nearQuietPost, nearViralPost, farQuietPost, farViralPost);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: cleanup } } });
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  it('engagement lifts a post above a zero-engagement neighbor', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids.indexOf(nearViralPost)).toBeLessThan(ids.indexOf(nearQuietPost));
  });

  it('among equally-engaged posts, the nearer one ranks first (proximity boost)', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids.indexOf(nearQuietPost)).toBeLessThan(ids.indexOf(farQuietPost));
    expect(ids.indexOf(nearViralPost)).toBeLessThan(ids.indexOf(farViralPost));
  });

  it('no zero-engagement post tops the list when an engaged post exists — the nearby viral wins', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids[0]).toBe(nearViralPost);
  });

  it('does NOT hard-filter by radius — a far post still surfaces (ranked lower)', async () => {
    // The blend replaced the old radius WHERE filter with a graded boost, so a
    // distant post is no longer excluded outright — it just scores lower.
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids).toContain(farQuietPost);
    expect(ids).toContain(farViralPost);
  });

  it('never an empty tab when the viewer has no location — engagement still orders it', async () => {
    // No lat/lng, and an anonymous viewer has no preferences.zip_code. The
    // proximity term is 0 for everyone, so Trending becomes a pure
    // engagement+recency feed rather than blanking out.
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const ids = res.body.items.map((p: any) => p.id);
    // A viral post leads; neither quiet post can top it without a proximity edge.
    expect([nearViralPost, farViralPost]).toContain(ids[0]);
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
    // Both zero-engagement so the ONLY differentiator is the zip-derived
    // proximity boost. farPost is created last (so it is newest); without zip
    // resolution the recency tie-break would put it first — proving the boost
    // resolved when nearPost instead leads.
    nearPost = (await createPost(authorId, 'GH', { upvotes: 0, lat: 40.71, lng: -74.01 })).id;
    farPost = (await createPost(authorId, 'GH', { upvotes: 0, lat: 34.05, lng: -118.24 })).id;
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
    // Both surface (no hard radius filter), but the nearby one wins on the
    // zip-derived proximity boost despite the far one being newer.
    expect(ids).toContain(nearPost);
    expect(ids).toContain(farPost);
    expect(ids.indexOf(nearPost)).toBeLessThan(ids.indexOf(farPost));
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
