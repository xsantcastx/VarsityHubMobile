/**
 * Event-page post grid — the collage (masonry) layout plan.
 *
 * The event page's post PREVIEW (not the feed — the feed is deliberately
 * single-column hero cards, see app/feed.tsx) is a Pinterest-style masonry: a
 * few balanced columns of tiles with varied heights, so it reads like a collage
 * rather than a uniform grid of same-size squares (owner decision 2026-09:
 * "rows of three looks boxy — it should look like a collage").
 *
 * This module is the whole layout decision: posts + seed in, columns out. The
 * renderer is dumb — it draws the tiles the plan places, at the height the plan
 * gives them. Same shape as `buildProgramDisplayPlan` in constants/programs.ts.
 */

/** The preview shows at most this many posts; the rest live behind "View All Posts". */
export const EVENT_POST_PREVIEW_CAP = 12;

/** Default number of masonry columns (matches the empty-state placeholder grid). */
const DEFAULT_COLUMNS = 2;

/**
 * Tile heights the plan draws from. A spread of values (not multiples of one
 * base) gives the columns an uneven, collage-like rhythm. The estimated gap
 * between stacked tiles keeps the shortest-column packing honest.
 */
const TILE_HEIGHTS = [150, 176, 202, 168, 232, 190, 214, 158];
const TILE_GAP = 10;

export type MasonryInput = {
  id: string;
};

export type MasonryCell<T> = {
  post: T;
  /** The tile's rendered pixel height. */
  height: number;
};

export type MasonryPlan<T> = {
  /** Balanced columns of tiles, left-to-right. */
  columns: MasonryCell<T>[][];
  /** How many posts the plan actually placed (<= cap). */
  shownCount: number;
  /** True when posts were held back — i.e. "View All Posts" reveals more. */
  hasMore: boolean;
};

/**
 * FNV-1a + murmur3 finalizer. Same idea as getDeterministicGameCardGradient in
 * utils/feedGameCard.ts — a stable seed gives a stable pick, and there is no
 * Math.random anywhere in this module — but with real avalanche.
 *
 * The plain `hash * 31 + c` variant is NOT good enough here. It only avalanches
 * in the low bits, so for sequential ids ("p0", "p1", "p2", …) the high bits
 * stay ordered and sorting by the hash hands back the ORIGINAL order — i.e. no
 * shuffle at all. feedGameCard.ts gets away with it because it only takes `% 2`;
 * we sort on the full value, so it needs to mix properly.
 */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // murmur3 fmix32 — spreads the entropy across all 32 bits.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Seed for a given event + day. Stable for the whole day, so the grid never
 * reshuffles under the user's thumb (scroll, refetch, or coming back from
 * post-detail all rebuild the same plan), but a visit tomorrow gets a fresh
 * arrangement. `now` is injectable so tests don't depend on the wall clock.
 */
export function eventScrapbookSeed(eventId: string | number | null | undefined, now = new Date()) {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `${String(eventId ?? 'event')}:${day}`;
}

/**
 * Order posts by hash(seed + post id) rather than shuffling the array.
 *
 * This is the important property: a post's position depends only on its own id
 * and the seed, so a new post arriving (or one being deleted) slots into place
 * without reordering everything else. A plain seeded array shuffle would
 * rearrange the entire grid every time the query refetched.
 */
function stableShuffle<T extends MasonryInput>(posts: T[], seed: string): T[] {
  return (
    [...posts]
      .map(post => ({ post, key: hashSeed(`${seed}|${post.id}`) }))
      // Tie-break on id so equal hashes still produce a total, stable order.
      .sort((a, b) => a.key - b.key || String(a.post.id).localeCompare(String(b.post.id)))
      .map(entry => entry.post)
  );
}

/** A post's tile height — deterministic from its id + the seed. */
function tileHeight(post: MasonryInput, seed: string): number {
  return TILE_HEIGHTS[hashSeed(`${seed}|h|${post.id}`) % TILE_HEIGHTS.length];
}

/**
 * Build the event-page preview collage: shuffle stably, cap at 12, assign each
 * survivor a deterministic height, then pack them into balanced columns
 * (shortest column first). Every tile keeps its own height, so the columns are
 * uneven — a masonry, not a uniform grid.
 */
export function buildEventMasonryPlan<T extends MasonryInput>(
  posts: T[],
  seed: string,
  options: { cap?: number; columns?: number } = {}
): MasonryPlan<T> {
  const cap = options.cap ?? EVENT_POST_PREVIEW_CAP;
  const columnCount = Math.max(1, options.columns ?? DEFAULT_COLUMNS);
  const all = Array.isArray(posts) ? posts.filter(Boolean) : [];
  const columns: MasonryCell<T>[][] = Array.from({ length: columnCount }, () => []);
  if (all.length === 0 || cap <= 0) {
    return { columns, shownCount: 0, hasMore: all.length > 0 };
  }

  const ordered = stableShuffle(all, seed).slice(0, cap);
  const columnHeights = new Array(columnCount).fill(0);

  for (const post of ordered) {
    const height = tileHeight(post, seed);
    // Place into the currently-shortest column; ties go to the leftmost, so the
    // packing is fully deterministic for a given seed.
    let target = 0;
    for (let i = 1; i < columnCount; i += 1) {
      if (columnHeights[i] < columnHeights[target]) target = i;
    }
    columns[target].push({ post, height });
    columnHeights[target] += height + TILE_GAP;
  }

  return {
    columns,
    shownCount: ordered.length,
    hasMore: all.length > ordered.length,
  };
}
