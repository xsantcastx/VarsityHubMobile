import { shouldShowEventOnMap } from '../utils/mapEventFilters';

describe('shouldShowEventOnMap', () => {
  const now = new Date('2026-04-22T12:00:00.000Z');

  it('keeps future events on the map', () => {
    expect(shouldShowEventOnMap('2026-04-22T12:00:01.000Z', now)).toBe(true);
  });

  it('drops past events from the map', () => {
    expect(shouldShowEventOnMap('2026-04-22T11:59:59.000Z', now)).toBe(false);
  });

  it('fails open for missing or invalid dates', () => {
    expect(shouldShowEventOnMap(undefined, now)).toBe(true);
    expect(shouldShowEventOnMap('not-a-date', now)).toBe(true);
  });
});
