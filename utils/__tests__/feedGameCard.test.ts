import { getDeterministicGameCardGradient } from '../feedGameCard';

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
