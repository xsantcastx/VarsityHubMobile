import {
  canShowGamePoll,
  getEventPresentationPhase,
  isCompetitiveEventType,
  isEventPastEndOfDay,
} from '@/utils/eventPresentation';

describe('eventPresentation helpers', () => {
  it('only treats competitive games as poll eligible', () => {
    expect(canShowGamePoll({ gameId: 'game-1', eventType: 'game' })).toBe(true);
    expect(canShowGamePoll({ gameId: 'game-1', eventType: 'fundraiser' })).toBe(false);
    expect(canShowGamePoll({ gameId: null, eventType: 'game' })).toBe(false);
    // sample- ids no longer get a poll carve-out — the demo system is retired
    expect(canShowGamePoll({ gameId: 'sample-demo', eventType: 'fundraiser' })).toBe(false);
  });

  it('keeps legacy null event types competitive by default', () => {
    expect(isCompetitiveEventType(null)).toBe(true);
    expect(isCompetitiveEventType(undefined)).toBe(true);
  });

  it('keeps event pages active after the live window until end of day', () => {
    const eventDate = new Date(2026, 4, 6, 12, 0, 0, 0);
    const iso = eventDate.toISOString();

    expect(getEventPresentationPhase(iso, new Date(2026, 4, 6, 11, 0, 0, 0).getTime())).toBe(
      'upcoming'
    );
    expect(getEventPresentationPhase(iso, new Date(2026, 4, 6, 13, 0, 0, 0).getTime())).toBe(
      'live'
    );
    expect(getEventPresentationPhase(iso, new Date(2026, 4, 6, 16, 0, 0, 0).getTime())).toBe(
      'active'
    );
    expect(getEventPresentationPhase(iso, new Date(2026, 4, 7, 0, 1, 0, 0).getTime())).toBe(
      'final'
    );
  });

  it('marks past only after the event day ends', () => {
    const eventDate = new Date(2026, 4, 6, 18, 0, 0, 0);
    const iso = eventDate.toISOString();

    expect(isEventPastEndOfDay(iso, new Date(2026, 4, 6, 23, 0, 0, 0).getTime())).toBe(false);
    expect(isEventPastEndOfDay(iso, new Date(2026, 4, 7, 0, 1, 0, 0).getTime())).toBe(true);
  });
});
