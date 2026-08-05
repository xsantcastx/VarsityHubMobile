import {
  getDeterministicGameCardGradient,
  proGameCardGradient,
  stadiumMapImageUrl,
} from '../feedGameCard';

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

describe('stadiumMapImageUrl', () => {
  const KEY = 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY';
  const original = process.env[KEY];
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it('builds a hybrid static-map url centered on the venue when a key is set', () => {
    process.env[KEY] = 'test-key';
    const url = stadiumMapImageUrl(29.7573, -95.3555);
    expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
    expect(url).toContain('center=29.75730,-95.35550');
    expect(url).toContain('maptype=hybrid');
    expect(url).toContain('key=test-key');
  });

  it('returns null without a key so the caller falls back to the gradient', () => {
    delete process.env[KEY];
    expect(stadiumMapImageUrl(29.7573, -95.3555)).toBeNull();
  });

  it('returns null for missing/invalid/0,0 coords', () => {
    process.env[KEY] = 'test-key';
    expect(stadiumMapImageUrl(null, null)).toBeNull();
    expect(stadiumMapImageUrl(29.75, undefined)).toBeNull();
    expect(stadiumMapImageUrl(NaN, 10)).toBeNull();
    expect(stadiumMapImageUrl(0, 0)).toBeNull();
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
