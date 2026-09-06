import { EVENTS } from '../../scripts/one-off/one-off-events.data';

describe('one-off event data', () => {
  it('includes the FIBA Women’s World Cup group-stage slate as league-backed map events', () => {
    const fibaEvents = EVENTS.filter(e => e.sportsLeagueSlug === 'fiba_womens_world_cup');

    expect(fibaEvents).toHaveLength(24);
    for (const event of fibaEvents) {
      expect(event.eventType).toBe('game');
      expect(event.linkedLeague).toBe('FIBA Women’s Basketball World Cup 2026');
      expect(event.location).toMatch(/Berlin/);
      expect(typeof event.lat).toBe('number');
      expect(typeof event.lng).toBe('number');
      expect(event.game?.isNeutral).toBe(true);
    }
  });

  it('includes USA Basketball women’s group-stage games', () => {
    const usaFibaTitles = EVENTS.filter(e => e.sportsLeagueSlug === 'fiba_womens_world_cup')
      .filter(e => e.game?.homeTeam === 'USA' || e.game?.awayTeam === 'USA')
      .map(e => e.title);

    expect(usaFibaTitles).toEqual([
      'USA vs China — FIBA Women’s Basketball World Cup 2026',
      'Italy vs USA — FIBA Women’s Basketball World Cup 2026',
      'USA vs Czechia — FIBA Women’s Basketball World Cup 2026',
    ]);
  });
});
