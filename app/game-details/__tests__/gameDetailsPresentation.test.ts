import {
  canAddStory,
  capCount,
  DEMO_MATCHUP_TAG,
  ensureIso,
  formatDateLabel,
  formatTimeLabel,
  getVenuePhoto,
  pickBannerFromArrays,
} from '@/utils/gameDetailsPresentation';

describe('gameDetailsPresentation', () => {
  it('normalizes dates and rejects non-date values', () => {
    const date = new Date('2026-07-01T20:00:00.000Z');

    expect(ensureIso(date)).toBe('2026-07-01T20:00:00.000Z');
    expect(ensureIso('2026-07-01T20:00:00.000Z')).toBe('2026-07-01T20:00:00.000Z');
    expect(ensureIso(123)).toBeNull();
  });

  it('formats labels only for valid ISO values', () => {
    expect(formatDateLabel('bad')).toBe('');
    expect(formatTimeLabel(null)).toBe('');
    expect(formatDateLabel('2026-07-01T20:00:00.000Z')).toContain('2026');
    expect(formatTimeLabel('2026-07-01T20:00:00.000Z')).toMatch(/\d/);
  });

  it('normalizes venue photos defensively', () => {
    expect(getVenuePhoto({ url: 'https://cdn.example.com/a.jpg', credit: 'Arena' })).toEqual({
      url: 'https://cdn.example.com/a.jpg',
      credit: 'Arena',
    });
    expect(getVenuePhoto({ url: 10, credit: null })).toEqual({ url: null, credit: null });
    expect(getVenuePhoto(null)).toEqual({ url: null, credit: null });
  });

  it('caps RSVP count to capacity when capacity is valid', () => {
    expect(capCount(50, 40)).toBe(40);
    expect(capCount(30, 40)).toBe(30);
    expect(capCount(30, null)).toBe(30);
    expect(capCount(null, 40)).toBeNull();
  });

  it('allows demo matchup stories regardless of posting window', () => {
    expect(canAddStory('2020-01-01T00:00:00.000Z', 'game-1', DEMO_MATCHUP_TAG)).toBe(true);
  });

  it('prefers uploaded banners over cover images', () => {
    expect(
      pickBannerFromArrays({
        bannerUrl: 'https://cdn.example.com/banner.jpg',
        coverImageUrl: 'https://cdn.example.com/cover.jpg',
      })
    ).toBe('https://cdn.example.com/banner.jpg');
    expect(pickBannerFromArrays({ coverImageUrl: 'https://cdn.example.com/cover.jpg' })).toBe(
      'https://cdn.example.com/cover.jpg'
    );
  });
});
