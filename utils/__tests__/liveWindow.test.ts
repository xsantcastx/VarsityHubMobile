import { getLiveBounds, isGameLive, isGameOver, isPostingWindowOpen } from '@/utils/liveWindow';

describe('liveWindow', () => {
  it('has no early cutoff for event-page posting before the start time', () => {
    const event = {
      starts_at: '2026-07-16T17:00:00.000Z',
      live_from: null,
      live_until: '2026-07-17T11:00:00.000Z',
    };
    const earlyArrival = Date.parse('2026-07-16T05:00:00.000Z');

    expect(isPostingWindowOpen(event, earlyArrival)).toBe(true);
    expect(isGameLive(event, earlyArrival)).toBe(false);
    expect(isGameOver(event, earlyArrival)).toBe(false);
  });

  it('ignores legacy live_from lower bounds and only closes posting after live_until', () => {
    const event = {
      starts_at: '2026-07-16T17:00:00.000Z',
      live_from: '2026-07-16T15:00:00.000Z',
      live_until: '2026-07-16T20:00:00.000Z',
    };

    expect(isPostingWindowOpen(event, Date.parse('2026-07-16T14:00:00.000Z'))).toBe(true);
    expect(isPostingWindowOpen(event, Date.parse('2026-07-16T20:00:01.000Z'))).toBe(false);
  });

  it('falls back to the server default 3h after-start window for old payloads', () => {
    const event = { date: '2026-07-16T17:00:00.000Z' };

    expect(getLiveBounds(event)).toEqual({
      startsAt: Date.parse('2026-07-16T17:00:00.000Z'),
      liveUntil: Date.parse('2026-07-16T20:00:00.000Z'),
    });
    expect(isPostingWindowOpen(event, Date.parse('2026-07-16T05:00:00.000Z'))).toBe(true);
  });
});
