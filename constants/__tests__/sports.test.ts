import { normalizeSportSlug, sportEmoji, SPORT_EMOJI, SPORT_OPTIONS } from '../sports';

describe('normalizeSportSlug', () => {
  it('passes a canonical slug through', () => {
    expect(normalizeSportSlug('football')).toBe('football');
  });
  it('maps a human label to its slug', () => {
    expect(normalizeSportSlug('Ice Hockey')).toBe('ice_hockey');
    expect(normalizeSportSlug('Football')).toBe('football');
  });
  it('is case- and separator-insensitive', () => {
    expect(normalizeSportSlug('  TRACK & FIELD ')).toBe('track_field');
  });
  it('returns null for unknown / empty input', () => {
    expect(normalizeSportSlug('quidditch')).toBeNull();
    expect(normalizeSportSlug(null)).toBeNull();
    expect(normalizeSportSlug(undefined)).toBeNull();
  });
});

describe('sportEmoji', () => {
  it('resolves an emoji for labels and slugs', () => {
    expect(sportEmoji('basketball')).toBe('🏀');
    expect(sportEmoji('Ice Hockey')).toBe('🏒');
  });
  it('returns null when the sport is unknown', () => {
    expect(sportEmoji('quidditch')).toBeNull();
  });
});

describe('taxonomy/emoji parity', () => {
  it('every taxonomy sport has an emoji chip glyph', () => {
    for (const { slug } of SPORT_OPTIONS) {
      expect(SPORT_EMOJI[slug]).toBeTruthy();
    }
  });
});
