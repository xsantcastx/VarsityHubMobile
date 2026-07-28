import {
  formatProgramLabel,
  formatTeamFolderLabel,
  formatLevelLabel,
  LEVEL_OPTIONS,
} from '@/constants/programs';

describe('program labels', () => {
  it('formats a program by sport name (gender is a team attribute, not the program)', () => {
    expect(formatProgramLabel({ id: '1', sport: 'basketball' })).toBe('Basketball');
    expect(formatProgramLabel({ id: '3', sport: 'track_field' })).toBe('Track & Field');
    expect(formatProgramLabel({ id: '2', sport: 'basketball', name: 'Lady Knights' })).toBe(
      'Lady Knights'
    );
    expect(formatProgramLabel({ id: '5', sport: 'unknown_slug' })).toBe('unknown_slug');
  });
  it('formats team folder labels from gender + level', () => {
    expect(formatTeamFolderLabel({ gender: 'girls', level: 'varsity' })).toBe('Girls Varsity');
    expect(formatTeamFolderLabel({ gender: 'boys', level: 'jv' })).toBe('Boys JV');
    expect(formatTeamFolderLabel({ gender: 'coed', level: 'varsity' })).toBe('Varsity');
    expect(formatTeamFolderLabel({ gender: null, level: 'freshman' })).toBe('Freshman');
    expect(formatTeamFolderLabel({ gender: 'girls', level: null })).toBe('Girls');
    expect(formatTeamFolderLabel({ gender: null, level: null })).toBe('Team');
  });
  it('formats levels null-safely', () => {
    expect(formatLevelLabel('jv')).toBe('JV');
    expect(formatLevelLabel('middle_school')).toBe('Middle School');
    expect(formatLevelLabel(null)).toBe(null);
    expect(formatLevelLabel('weird')).toBe(null);
  });
  it('exposes all six levels in display order', () => {
    expect(LEVEL_OPTIONS.map(l => l.value)).toEqual([
      'varsity',
      'jv',
      'freshman',
      'middle_school',
      'unified',
      'other',
    ]);
  });
});

import { buildProgramDisplayPlan, filterProgramGames } from '@/constants/programs';

describe('program display plan (one page per sport)', () => {
  const entry = (
    level: string | null,
    gender: string | null,
    teamId: string,
    games: any[] = []
  ) => ({
    level,
    team: { id: teamId, gender },
    games,
  });
  const g = (id: string, date: string | null) => ({ id, date });

  it('shows the gender toggle only when more than one gender bucket exists', () => {
    const both = buildProgramDisplayPlan([
      entry('varsity', 'boys', 't1'),
      entry('varsity', 'girls', 't2'),
    ]);
    expect(both.showGenderToggle).toBe(true);
    expect(both.genderOptions.map(o => o.label)).toEqual(['Boys', 'Girls']);

    const one = buildProgramDisplayPlan([
      entry('varsity', 'boys', 't1'),
      entry('jv', 'boys', 't2'),
    ]);
    expect(one.showGenderToggle).toBe(false);
    expect(one.genderOptions.map(o => o.value)).toEqual(['boys']);
  });

  it('buckets coed and unknown genders together as Coed', () => {
    const plan = buildProgramDisplayPlan([
      entry('varsity', 'coed', 't1'),
      entry('other', null, 't2'),
    ]);
    expect(plan.showGenderToggle).toBe(false);
    expect(plan.genderOptions).toEqual([{ value: 'coed', label: 'Coed' }]);
  });

  it('offers level chips only when the selected gender has more than one level', () => {
    const plan = buildProgramDisplayPlan([
      entry('varsity', 'boys', 't1'),
      entry('jv', 'boys', 't2'),
      entry('varsity', 'girls', 't3'),
    ]);
    expect(plan.levelChipsFor('boys').map(c => c.label)).toEqual(['All', 'Varsity', 'JV']);
    expect(plan.levelChipsFor('girls')).toEqual([]);
  });

  it('merges games across the selected gender levels, sorted by date, tagged with a level label', () => {
    const plan = buildProgramDisplayPlan([
      entry('jv', 'boys', 't2', [g('late', '2026-02-08T00:00:00.000Z')]),
      entry('varsity', 'boys', 't1', [g('early', '2026-02-01T00:00:00.000Z'), g('nodate', null)]),
      entry('varsity', 'girls', 't3', [g('girls', '2026-02-02T00:00:00.000Z')]),
    ]);
    const games = filterProgramGames(plan, 'boys', 'all');
    expect(games.map(x => x.game.id)).toEqual(['early', 'late', 'nodate']);
    expect(games[0].levelLabel).toBe('Varsity');
    expect(games[1].levelLabel).toBe('JV');
    expect(games[0].teamId).toBe('t1');
  });

  it('filters by a specific level chip', () => {
    const plan = buildProgramDisplayPlan([
      entry('varsity', 'boys', 't1', [g('v1', '2026-02-01T00:00:00.000Z')]),
      entry('jv', 'boys', 't2', [g('j1', '2026-02-02T00:00:00.000Z')]),
    ]);
    expect(filterProgramGames(plan, 'boys', 'jv').map(x => x.game.id)).toEqual(['j1']);
  });

  it('a single-team program needs no toggle and no chips', () => {
    const plan = buildProgramDisplayPlan([
      entry('other', 'coed', 't1', [g('a', '2026-07-12T00:00:00.000Z')]),
    ]);
    expect(plan.showGenderToggle).toBe(false);
    expect(plan.levelChipsFor('coed')).toEqual([]);
    expect(filterProgramGames(plan, 'coed', 'all').map(x => x.game.id)).toEqual(['a']);
  });
});

