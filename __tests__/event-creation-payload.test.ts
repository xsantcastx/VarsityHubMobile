import { buildQuickGamePayload } from '@/utils/quickGamePayload';
import { clampImageCrop, imageCropRect } from '@/utils/imageCrop';
import type { QuickGameData } from '@/components/QuickAddGameModal';
const base: QuickGameData = {
  currentTeam: 'Vipers',
  currentTeamId: 'vipers-id',
  opponent: 'Local Rivals',
  opponentTeamId: '',
  date: '2027-01-02',
  time: '7:30 PM',
  type: 'home',
  isCompetitive: true,
  homeVenue: 'Vipers Stadium',
  homeVenueLat: 0,
  homeVenueLng: -73,
  awayVenue: 'Away Field',
  eventType: 'game',
  liveWindowHours: 5,
};

describe('event creation payload shared by Discover and season management', () => {
  it('keeps manual opponent, home team, local clock time, venue, zero coordinate, banner and duration', () => {
    const payload = buildQuickGamePayload({
      ...base,
      banner_url: 'https://example.com/banner.jpg',
    });
    expect(payload).toMatchObject({
      home_team_id: 'vipers-id',
      away_team_name: 'Local Rivals',
      location: 'Vipers Stadium',
      latitude: 0,
      longitude: -73,
      live_window_hours_after_start: 5,
      banner_url: 'https://example.com/banner.jpg',
      cover_image_url: 'https://example.com/banner.jpg',
    });
    expect(payload.away_team_id).toBeUndefined();
    const date = new Date(payload.date as string);
    expect([
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ]).toEqual([2027, 0, 2, 19, 30]);
  });
  it('keeps the creator team on the away side when the home opponent is entered manually', () => {
    expect(buildQuickGamePayload({ ...base, type: 'away', liveWindowHours: 12 })).toMatchObject({
      home_team: 'Local Rivals',
      away_team: 'Vipers',
      home_team_id: undefined,
      away_team_id: 'vipers-id',
      location: 'Away Field',
      live_window_hours_after_start: 12,
    });
  });
  it.each([
    [
      'watch_party',
      { watchLocation: 'Watch Venue', watchLocationLat: 40, watchLocationLng: -70 },
      'Watch Venue',
    ],
    ['team_trip', { destination: 'Trip Destination' }, 'Trip Destination'],
    ['fundraiser', {}, 'Vipers Stadium'],
  ] as const)('maps the actual location for %s', (eventType, patch, location) => {
    expect(
      buildQuickGamePayload({ ...base, ...patch, isCompetitive: false, eventType })
    ).toMatchObject({
      location,
      home_team_id: 'vipers-id',
      away_team_id: undefined,
      away_team: undefined,
    });
  });
  it.each(['game', 'watch_party', 'team_trip', 'fundraiser'] as const)(
    'requires location for %s',
    eventType => {
      expect(() =>
        buildQuickGamePayload({
          ...base,
          eventType,
          isCompetitive: eventType === 'game',
          homeVenue: '',
          awayVenue: '',
        })
      ).toThrow('location');
    }
  );
  it('rejects calendar rollover and invalid time; omitted duration preserves server default', () => {
    expect(() => buildQuickGamePayload({ ...base, date: '2027-02-30' })).toThrow('date');
    expect(() => buildQuickGamePayload({ ...base, time: '13:00 PM' })).toThrow('time');
    expect(
      buildQuickGamePayload({ ...base, liveWindowHours: undefined }).live_window_hours_after_start
    ).toBeUndefined();
  });
});

describe('original-resolution banner crop geometry', () => {
  const frame = { width: 320, height: 180 };
  it('centers a portrait source in the 16:9 frame without blank pixels', () => {
    expect(imageCropRect({ width: 1200, height: 1600 }, frame, { zoom: 1, x: 0, y: 0 })).toEqual({
      originX: 0,
      originY: 463,
      width: 1200,
      height: 675,
    });
  });
  it('pinch zoom crops original pixels and clamps panning to the image boundaries', () => {
    const source = { width: 1600, height: 900 };
    expect(imageCropRect(source, frame, { zoom: 2, x: 999, y: -999 })).toEqual({
      originX: 0,
      originY: 450,
      width: 800,
      height: 450,
    });
    expect(clampImageCrop(source, frame, { zoom: 0.1, x: 999, y: -999 })).toMatchObject({
      zoom: 1,
      x: 0,
      y: -0,
      width: 320,
      height: 180,
    });
  });
  it('never returns crop pixels outside portrait/landscape bounds at extreme gestures', () => {
    for (const source of [
      { width: 700, height: 2000 },
      { width: 3000, height: 750 },
    ])
      for (const zoom of [1, 1.37, 3, 10])
        for (const x of [-99999, 0, 99999]) {
          const rect = imageCropRect(source, frame, { zoom, x, y: -x });
          expect(rect.originX).toBeGreaterThanOrEqual(0);
          expect(rect.originY).toBeGreaterThanOrEqual(0);
          expect(rect.originX + rect.width).toBeLessThanOrEqual(source.width);
          expect(rect.originY + rect.height).toBeLessThanOrEqual(source.height);
          expect(rect.width / rect.height).toBeCloseTo(16 / 9, 1);
        }
  });
});
