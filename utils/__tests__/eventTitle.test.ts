import { gameRowTitle } from '../eventTitle';

describe('gameRowTitle', () => {
  it('competitive game with opponent shows "vs {opponent}"', () => {
    expect(gameRowTitle({ event_type: 'game', opponent: 'Eagles' })).toBe('vs Eagles');
  });

  it('competitive game missing opponent shows "vs TBD"', () => {
    expect(gameRowTitle({ event_type: 'game' })).toBe('vs TBD');
  });

  it('null event_type with opponent is treated as competitive', () => {
    expect(gameRowTitle({ event_type: null, opponent: 'Hawks' })).toBe('vs Hawks');
  });

  it('omitted (undefined) event_type with opponent is treated as competitive', () => {
    expect(gameRowTitle({ opponent: 'Hawks' })).toBe('vs Hawks');
  });

  it('omitted (undefined) event_type with no opponent shows "vs TBD"', () => {
    expect(gameRowTitle({})).toBe('vs TBD');
  });

  it('empty-string event_type with opponent is treated as competitive', () => {
    expect(gameRowTitle({ event_type: '', opponent: 'Hawks' })).toBe('vs Hawks');
  });

  it('fundraiser with a title shows the title', () => {
    expect(gameRowTitle({ event_type: 'fundraiser', title: 'Spring Fundraiser' })).toBe(
      'Spring Fundraiser'
    );
  });

  it('fundraiser without a title falls back to "Fundraiser"', () => {
    expect(gameRowTitle({ event_type: 'fundraiser' })).toBe('Fundraiser');
  });

  it('watch_party without a title falls back to "Watch Party"', () => {
    expect(gameRowTitle({ event_type: 'watch_party' })).toBe('Watch Party');
  });

  it('team_trip without a title falls back to "Team Trip"', () => {
    expect(gameRowTitle({ event_type: 'team_trip' })).toBe('Team Trip');
  });

  it('meeting without a title falls back to "Meeting"', () => {
    expect(gameRowTitle({ event_type: 'meeting' })).toBe('Meeting');
  });

  it('team_meal without a title falls back to "Team Meal"', () => {
    expect(gameRowTitle({ event_type: 'team_meal' })).toBe('Team Meal');
  });

  it('other without a title falls back to "Event"', () => {
    expect(gameRowTitle({ event_type: 'other' })).toBe('Event');
  });

  it('uses away_team when opponent is absent', () => {
    expect(gameRowTitle({ event_type: 'game', away_team: 'Wolves' })).toBe('vs Wolves');
  });

  it('uses away_team_name when opponent and away_team are absent', () => {
    expect(gameRowTitle({ event_type: 'game', away_team_name: 'Lions' })).toBe('vs Lions');
  });

  it('event_type is case-insensitive and trimmed for the competitive check', () => {
    expect(gameRowTitle({ event_type: '  GAME  ', opponent: 'Bears' })).toBe('vs Bears');
  });

  it('non-competitive title is trimmed', () => {
    expect(gameRowTitle({ event_type: 'fundraiser', title: '  Spring Gala  ' })).toBe(
      'Spring Gala'
    );
  });
});
