/**
 * buildEventDetailRoute — game-linked events must route to the rich game
 * screen, never the event-detail RSVP stub. Standalone events keep using
 * event-detail. Regression guard for the Discover "duplicate event screen"
 * bug (game events opening a bare RSVP page instead of the game page).
 */
import { buildEventDetailRoute, EVENT_DETAIL_PATHNAME } from '../eventRoutes';

describe('buildEventDetailRoute', () => {
  it('routes standalone events (no game_id) to event-detail', () => {
    expect(buildEventDetailRoute('evt-1')).toEqual({
      pathname: EVENT_DETAIL_PATHNAME,
      params: { id: 'evt-1' },
    });
  });

  it('routes game-linked events to the game screen', () => {
    expect(buildEventDetailRoute('evt-1', 'game-9')).toEqual({
      pathname: '/game/[id]',
      params: { id: 'game-9' },
    });
  });

  it('treats null/undefined/blank gameId as standalone', () => {
    expect(buildEventDetailRoute('evt-1', null)).toEqual({
      pathname: EVENT_DETAIL_PATHNAME,
      params: { id: 'evt-1' },
    });
    expect(buildEventDetailRoute('evt-1', undefined)).toEqual({
      pathname: EVENT_DETAIL_PATHNAME,
      params: { id: 'evt-1' },
    });
    expect(buildEventDetailRoute('evt-1', '  ')).toEqual({
      pathname: EVENT_DETAIL_PATHNAME,
      params: { id: 'evt-1' },
    });
  });

  it('normalizes numeric game ids', () => {
    expect(buildEventDetailRoute(7, 42)).toEqual({
      pathname: '/game/[id]',
      params: { id: '42' },
    });
  });
});
