# Highlights Tab Sorts (Top / Recent / Trending) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Highlights screen's Trending / Recent / Top tabs each show the correct posts by adding a server-side `sort` parameter to `GET /highlights` and having the client fetch per-tab instead of re-sorting one trending-shaped pool.

**Architecture:** `GET /highlights?v2=1&sort=recent|top|trending` gains a new sorted branch that returns `{ sort, items: [...] }` — each mode runs its own correctly-shaped DB query (recent = pure chronological, top = 30-day engagement, trending = existing `_score` over a 14-day window). The no-`sort` request path is byte-identical to today (legacy + v2 `{nationalTop, ranked}`), so old OTA clients and `GameVerticalFeedScreen` keep working. The client keys its react-query on the active tab, passes `sort`, and renders server order verbatim; a fallback path (old server, new client) applies one consistent engagement metric instead of today's broken mixed-scale double sort.

**Tech Stack:** Express + Prisma (server), React Native + expo-router + @tanstack/react-query (client), Jest + supertest (tests).

**Root-cause bugs this fixes** (from the 2026-07-04 audit):

- Bug A: client Trending compares server `_score` (only on `ranked` bucket) against raw engagement (on `nationalTop` bucket) — incompatible scales.
- Bug B: Trending's second "rest" sort uses `_score || 0`, sinking the country's most-upvoted posts to the bottom.
- Bug C: "Recent" only sees posts that survived the server's trending-score cut, so genuinely new posts can be missing.
- Bug D: "Top" (30-day engagement) draws candidates from a trending/upvotes-only pool, missing legit top posts.
- Bug E (structural): sort mode never reached the server.

**Deployment-order safety:** Server deploys first (Railway auto-deploys `main`); the legacy-shape regression test in Task 4 guarantees old clients are unaffected. The new client tolerates an old server via the fallback path in Task 5. Either order is safe.

---

## File Structure

| File                                               | Change                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `server/src/routes/highlights.ts`                  | Hoist scoring helpers to module scope; add `sort` branch returning `{ sort, items }`             |
| `server/src/__tests__/api-highlights-sort.test.ts` | NEW — invariant tests per sort mode + block filter + legacy-shape regression                     |
| `api/entities.ts`                                  | `Highlights.fetch` accepts `sort`                                                                |
| `app/highlights.tsx`                               | Per-tab query key + `sort` param; delete broken double sort; fallback sorting for legacy servers |
| `app/__tests__/highlights.smoke.test.tsx`          | Update mock to `items` shape; add tab-switch + legacy-fallback tests                             |

Not touched (verified consumers keep working unchanged): `server/src/routes/feed.ts` (`getHighlightsBundle` is a separate inline copy), `app/game-details/GameVerticalFeedScreen.tsx` (calls `Highlights.fetch` without `sort` → legacy v2 shape), `server/src/__tests__/api-highlights.test.ts` (existing privacy/block tests, no `sort`).

---

### Task 1: Server — hoist scoring helpers (pure refactor, no behavior change)

**Files:**

- Modify: `server/src/routes/highlights.ts`

The v2 handler defines `recencyBoost`, `engagementBoost`, the local-bbox predicate, and the followed-authors lookup inline (lines 174–234). The new `sort=trending` branch needs the same logic, so hoist them to module scope first. Existing tests are the safety net.

- [ ] **Step 1: Run the existing highlights suite to establish green baseline**

Run: `cd server && npm test -- --testPathPattern="api-highlights" --no-coverage 2>&1 | tail -5`
Expected: PASS (all tests green).

- [ ] **Step 2: Hoist helpers to module scope**

In `server/src/routes/highlights.ts`, add after the `withInteractions` definition (currently ends line 61), before the route handler:

