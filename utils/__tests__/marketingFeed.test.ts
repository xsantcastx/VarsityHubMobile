import { pickTopShuffled, shuffleInPlace } from '../marketingFeed';

describe('marketingFeed helpers', () => {
  test('shuffleInPlace is a permutation (no items lost or duplicated)', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffleInPlace([...src]);
    expect([...out].sort((a, b) => a - b)).toEqual(src);
    expect(out).toHaveLength(src.length);
  });

  test('shuffleInPlace with a fixed RNG is deterministic', () => {
    // rng always returns 0 -> Fisher-Yates swaps each i with index 0.
    const zeroRng = () => 0;
    expect(shuffleInPlace([1, 2, 3, 4], zeroRng)).toEqual([2, 3, 4, 1]);
  });

  test('pickTopShuffled takes only the top N and does not mutate the source', () => {
    const ranked = ['a', 'b', 'c', 'd', 'e'];
    const out = pickTopShuffled(ranked, 3, () => 0);
    expect(out).toHaveLength(3);
    // Every result item comes from the top-3 slice.
    expect(out.every(x => ['a', 'b', 'c'].includes(x))).toBe(true);
    // Source untouched.
    expect(ranked).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('pickTopShuffled clamps count to the array length and to >= 0', () => {
    expect(pickTopShuffled(['a', 'b'], 10)).toHaveLength(2);
    expect(pickTopShuffled(['a', 'b'], -5)).toHaveLength(0);
  });
});
