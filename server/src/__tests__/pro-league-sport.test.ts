import { proLeagueToSport, PRO_LEAGUE_SPORT } from '../lib/proSchedule/leagueSport.js';

describe('proLeagueToSport', () => {
  it('maps each pro league to a canonical sport slug', () => {
    expect(proLeagueToSport('nfl')).toBe('football');
    expect(proLeagueToSport('nba')).toBe('basketball');
    expect(proLeagueToSport('wnba')).toBe('basketball');
    expect(proLeagueToSport('mlb')).toBe('baseball');
    expect(proLeagueToSport('wwe')).toBe('wrestling');
  });

  it('returns null for absent input', () => {
    expect(proLeagueToSport(null)).toBeNull();
    expect(proLeagueToSport(undefined)).toBeNull();
  });

  it('covers every ProLeague enum value', () => {
    for (const sport of Object.values(PRO_LEAGUE_SPORT)) {
      expect(typeof sport).toBe('string');
      expect(sport.length).toBeGreaterThan(0);
    }
  });
});