```ts
const RADIUS_KM = 100; // Wider radius for more posts

function recencyBoost(d: Date) {
  const ageDays = (Date.now() - new Date(d).getTime()) / 864e5;
  if (ageDays <= 0.5) return 12; // Super recent
  if (ageDays <= 1) return 8;
  if (ageDays <= 3) return 5;
  if (ageDays <= 7) return 3;
  if (ageDays <= 14) return 2;
  return 1;
}

function engagementBoost(upvotes: number, comments: number) {
  const totalEngagement = (upvotes || 0) + (comments || 0) * 2; // Comments worth 2x upvotes
  if (totalEngagement >= 100) return 10;
  if (totalEngagement >= 50) return 6;
  if (totalEngagement >= 20) return 4;
  if (totalEngagement >= 10) return 2;
  return 1;
}

function buildIsLocal(lat?: number, lng?: number): (p: any) => boolean {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return () => false;
  }
  const kmPerDegLat = 110.574;
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  const dLat = RADIUS_KM / kmPerDegLat;
  const dLng = RADIUS_KM / kmPerDegLng;
  return (p: any) =>
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    p.lat >= lat - dLat &&
    p.lat <= lat + dLat &&
    p.lng >= lng - dLng &&
    p.lng <= lng + dLng;
}

async function getFollowedSet(
  userId: string | null | undefined,
  posts: any[]
): Promise<Set<string>> {
  if (!userId || posts.length === 0) return new Set();
  const authorIds = [...new Set(posts.map((p: any) => p.author_id).filter(Boolean))];
  if (authorIds.length === 0) return new Set();
  const follows = await prisma.follows.findMany({
    where: { follower_id: userId, following_id: { in: authorIds } },
    select: { following_id: true },
    take: authorIds.length,
  });
  return new Set(follows.map(f => f.following_id));
}

const scoreHighlightPost = (
  p: any,
  followedSet: Set<string>,
  isLocal: (p: any) => boolean
): number =>
  (p.upvotes_count || 0) * 2 +
  (p._count?.comments || 0) * 3 +
  (followedSet.has(p.author_id) ? 8 : 0) +
  (isLocal(p) ? 6 : 0) +
  recencyBoost(p.created_at) +
  engagementBoost(p.upvotes_count, p._count?.comments || 0) +
  (p.media_url ? 4 : 0);
```

Then inside the handler:

1. Delete the inline `const RADIUS_KM = 100;` (line 78).
2. Replace the inline "Local bbox predicate" block (lines 173–187, `let isLocal ... }` ) with:

```ts
const isLocal = buildIsLocal(lat, lng);
```

3. Replace the followed-authors block (lines 189–201, from `const currentUserId = req.user?.id;` through the `followedSet` assignment) with:

```ts
const followedSet = await getFollowedSet(req.user?.id, pool);
```

4. Delete the inline `function recencyBoost(...)` and `function engagementBoost(...)` definitions (lines 203–220).
5. Replace the `_score:` expression in the `ranked` map (lines 225–232) with:

```ts
          _score: scoreHighlightPost(p, followedSet, isLocal),
```

- [ ] **Step 3: Typecheck and re-run tests to confirm no behavior change**

Run: `cd server && npx tsc --noEmit --project tsconfig.json 2>&1 | tail -5`
Expected: 0 new errors.

Run: `cd server && npm test -- --testPathPattern="api-highlights" --no-coverage 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/highlights.ts
git commit -m "refactor(highlights): hoist ranking helpers to module scope"
```

---

### Task 2: Server — `sort=recent` (+ block filter on the sorted path)

**Files:**

- Modify: `server/src/routes/highlights.ts`
- Create: `server/src/__tests__/api-highlights-sort.test.ts`

Test isolation trick: each describe block uses a country code no other test data uses (`NZ`, `FJ`, `PE`), so ordering assertions see only this block's fixtures.

- [ ] **Step 1: Write the failing tests**

Create `server/src/__tests__/api-highlights-sort.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd server && npm test -- --testPathPattern="api-highlights-sort" --no-coverage 2>&1 | tail -10`
Expected: FAIL — `res.body.items` is undefined (server ignores `sort` and returns `{nationalTop, ranked}`).

- [ ] **Step 3: Implement the sorted branch (recent only, plus the shared scaffolding)**

In `server/src/routes/highlights.ts`, inside the handler, right after the `const v2 = ...` line, add:

```ts
const sortParamRaw = String((req.query as any).sort || '')
  .trim()
  .toLowerCase();
const sort =
  v2 && (sortParamRaw === 'recent' || sortParamRaw === 'top' || sortParamRaw === 'trending')
    ? sortParamRaw
    : null;
```

Then, right after the `privacyWhere` assignment (after the `const privacyWhere = ...` line) and BEFORE the `// Run nationalTop + pool concurrently` block, add:

