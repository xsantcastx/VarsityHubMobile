/**
 * GET /highlights?v2=1&sort=... — per-tab sort invariants.
 *
 * These started as the 2026-07-04 audit fix: the client used to derive
 * Recent/Top/Trending from one trending-shaped pool, so Recent missed brand-new
 * zero-engagement posts, Top missed comment-heavy posts, and Trending mixed
 * incompatible score scales.
 *
 * Owner's current definitions:
 *   Recent   = most recent post, newest-first, no window (2026-07-16).
 *   Trending = the whole app's recent posts ranked by ENGAGEMENT; location
 *              does NOT matter (2026-07-20, superseding the 2026-07-16
 *              proximity rule — Highlights covers every user in the app).
 *   Top      = top 10 by engagement over the last 30 days (rolling window).
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
 * Owner rule:
 *   top should show the top 10 posts by engagement over the last 30 days.
 * Window = rolling 30 days, and exactly 10 — not a client-tunable page size.
 */
describe('GET /highlights?v2=1&sort=top — country FJ', () => {
  let authorId: string;
  let commentHeavyPost: string; // 2 upvotes + 4 comments = engagement 8
  let upvoteOnlyPost: string; // 5 upvotes = engagement 5
  let withinWindowViralPost: string; // 29 days old — inside 30-day window, must appear
  let olderThanWindowViralPost: string; // 31 days old — outside 30-day window, must not appear
  const cleanup: string[] = [];
  const commentIds: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('top');
    authorId = author.id;
    commentHeavyPost = (await createPost(authorId, 'FJ', { upvotes: 2, createdAt: new Date() })).id;
    upvoteOnlyPost = (await createPost(authorId, 'FJ', { upvotes: 5, createdAt: new Date() })).id;
    withinWindowViralPost = (
      await createPost(authorId, 'FJ', {
        upvotes: 900,
        createdDaysAgo: 29,
      })
    ).id;
    olderThanWindowViralPost = (
      await createPost(authorId, 'FJ', {
        upvotes: 1200,
        createdDaysAgo: 31,
      })
    ).id;
    cleanup.push(commentHeavyPost, upvoteOnlyPost, withinWindowViralPost, olderThanWindowViralPost);
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

  it('includes viral posts inside the rolling 30-day window', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.body.items.map((p: any) => p.id)).toContain(withinWindowViralPost);
  });

  it('excludes viral posts older than 30 days', async () => {
    const res = await request(app).get('/highlights?v2=1&country=FJ&sort=top');
    expect(res.body.items.map((p: any) => p.id)).not.toContain(olderThanWindowViralPost);
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
 * Owner rule (2026-07-20): Trending ranks the WHOLE app's recent posts by
 * ENGAGEMENT — location does NOT matter. Highlights covers every user in the
 * app, so there is no proximity term: the same popular posts trend for
 * everyone, whether or not they send coords. (This supersedes the earlier
 * proximity rules, which crowned nearby zero-engagement posts #1 and degraded
 * to newest-first for viewers with no coords.) These pin the location-
 * independent, engagement-only ranking.
 */
describe('GET /highlights?v2=1&sort=trending — engagement-only, app-wide (country PE)', () => {
  // Stamford CT — a viewer location that sits on top of quietOldNearPost, so if
  // proximity leaked back in these assertions would flip.
  const VIEWER = { lat: 41.09, lng: -73.52 };
  let authorId: string;
  let viralPost: string; // Los Angeles (far from VIEWER), 900 upvotes -> #1
  let quietNewPost: string; // Los Angeles (far), 0 upvotes, newest
  let quietOldNearPost: string; // on top of VIEWER, 0 upvotes, oldest
  const cleanup: string[] = [];

  beforeAll(async () => {
    const author = await createAuthor('trend');
    authorId = author.id;
    // viralPost is far from the viewer on purpose: engagement alone must carry
    // it to #1. quietNewPost (far, newest) vs quietOldNearPost (near, oldest)
    // isolates the "location is ignored" claim — with proximity gone, recency
    // decides and the far-but-newer post wins.
    viralPost = (
      await createPost(authorId, 'PE', {
        upvotes: 900,
        lat: 34.05,
        lng: -118.24,
        createdDaysAgo: 1,
      })
    ).id;
    quietOldNearPost = (
      await createPost(authorId, 'PE', { upvotes: 0, lat: 41.1, lng: -73.53, createdDaysAgo: 2 })
    ).id;
    quietNewPost = (
      await createPost(authorId, 'PE', { upvotes: 0, lat: 34.05, lng: -118.24, createdDaysAgo: 0 })
    ).id;
    cleanup.push(viralPost, quietOldNearPost, quietNewPost);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: cleanup } } });
    await prisma.user.delete({ where: { id: authorId } }).catch(() => {});
  });

  it('a viral post leads even when it is far and the viewer sends coords', async () => {
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids[0]).toBe(viralPost);
  });

  it('location is ignored — the newer far post outranks the older near post under viewer coords', async () => {
    // Under the old proximity/blend rule the near post would get a boost and
    // could win; with proximity removed, recency decides and the far post wins.
    const res = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids.indexOf(quietNewPost)).toBeLessThan(ids.indexOf(quietOldNearPost));
  });

  it('the order is identical with and without viewer coords (location-independent)', async () => {
    const withCoords = await request(app).get(
      `/highlights?v2=1&country=PE&sort=trending&lat=${VIEWER.lat}&lng=${VIEWER.lng}`
    );
    const noCoords = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(withCoords.status).toBe(200);
    expect(noCoords.status).toBe(200);
    const idsWith = withCoords.body.items.map((p: any) => p.id);
    const idsNo = noCoords.body.items.map((p: any) => p.id);
    expect(idsWith).toEqual(idsNo);
  });

  it('never an empty tab when the viewer has no location — a viral post still leads', async () => {
    const res = await request(app).get('/highlights?v2=1&country=PE&sort=trending');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.map((p: any) => p.id)[0]).toBe(viralPost);
  });
});

describe('GET /highlights?v2=1&sort=trending — a viewer zip_code does not re-introduce proximity (country GH)', () => {
  let viewerId: string;
  let viewerToken: string;
  let authorId: string;
  let zipNearOldPost: string;
  let farNewPost: string;

  beforeAll(async () => {
    // Manhattan zip: '100' is in the static ZIP_PREFIX_COORDS table. Under the
    // old rule this would have resolved to coords and boosted the near post.
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
    // Both zero-engagement. zipNearOldPost sits on the viewer's zip but is
    // created first (older); farNewPost is created last (newer). With proximity
    // gone, recency decides and the far-but-newer post wins — proving the
    // viewer's zip granted no location edge.
    zipNearOldPost = (await createPost(authorId, 'GH', { upvotes: 0, lat: 40.71, lng: -74.01 })).id;
    farNewPost = (await createPost(authorId, 'GH', { upvotes: 0, lat: 34.05, lng: -118.24 })).id;
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: { in: [zipNearOldPost, farNewPost] } } });
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, authorId] } } });
  });

  it('ranks by recency, not the zip — both surface and the newer far post leads', async () => {
    const res = await request(app)
      .get('/highlights?v2=1&country=GH&sort=trending')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: any) => p.id);
    expect(ids).toContain(zipNearOldPost);
    expect(ids).toContain(farNewPost);
    expect(ids.indexOf(farNewPost)).toBeLessThan(ids.indexOf(zipNearOldPost));
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
