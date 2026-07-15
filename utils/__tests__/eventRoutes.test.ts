/**
 * buildEventDetailRoute — ONE canonical rich detail screen for both games and
 * events (owner: "this is not an event page", 2026-07-14). Game-linked events
 * route to /game/[id] by gameId; standalone events also route to /game/[id]
 * with id === eventId (GameDetailsScreen.load() dispatches to the event loader
 * in that case). public-event.tsx survives only as the web share/OG landing —
 * never an in-app navigation destination.
 */
import { buildEventDetailRoute } from '../eventRoutes';

describe('buildEventDetailRoute', () => {
  it('routes standalone events (no game_id) to the rich page with id === eventId', () => {
    expect(buildEventDetailRoute('evt-1')).toEqual({
      pathname: '/game/[id]',
      params: { id: 'evt-1', eventId: 'evt-1' },
    });
  });

  it('routes game-linked events to the game screen by gameId', () => {
    expect(buildEventDetailRoute('evt-1', 'game-9')).toEqual({
      pathname: '/game/[id]',
      params: { id: 'game-9' },
    });
  });

  it('treats null/undefined/blank gameId as standalone (rich page, eventId in both slots)', () => {
    for (const g of [null, undefined, '  ']) {
      expect(buildEventDetailRoute('evt-1', g as any)).toEqual({
        pathname: '/game/[id]',
        params: { id: 'evt-1', eventId: 'evt-1' },
      });
    }
  });

  it('normalizes numeric game ids', () => {
    expect(buildEventDetailRoute(7, 42)).toEqual({
      pathname: '/game/[id]',
      params: { id: '42' },
    });
  });
});