```ts
// Per-tab sorted mode (v2 only): each mode runs its own correctly-shaped
// query instead of deriving all tabs from one trending-shaped pool.
if (sort) {
  const baseWhere = {
    country_code: country,
    media_url: { not: null },
    deleted_at: null,
    ...privacyWhere,
  };
  let items: any[] = [];

  if (sort === 'recent') {
    items = await prisma.post.findMany({
      where: { ...baseWhere, created_at: { gte: since } },
      orderBy: [{ created_at: 'desc' }],
      take: limit,
      select: highlightPostSelect,
    });
  }
  // sort === 'top' and sort === 'trending' are implemented in Tasks 3 and 4.

  const { upvotedIds, bookmarkedIds } = await getInteractionSets(
    req.user?.id,
    items.map((p: any) => p.id)
  );
  const enrich = withInteractions(upvotedIds, bookmarkedIds);
  res.set('Cache-Control', 'no-store, private');
  return res.json({ sort, items: items.map(enrich) });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- --testPathPattern="api-highlights-sort" --no-coverage 2>&1 | tail -10`
Expected: PASS (both `sort=recent` describes).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/highlights.ts server/src/__tests__/api-highlights-sort.test.ts
git commit -m "feat(highlights): server-side sort=recent for the Recent tab"
```

---

### Task 3: Server — `sort=top` (30-day engagement)

**Files:**

- Modify: `server/src/routes/highlights.ts`
- Modify: `server/src/__tests__/api-highlights-sort.test.ts`

Engagement = `upvotes + comments × 1.5` (matches the client's existing Top formula at `app/highlights.tsx:738`). Candidates come from a union of top-by-upvotes and top-by-comment-count so comment-heavy posts can't be missed (Bug D repro).

- [ ] **Step 1: Write the failing tests**

Append to `server/src/__tests__/api-highlights-sort.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npm test -- --testPathPattern="api-highlights-sort" --no-coverage 2>&1 | tail -10`
Expected: FAIL — `sort=top` currently returns empty `items` (branch not implemented), so `indexOf` assertions fail.

- [ ] **Step 3: Implement the `top` branch**

In the `if (sort)` block added in Task 2, replace the comment line
`// sort === 'top' and sort === 'trending' are implemented in Tasks 3 and 4.` with:

```ts
if (sort === 'top') {
  // Product rule: most engagement (upvotes + comments*1.5) in the last
  // 30 days. Union of top-by-upvotes and top-by-comment-count so a
  // comment-heavy post can't be missed by an upvotes-only orderBy.
  const monthAgo = new Date(Date.now() - 30 * 864e5);
  const [byUpvotes, byComments] = await Promise.all([
    prisma.post.findMany({
      where: { ...baseWhere, created_at: { gte: monthAgo } },
      orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
      take: 100,
      select: highlightPostSelect,
    }),
    prisma.post.findMany({
      where: { ...baseWhere, created_at: { gte: monthAgo } },
      orderBy: [{ comments: { _count: 'desc' } }, { created_at: 'desc' }],
      take: 100,
      select: highlightPostSelect,
    }),
  ]);
  const merged = new Map<string, any>();
  for (const p of [...byUpvotes, ...byComments]) merged.set(p.id, p);
  const engagement = (p: any) => (p.upvotes_count || 0) + (p._count?.comments || 0) * 1.5;
  items = [...merged.values()].sort((a, b) => engagement(b) - engagement(a)).slice(0, limit);
}
```

