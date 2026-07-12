/**
 * buildEventDetailRoute — game-linked events must route to the rich game
 * screen, never the retired RSVP stub. Standalone events use the public event
 * page (the page fans upload posts to). Regression guard for the Discover
 * "duplicate event screen" bug — the stub route survives only as a
 * deep-link redirector and must never be a navigation destination.
 */
import { buildEventDetailRoute, PUBLIC_EVENT_PATHNAME } from '../eventRoutes';

describe('buildEventDetailRoute', () => {
  it('routes standalone events (no game_id) to the public event page', () => {
    expect(buildEventDetailRoute('evt-1')).toEqual({
      pathname: PUBLIC_EVENT_PATHNAME,
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
      pathname: PUBLIC_EVENT_PATHNAME,
      params: { id: 'evt-1' },
    });
    expect(buildEventDetailRoute('evt-1', undefined)).toEqual({
      pathname: PUBLIC_EVENT_PATHNAME,
      params: { id: 'evt-1' },
    });
    expect(buildEventDetailRoute('evt-1', '  ')).toEqual({
      pathname: PUBLIC_EVENT_PATHNAME,
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
