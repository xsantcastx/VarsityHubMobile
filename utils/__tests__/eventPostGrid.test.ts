import {
  EVENT_POST_PREVIEW_CAP,
  buildEventScrapbookPlan,
  eventScrapbookSeed,
  isLandscapePost,
  type ScrapbookInput,
} from '@/utils/eventPostGrid';

const post = (id: string, w?: number, h?: number): ScrapbookInput => ({
  id,
  media_width: w ?? null,
  media_height: h ?? null,
});

const makePosts = (n: number) => Array.from({ length: n }, (_, i) => post(`p${i}`));

const flatIds = (plan: ReturnType<typeof buildEventScrapbookPlan>) =>
  plan.rows.flatMap(row => row.cells.map(cell => cell.post.id));

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

describe('isLandscapePost', () => {
  it('treats a clearly wide post as landscape', () => {
    expect(isLandscapePost(post('a', 1920, 1080))).toBe(true);
  });

  it('treats portrait and near-square posts as not landscape', () => {
    expect(isLandscapePost(post('a', 1080, 1920))).toBe(false);
    expect(isLandscapePost(post('a', 1000, 1000))).toBe(false);
    expect(isLandscapePost(post('a', 1100, 1000))).toBe(false); // 1.1 < 1.2 threshold
  });

  it('treats unknown or zero dimensions as not landscape', () => {
    // Most production rows have null media_width/media_height; phone clips are
    // portrait by default, so unknown must never guess wide.
    expect(isLandscapePost(post('a'))).toBe(false);
    expect(isLandscapePost(post('a', 0, 0))).toBe(false);
  });
});

describe('buildEventScrapbookPlan — cap', () => {
  it('caps the preview at exactly 12 posts', () => {
    const plan = buildEventScrapbookPlan(makePosts(40), 'seed');
    expect(plan.shownCount).toBe(12);
    expect(EVENT_POST_PREVIEW_CAP).toBe(12);
    expect(flatIds(plan)).toHaveLength(12);
    expect(plan.hasMore).toBe(true);
  });

  it('shows everything and reports no more when under the cap', () => {
    const plan = buildEventScrapbookPlan(makePosts(5), 'seed');
    expect(plan.shownCount).toBe(5);
    expect(plan.hasMore).toBe(false);
  });

  it('never duplicates or drops a post within the plan', () => {
    const plan = buildEventScrapbookPlan(makePosts(40), 'seed');
    expect(new Set(flatIds(plan)).size).toBe(12);
  });

  it('handles an empty list', () => {
    const plan = buildEventScrapbookPlan([], 'seed');
    expect(plan.rows).toEqual([]);
    expect(plan.shownCount).toBe(0);
    expect(plan.hasMore).toBe(false);
  });
});