(Keep the `if (sort === 'recent')` block from Task 2 above it; these are sibling `if` blocks.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- --testPathPattern="api-highlights-sort" --no-coverage 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/highlights.ts server/src/__tests__/api-highlights-sort.test.ts
git commit -m "feat(highlights): server-side sort=top (30-day engagement)"
```

---

### Task 4: Server — `sort=trending` + legacy-shape regression guard

**Files:**

- Modify: `server/src/routes/highlights.ts`
- Modify: `server/src/__tests__/api-highlights-sort.test.ts`

Trending reuses `scoreHighlightPost` (hoisted in Task 1) over a 14-day window (the product rule the client already enforced at `app/highlights.tsx:692`). Score sanity for the Bug A repro: a 10-upvote 5-day-old post scores `10*2 + recency(3) + engagementBoost(2) + media(4) = 29`; a fresh zero-engagement post scores `recency(12) + engagementBoost(1) + media(4) = 17`. Real engagement wins.

- [ ] **Step 1: Write the failing tests**

Append to `server/src/__tests__/api-highlights-sort.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify the trending tests fail**

Run: `cd server && npm test -- --testPathPattern="api-highlights-sort" --no-coverage 2>&1 | tail -10`
Expected: FAIL on the PE describe (`items` empty for `sort=trending`); the legacy-shape describe should already PASS.

- [ ] **Step 3: Implement the `trending` branch**

In the `if (sort)` block, after the `if (sort === 'top') { ... }` block, add:

```ts
if (sort === 'trending') {
  // Product rule: trending never surfaces posts older than 14 days.
  const fortnightAgo = new Date(Date.now() - 14 * 864e5);
  const pool = await prisma.post.findMany({
    where: { ...baseWhere, created_at: { gte: fortnightAgo } },
    orderBy: [{ created_at: 'desc' }],
    take: 300,
    select: highlightPostSelect,
  });
  const isLocal = buildIsLocal(lat, lng);
  const followedSet = await getFollowedSet(req.user?.id, pool);
  items = pool
    .map((p: any) => ({ ...p, _score: scoreHighlightPost(p, followedSet, isLocal) }))
    .sort((a: any, b: any) => b._score - a._score)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the full highlights test set + typecheck**

Run: `cd server && npm test -- --testPathPattern="api-highlights" --no-coverage 2>&1 | tail -10`
Expected: PASS — both `api-highlights.test.ts` (legacy privacy/block) and `api-highlights-sort.test.ts`.

Run: `cd server && npx tsc --noEmit --project tsconfig.json 2>&1 | tail -5`
Expected: 0 errors.

Run: `cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -5`
Expected: PASS (every new `findMany` carries a `take`).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/highlights.ts server/src/__tests__/api-highlights-sort.test.ts
git commit -m "feat(highlights): server-side sort=trending + legacy-shape regression guard"
```

---

### Task 5: Client — per-tab fetch, render server order, delete the broken double sort

**Files:**

- Modify: `api/entities.ts` (the `Highlights` export, ~line 1029)
- Modify: `app/highlights.tsx`

- [ ] **Step 1: Add `sort` to the API client**

In `api/entities.ts`, replace the `Highlights` export with:

```ts
export const Highlights = {
  fetch: (
    params: {
      country?: string;
      lat?: number;
      lng?: number;
      limit?: number;
      sort?: 'trending' | 'recent' | 'top';
    } = {}
  ) => {
    const q: string[] = [];
    q.push('v2=1');
    if (params.country) q.push('country=' + encodeURIComponent(params.country));
    if (typeof params.lat === 'number') q.push('lat=' + encodeURIComponent(String(params.lat)));
    if (typeof params.lng === 'number') q.push('lng=' + encodeURIComponent(String(params.lng)));
    if (params.limit) q.push('limit=' + encodeURIComponent(String(params.limit)));
    if (params.sort) q.push('sort=' + encodeURIComponent(params.sort));
    return httpGet('/highlights' + (q.length ? '?' + q.join('&') : ''));
  },
};
```

(`GameVerticalFeedScreen` passes no `sort`, so its call is unchanged.)

- [ ] **Step 2: Rewire the query in `app/highlights.tsx`**

Replace the `useQuery` block (lines 514–569) with:

```ts
const {
  data: highlightsPayload,
  isPending: loading,
  isError,
  refetch,
} = useQuery({
  queryKey: ['highlights', activeTab, user?.id ?? 'guest'],
  // Keep the previous tab's list on screen while the new tab loads —
  // prevents a full-screen spinner flash on every tab switch.
  placeholderData: (prev: any) => prev,
  queryFn: async () => {
    const me: any = await getAuthSnapshot(checkAuth, user).catch((error: any) => {
      if (__DEV__) console.warn('[Highlights] Failed to load user:', error?.message || error);
      return null;
    });

    const country = (me?.preferences?.country_code || 'US').toUpperCase();

    // Location preference lookup: coordinates live under me.preferences
    // Guard against undefined and ensure both lat/lng are valid numbers
    const lat =
      typeof me?.preferences?.lat === 'number'
        ? me.preferences.lat
        : typeof me?.lat === 'number'
          ? me.lat
          : undefined;
    const lng =
      typeof me?.preferences?.lng === 'number'
        ? me.preferences.lng
        : typeof me?.lng === 'number'
          ? me.lng
          : undefined;

    const payload = await Highlights.fetch({
      country,
      limit: activeTab === 'top' ? 10 : 50,
      lat,
      lng,
      sort: activeTab,
    });

    // New servers return { sort, items }; old servers return the legacy
    // { nationalTop, ranked } buckets — keep both shapes working.
    const rawItems = Array.isArray(payload?.items) ? payload.items : null;
    const rawNationalTop = Array.isArray(payload?.nationalTop) ? payload.nationalTop : [];
    const rawRanked = Array.isArray(payload?.ranked) ? payload.ranked : [];

    // Cache all the raw posts for faster loading when navigating to post detail
    postCache.setBatch(rawItems ?? [...rawNationalTop, ...rawRanked]);

    return {
      rawItems,
      rawNationalTop,
      rawRanked,
      // Location for ranking calculations, only when both coordinates are valid
      userLocation:
        typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0
          ? { lat, lng }
          : undefined,
    };
  },
});
```

- [ ] **Step 3: Update the merged-pool memo and tab filtering**

Replace the `highlights` memo (lines 585–593) with:

```ts
// Server-sorted items when available; legacy bucket merge otherwise.
const serverSorted = highlightsPayload?.rawItems != null;
const highlights = useMemo(() => {
  const source = highlightsPayload?.rawItems ?? [
    ...(highlightsPayload?.rawNationalTop ?? []),
    ...(highlightsPayload?.rawRanked ?? []),
  ];
  const mapped = source.map(mapHighlightItem).filter(Boolean) as HighlightItem[];
  return Array.from(new Map(mapped.map(item => [item.id, item])).values());
}, [highlightsPayload]);
```

Replace `getFilteredHighlights` (lines 682–744) with:

```ts
const getFilteredHighlights = useCallback(() => {
  // New servers return each tab pre-sorted — render their order verbatim.
  if (serverSorted) return highlights;

  // Legacy-server fallback: one consistent engagement metric for every
  // post (the old code compared server _score against raw engagement,
  // which are incompatible scales).
  const engagement = (p: HighlightItem) => (p.upvotes_count || 0) + (p._count?.comments || 0) * 2;
  const list = [...highlights];
  switch (activeTab) {
    case 'trending':
      // Product rule: Trending never shows posts older than 14 days.
      return list
        .filter(p => Date.now() - new Date(p.created_at || 0).getTime() <= 14 * 86400000)
        .sort((a, b) => engagement(b) - engagement(a));
    case 'recent':
      return list.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    case 'top':
      // Product rule: top 10 by engagement over the last month.
      return list
        .filter(p => Date.now() - new Date(p.created_at || 0).getTime() <= 30 * 86400000)
        .sort((a, b) => engagement(b) - engagement(a))
        .slice(0, 10);
  }
}, [highlights, activeTab, serverSorted]);
```

- [ ] **Step 4: Patch upvotes across all cached tab queries**

The query key now includes `activeTab`, so `patchHighlight` must update every cached tab (a post can appear in Trending and Recent simultaneously). Replace `patchHighlight` (lines 791–807) with:

```ts
// Patch one post's vote fields inside every cached tab payload (items +
// legacy buckets); the mapped highlights memo re-derives per tab.
const patchHighlight = useCallback(
  (postId: string, patch: (h: any) => any) => {
    queryClient.setQueriesData({ queryKey: ['highlights'] }, (old: any) => {
      if (!old) return old;
      const apply = (arr: any[] | null | undefined) =>
        Array.isArray(arr)
          ? arr.map(h => (String(h?.id ?? h?.post_id ?? h?.highlight_id) === postId ? patch(h) : h))
          : arr;
      return {
        ...old,
        rawItems: apply(old.rawItems),
        rawNationalTop: apply(old.rawNationalTop),
        rawRanked: apply(old.rawRanked),
      };
    });
  },
  [queryClient]
);
```

(Note: the old version depended on `user?.id` for the exact key; `setQueriesData` with the `['highlights']` prefix removes that dependency — drop `user?.id` from the dependency array.)

- [ ] **Step 5: Typecheck the client**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add api/entities.ts app/highlights.tsx
git commit -m "fix(highlights): fetch per-tab server-sorted lists; drop mixed-scale client sorts"
```

---

### Task 6: Client tests — smoke update + tab switch + legacy fallback

**Files:**

- Modify: `app/__tests__/highlights.smoke.test.tsx`

- [ ] **Step 1: Update the existing smoke test and add the two new tests**

In `app/__tests__/highlights.smoke.test.tsx`:

1. Add `fireEvent` to the testing-library import:

```ts
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
```

2. Replace the `beforeEach` mock payload (legacy buckets) with the new shape:

```ts
beforeEach(() => {
  mockHighlightsFetch.mockReset().mockResolvedValue({
    sort: 'trending',
    items: [samplePost],
  });
});
```

3. Replace the existing `describe` block with:

```ts
describe('HighlightsScreen (react-query render smoke)', () => {
  it('mounts, fetches the trending tab, and renders a highlight card', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', limit: 50, sort: 'trending' })
      )
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
  });

  it('switching to the Recent tab fetches sort=recent', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
    fireEvent.press(screen.getByText('🕐 Recent'));
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'recent' })
      )
    );
  });

  it('switching to the Top tab fetches sort=top with limit 10', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
    fireEvent.press(screen.getByText('👑 Top'));
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'top', limit: 10 })
      )
    );
  });

  it('still renders cards from a legacy server payload (nationalTop/ranked)', async () => {
    mockHighlightsFetch.mockReset().mockResolvedValue({
      nationalTop: [samplePost],
      ranked: [],
    });
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the client test suites**

Run: `npx jest app/__tests__/highlights.smoke.test.tsx --no-coverage 2>&1 | tail -10`
Expected: PASS (4 tests).

Run: `npx jest app/game-details/__tests__/post-mapper-consistency.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS (mappers untouched, but this is the guard the CLAUDE.md consistency rule requires).

- [ ] **Step 3: Commit**

```bash
git add app/__tests__/highlights.smoke.test.tsx
git commit -m "test(highlights): cover per-tab sort fetches and legacy-server fallback"
```

---

### Task 7: Full verification gates + ship notes

**Files:** none (verification only)

- [ ] **Step 1: Type safety, both projects**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors.

Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: 0 errors.

- [ ] **Step 2: Server invariant gates touched by this change**

Run: `cd server && npm test -- --testPathPattern="api-highlights|unbounded-queries" --no-coverage 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 3: Regression battery + repo gates**

Run: `npm run test:regressions 2>&1 | tail -10`
Expected: PASS.

Run: `npm run check:conflicts`
Expected: clean.

Run: `npm run verify:error-envelope 2>&1 | tail -5`
Expected: clean (the new branch only adds `res.json` success responses; errors still flow through `sendError`).

- [ ] **Step 4: Live-behavior spot check (local server)**

With the dev server running (`npm run dev:server`), verify each mode returns a differently-shaped list:

```bash
curl -s "http://localhost:3001/highlights?v2=1&country=US&sort=recent&limit=5" | head -c 400
```

```bash
curl -s "http://localhost:3001/highlights?v2=1&country=US&sort=top&limit=5" | head -c 400
```

```bash
curl -s "http://localhost:3001/highlights?v2=1&country=US&sort=trending&limit=5" | head -c 400
```

```bash
curl -s "http://localhost:3001/highlights?v2=1&country=US&limit=5" | head -c 400
```

Expected: first three return `{"sort":"...","items":[...]}`; the fourth returns `{"nationalTop":[...],"ranked":[...]}` (legacy unchanged). Adjust the port if the local server uses a different one (check `server/.env`).

- [ ] **Step 5: Ship notes (do NOT push without the user)**

- Pushing to `main` auto-deploys the server on Railway — the server side is then live. Old app clients are unaffected (legacy-shape regression test).
- **The client fix is NOT live until `eas update --branch production` is run** (per CLAUDE.md OTA rule) — remind the user, and per the SDK 54 OTA publish-risk memory, verify the publish actually succeeds.
- Order: push server+client together; server deploys first automatically, then run the OTA publish.

---

## Explicitly out of scope (surgical-change rule)

- Discover tab's `/posts/trending` time-decay algorithm — internally coherent, separate system; unifying the two trending algorithms is a product decision, not a bug fix.
- The phantom `sport`/`caption` fields in `mapHighlightItem` and the dead "Text Post" card branch — harmless; Highlights is media-only by design.
- `getHighlightsBundle` in `server/src/routes/feed.ts` — a separate inline copy serving the feed screen's rail; its consumers don't have sort tabs.
- Pagination for the Recent tab — the 50-item cap matches current product behavior; add later if requested.

## Self-Review (completed)

- **Spec coverage:** Bug A/B → Task 4 (server trending) + Task 5 (deletes the mixed-scale sorts, consistent fallback); Bug C → Task 2; Bug D → Task 3; Bug E → Tasks 2–5 (sort reaches the server). Back-compat → Task 4 regression tests + Task 6 legacy fallback test.
- **Placeholder scan:** none — every code step contains the full code.
- **Type consistency:** `scoreHighlightPost(p, followedSet, isLocal)` defined in Task 1, used in Task 4; `rawItems` naming consistent across Task 5 steps 2–4; `sort` union `'trending' | 'recent' | 'top'` matches the client `TabType`.
