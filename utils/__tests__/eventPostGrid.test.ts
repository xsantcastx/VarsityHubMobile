import {
  EVENT_POST_PREVIEW_CAP,
  buildEventMasonryPlan,
  eventScrapbookSeed,
  type MasonryInput,
} from '@/utils/eventPostGrid';

const post = (id: string): MasonryInput => ({ id });

const makePosts = (n: number) => Array.from({ length: n }, (_, i) => post(`p${i}`));

const flatIds = (plan: ReturnType<typeof buildEventMasonryPlan>) =>
  plan.columns.flatMap(column => column.map(cell => cell.post.id));

const columnTotals = (plan: ReturnType<typeof buildEventMasonryPlan>) =>
  plan.columns.map(column => column.reduce((sum, cell) => sum + cell.height, 0));

describe('eventScrapbookSeed', () => {
  it('is stable within a day and changes across days', () => {
    const day1 = new Date(2026, 6, 16, 9, 0, 0);
    const day1Later = new Date(2026, 6, 16, 23, 59, 0);
    const day2 = new Date(2026, 6, 17, 9, 0, 0);

    expect(eventScrapbookSeed('evt1', day1)).toBe(eventScrapbookSeed('evt1', day1Later));
    expect(eventScrapbookSeed('evt1', day1)).not.toBe(eventScrapbookSeed('evt1', day2));
  });

  it('differs per event on the same day', () => {
    const now = new Date(2026, 6, 16);
    expect(eventScrapbookSeed('evt1', now)).not.toBe(eventScrapbookSeed('evt2', now));
  });
});

describe('buildEventMasonryPlan — cap', () => {
  it('caps the preview at exactly 12 posts', () => {
    const plan = buildEventMasonryPlan(makePosts(40), 'seed');
    expect(plan.shownCount).toBe(12);
    expect(EVENT_POST_PREVIEW_CAP).toBe(12);
    expect(flatIds(plan)).toHaveLength(12);
    expect(plan.hasMore).toBe(true);
  });

  it('shows everything and reports no more when under the cap', () => {
    const plan = buildEventMasonryPlan(makePosts(5), 'seed');
    expect(plan.shownCount).toBe(5);
    expect(plan.hasMore).toBe(false);
  });

  it('never duplicates or drops a post within the plan', () => {
    const plan = buildEventMasonryPlan(makePosts(40), 'seed');
    expect(new Set(flatIds(plan)).size).toBe(12);
  });

  it('handles an empty list', () => {
    const plan = buildEventMasonryPlan([], 'seed');
    expect(plan.columns.every(column => column.length === 0)).toBe(true);
    expect(plan.shownCount).toBe(0);
    expect(plan.hasMore).toBe(false);
  });
});

describe('buildEventMasonryPlan — collage layout', () => {
  it('defaults to two columns', () => {
    const plan = buildEventMasonryPlan(makePosts(12), 'seed');
    expect(plan.columns).toHaveLength(2);
  });

  it('honours a custom column count', () => {
    const plan = buildEventMasonryPlan(makePosts(12), 'seed', { columns: 3 });
    expect(plan.columns).toHaveLength(3);
  });

  it('gives tiles varied heights rather than one uniform size', () => {
    // The whole point of the change: a collage, not a uniform grid of squares.
    const heights = buildEventMasonryPlan(makePosts(12), 'seed').columns.flatMap(column =>
      column.map(cell => cell.height)
    );
    expect(new Set(heights).size).toBeGreaterThan(1);
  });

  it('keeps the columns balanced (shortest-column-first packing)', () => {
    // Shortest-first packing guarantees the tallest and shortest columns differ
    // by no more than a single tile's height, so no column runs away long.
    const totals = columnTotals(buildEventMasonryPlan(makePosts(12), 'seed'));
    const spread = Math.max(...totals) - Math.min(...totals);
    expect(spread).toBeLessThanOrEqual(340);
  });

  it('places every capped post exactly once across the columns', () => {
    const plan = buildEventMasonryPlan(makePosts(20), 'seed');
    expect(new Set(flatIds(plan)).size).toBe(12);
  });
});

describe('buildEventMasonryPlan — shuffle stability', () => {
  const posts = makePosts(12);

  it('is deterministic: same posts + same seed => identical plan', () => {
    const a = buildEventMasonryPlan(posts, 'seed-1');
    const b = buildEventMasonryPlan(posts, 'seed-1');
    expect(flatIds(a)).toEqual(flatIds(b));
    expect(a.columns.map(column => column.length)).toEqual(b.columns.map(column => column.length));
    expect(columnTotals(a)).toEqual(columnTotals(b));
  });

  it('does not depend on the incoming array order', () => {
    // A refetch that returns the same posts in a different order must not
    // rearrange the grid.
    const reversed = [...posts].reverse();
    expect(flatIds(buildEventMasonryPlan(reversed, 'seed-1'))).toEqual(
      flatIds(buildEventMasonryPlan(posts, 'seed-1'))
    );
  });

  it('reshuffles across seeds so a later visit feels fresh', () => {
    const day1 = flatIds(
      buildEventMasonryPlan(posts, eventScrapbookSeed('e', new Date(2026, 6, 16)))
    );
    const day2 = flatIds(
      buildEventMasonryPlan(posts, eventScrapbookSeed('e', new Date(2026, 6, 17)))
    );
    expect(day1).not.toEqual(day2);
  });

  it('gives a post the same height regardless of the other posts present', () => {
    // Height is a pure function of (seed, post id), so a post never resizes when
    // its neighbours change — only its column placement can shift.
    const heightOf = (plan: ReturnType<typeof buildEventMasonryPlan>, id: string) =>
      plan.columns.flatMap(c => c).find(cell => cell.post.id === id)?.height;
    const withFew = buildEventMasonryPlan([post('p0'), post('p1')], 'seed-1');
    const withMany = buildEventMasonryPlan(makePosts(12), 'seed-1');
    expect(heightOf(withFew, 'p0')).toBe(heightOf(withMany, 'p0'));
  });
});