describe('family tree — Freshman + JV + Varsity of one sport on ONE page', () => {
  // The owner's core model: an org's sport is the parent; its Freshman/JV/Varsity
  // level teams are children of that ONE sport page, and each level's upcoming
  // events stay visible. This pins the exact 3-level, single-gender case.
  const fresh = { id: 'fr', name: 'Boys Freshman', gender: 'boys' };
  const jv = { id: 'jv', name: 'Boys JV', gender: 'boys' };
  const varsity = { id: 'vr', name: 'Boys Varsity', gender: 'boys' };
  const plan = () =>
    buildProgramDisplayPlan([
      { level: 'freshman', team: fresh, games: [{ id: 'f1', date: '2026-03-05T00:00:00.000Z' }] },
      { level: 'jv', team: jv, games: [{ id: 'j1', date: '2026-03-03T00:00:00.000Z' }] },
      { level: 'varsity', team: varsity, games: [{ id: 'v1', date: '2026-03-01T00:00:00.000Z' }] },
    ]);

  it('keeps all three levels on one page: no gender toggle, level chips in display order', () => {
    const p = plan();
    // Single gender → no toggle. Three levels → chips (All + each, varsity>jv>freshman).
    expect(p.showGenderToggle).toBe(false);
    expect(p.genderOptions.map(o => o.value)).toEqual(['boys']);
    expect(p.levelChipsFor('boys').map(c => c.label)).toEqual(['All', 'Varsity', 'JV', 'Freshman']);
  });

  it('the merged "All" feed shows every level’s upcoming events, date-sorted and level-tagged', () => {
    const rows = filterProgramGames(plan(), 'boys', 'all');
    expect(rows.map(r => r.game.id)).toEqual(['v1', 'j1', 'f1']); // Mar 1, 3, 5
    expect(rows.map(r => r.levelLabel)).toEqual(['Varsity', 'JV', 'Freshman']);
    // Each event is attributed to the correct level team.
    expect(rows.map(r => r.teamId)).toEqual(['vr', 'jv', 'fr']);
  });

  it('tapping a level chip narrows to just that level’s events', () => {
    expect(filterProgramGames(plan(), 'boys', 'freshman').map(r => r.game.id)).toEqual(['f1']);
    expect(filterProgramGames(plan(), 'boys', 'jv').map(r => r.game.id)).toEqual(['j1']);
    expect(filterProgramGames(plan(), 'boys', 'varsity').map(r => r.game.id)).toEqual(['v1']);
  });
});

describe('program display plan — intra-program games', () => {
  it('a game between two level teams of the same program renders once, attributed to the higher level', () => {
    // Server maps a game to BOTH its home and away team (programs.ts groups by
    // home_team_id AND away_team_id), so a Varsity-vs-JV scrimmage arrives in
    // two level entries. The merged feed must dedupe by game id.
    const scrimmage = { id: 'gx', date: '2026-02-03T00:00:00.000Z' };
    const plan = buildProgramDisplayPlan([
      { level: 'jv', team: { id: 't2', gender: 'boys' }, games: [scrimmage] },
      { level: 'varsity', team: { id: 't1', gender: 'boys' }, games: [scrimmage] },
    ]);
    const rows = filterProgramGames(plan, 'boys', 'all');
    expect(rows).toHaveLength(1);
    expect(rows[0].levelLabel).toBe('Varsity');
  });
});