describe('buildEventScrapbookPlan — row mix', () => {
  it('mixes 2-across and 3-across rows rather than a uniform grid', () => {
    const plan = buildEventScrapbookPlan(makePosts(12), 'seed');
    const sizes = plan.rows.map(row => row.cells.length);
    expect(sizes).toContain(2);
    expect(sizes).toContain(3);
    // The whole point: not the uniform 2-up grid this replaced.
    expect(sizes.every(s => s === 2)).toBe(false);
  });

  it('never puts more than 3 across a row', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const plan = buildEventScrapbookPlan(makePosts(12), seed);
      expect(plan.rows.every(row => row.cells.length <= 3)).toBe(true);
      expect(plan.rows.every(row => row.cells.length >= 1)).toBe(true);
    }
  });

  it('gives every row cell widths that sum to the full row', () => {
    const posts = [post('a', 1920, 1080), post('b', 1080, 1920), post('c'), post('d', 1920, 1080)];
    const plan = buildEventScrapbookPlan([...posts, ...makePosts(8)], 'seed');
    for (const row of plan.rows) {
      const sum = row.cells.reduce((acc, cell) => acc + cell.widthRatio, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('gives shorter rows taller cells', () => {
    const plan = buildEventScrapbookPlan(makePosts(12), 'seed');
    const twoUp = plan.rows.find(r => r.cells.length === 2);
    const threeUp = plan.rows.find(r => r.cells.length === 3);
    expect(twoUp!.height).toBeGreaterThan(threeUp!.height);
  });

  it('varies the row rhythm across seeds', () => {
    const shapes = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map(seed =>
        buildEventScrapbookPlan(makePosts(12), seed)
          .rows.map(r => r.cells.length)
          .join('-')
      )
    );
    expect(shapes.size).toBeGreaterThan(1);
  });
});

describe('buildEventScrapbookPlan — landscape posts', () => {
  it('gives a landscape post a wider cell than its portrait row-mate', () => {
    const plan = buildEventScrapbookPlan([post('wide', 1920, 1080), post('tall', 1080, 1920)], 'x');
    const cells = plan.rows[0].cells;
    const wide = cells.find(c => c.post.id === 'wide')!;
    const tall = cells.find(c => c.post.id === 'tall')!;
    expect(wide.isLandscape).toBe(true);
    expect(tall.isLandscape).toBe(false);
    expect(wide.widthRatio).toBeGreaterThan(tall.widthRatio);
    expect(wide.widthRatio).toBeCloseTo(0.6, 10); // 1.5 / (1.5 + 1)
  });

  it('splits a row evenly when no post is landscape', () => {
    const plan = buildEventScrapbookPlan([post('a'), post('b')], 'x');
    for (const cell of plan.rows[0].cells) {
      expect(cell.widthRatio).toBeCloseTo(0.5, 10);
    }
  });
});

describe('buildEventScrapbookPlan — shuffle stability', () => {
  const posts = makePosts(12);

  it('is deterministic: same posts + same seed => identical plan', () => {
    const a = buildEventScrapbookPlan(posts, 'seed-1');
    const b = buildEventScrapbookPlan(posts, 'seed-1');
    expect(flatIds(a)).toEqual(flatIds(b));
    expect(a.rows.map(r => r.cells.length)).toEqual(b.rows.map(r => r.cells.length));
  });

  it('does not depend on the incoming array order', () => {
    // A refetch that returns the same posts in a different order must not
    // rearrange the grid.
    const reversed = [...posts].reverse();
    expect(flatIds(buildEventScrapbookPlan(reversed, 'seed-1'))).toEqual(
      flatIds(buildEventScrapbookPlan(posts, 'seed-1'))
    );
  });

  it('reshuffles across seeds so a later visit feels fresh', () => {
    const day1 = flatIds(
      buildEventScrapbookPlan(posts, eventScrapbookSeed('e', new Date(2026, 6, 16)))
    );
    const day2 = flatIds(
      buildEventScrapbookPlan(posts, eventScrapbookSeed('e', new Date(2026, 6, 17)))
    );
    expect(day1).not.toEqual(day2);
  });

  it('slots a new post in without reordering the existing ones', () => {
    // The reason we hash per-post-id instead of shuffling the array: a post
    // arriving must not rearrange everything the user was just looking at.
    const before = flatIds(buildEventScrapbookPlan(posts, 'seed-1'));
    const after = flatIds(buildEventScrapbookPlan([...posts, post('brand-new')], 'seed-1'));
    const afterWithoutNew = after.filter(id => id !== 'brand-new');
    // 13 posts against a cap of 12 means exactly one falls off the end.
    expect(afterWithoutNew).toEqual(before.filter(id => afterWithoutNew.includes(id)));
  });

  it('keeps surviving posts in order when one is deleted', () => {
    const before = flatIds(buildEventScrapbookPlan(posts, 'seed-1'));
    const after = flatIds(buildEventScrapbookPlan(posts.slice(1), 'seed-1'));
    expect(after).toEqual(before.filter(id => id !== posts[0].id));
  });
});
