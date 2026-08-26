import { MAP_WINDOW_DAYS, shouldShowEventOnMap } from '../utils/mapEventFilters';

describe('shouldShowEventOnMap', () => {
  const now = new Date('2026-04-22T12:00:00.000Z');
  const dayMs = 24 * 60 * 60 * 1000;

  it('keeps future events inside the window on the map', () => {
    expect(shouldShowEventOnMap('2026-04-22T12:00:01.000Z', now)).toBe(true);
  });

  it('drops past events from the map', () => {
    expect(shouldShowEventOnMap('2026-04-22T11:59:59.000Z', now)).toBe(false);
  });

  it('keeps an event on the last day of the window', () => {
    // +14 days minus a minute — still inside the rolling map window.
    const justInside = new Date(now.getTime() + MAP_WINDOW_DAYS * dayMs - 60_000).toISOString();
    expect(shouldShowEventOnMap(justInside, now)).toBe(true);
  });

  it('drops events beyond the +14 day window (e.g. bulk-imported pro fixtures)', () => {
    const justOutside = new Date(now.getTime() + MAP_WINDOW_DAYS * dayMs + 60_000).toISOString();
    expect(shouldShowEventOnMap(justOutside, now)).toBe(false);
    const monthsOut = new Date(now.getTime() + 90 * dayMs).toISOString();
    expect(shouldShowEventOnMap(monthsOut, now)).toBe(false);
  });

  it('fails open for missing or invalid dates', () => {
    expect(shouldShowEventOnMap(undefined, now)).toBe(true);
    expect(shouldShowEventOnMap('not-a-date', now)).toBe(true);
  });
});
