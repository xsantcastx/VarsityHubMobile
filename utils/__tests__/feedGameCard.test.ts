import { getDeterministicGameCardGradient, proGameCardGradient } from '../feedGameCard';

describe('proGameCardGradient', () => {
  it('uses both team colors when valid (away, home)', () => {
    expect(proGameCardGradient('#97233F', '#241773')).toEqual(['#241773', '#97233f']);
  });

  it('normalizes 3-digit hex and a missing #', () => {
    expect(proGameCardGradient('#abc', 'def')).toEqual(['#ddeeff', '#aabbcc']);
  });

  it('pairs a lone color with a darkened variant', () => {
    const result = proGameCardGradient('#ffffff', null);
    expect(result).not.toBeNull();
    expect(result![1]).toBe('#ffffff');
    expect(result![0]).not.toBe('#ffffff');
  });

  it('returns null for no/invalid colors so the deterministic gradient is used', () => {
    expect(proGameCardGradient(null, null)).toBeNull();
    expect(proGameCardGradient('not-a-color', '')).toBeNull();
  });
});

describe('getDeterministicGameCardGradient', () => {
  it('returns the same gradient for the same game identity', () => {
    expect(getDeterministicGameCardGradient('game-123', 'Championship')).toEqual(
      getDeterministicGameCardGradient('game-123', 'Championship')
    );
  });

  it('falls back to title when the id is unavailable', () => {
    expect(getDeterministicGameCardGradient(null, 'Title Only')).toEqual(
      getDeterministicGameCardGradient(undefined, 'Title Only')
    );
  });
});
