import { describe, expect, it } from '@jest/globals';
import { shouldShowEventOnMap } from '../mapEventFilters';

describe('shouldShowEventOnMap', () => {
  const now = new Date('2026-08-22T12:00:00Z');

  it('shows a game happening now or in the future', () => {
    expect(shouldShowEventOnMap('2026-08-22T18:00:00Z', now)).toBe(true);
    expect(shouldShowEventOnMap('2026-08-25T12:00:00Z', now)).toBe(true);
  });

  it('shows a game up to 7 days in the past (post-grace window)', () => {
    expect(shouldShowEventOnMap('2026-08-16T12:00:01Z', now)).toBe(true); // 6d23h59m59s ago
  });

  it('hides a game older than 7 days', () => {
    expect(shouldShowEventOnMap('2026-08-15T11:59:59Z', now)).toBe(false); // >7d ago
  });

  it('respects a custom grace window', () => {
    expect(shouldShowEventOnMap('2026-08-20T12:00:00Z', now, 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('still defaults to true for a missing/invalid date (unchanged behavior)', () => {
    expect(shouldShowEventOnMap(null, now)).toBe(true);
    expect(shouldShowEventOnMap('not-a-date', now)).toBe(true);
  });
});
