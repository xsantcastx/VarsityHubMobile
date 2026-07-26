/**
 * "Select Your Team" is a sport -> sub-team cascade, not a flat list.
 *
 * A coach's teams inside one sport are sibling level teams (boys/JV,
 * girls/varsity). The picker should ask for the SPORT first, then which level
 * team the game is for — and skip the second step when a sport has only one
 * team. Ungrouped teams (no program) are their own single-team sports.
 *
 * This is the pure grouping the picker UI renders.
 */

import { buildTeamPickerSports } from '@/utils/teamPickerCascade';

type T = Parameters<typeof buildTeamPickerSports>[0][number];

const team = (over: Partial<T>): T =>
  ({ id: 'x', name: 'X', sport: null, program_id: null, level: null, gender: null, ...over }) as T;

describe('buildTeamPickerSports', () => {
  it('groups level teams that share a program into one sport with sub-teams', () => {
    const sports = buildTeamPickerSports([
      team({
        id: 'a',
        name: 'BV',
        sport: 'basketball',
        program_id: 'p1',
        gender: 'boys',
        level: 'varsity',
      }),
      team({
        id: 'b',
        name: 'GV',
        sport: 'basketball',
        program_id: 'p1',
        gender: 'girls',
        level: 'varsity',
      }),
    ]);
    expect(sports).toHaveLength(1);
    expect(sports[0].label).toBe('Basketball');
    expect(sports[0].isSingle).toBe(false);
    expect(sports[0].teams.map(t => t.id)).toEqual(['a', 'b']);
  });

  it('marks a single-team sport so the UI can skip the second step', () => {
    const sports = buildTeamPickerSports([
      team({ id: 'a', name: 'Only', sport: 'soccer', program_id: 'p1', level: 'varsity' }),
    ]);
    expect(sports).toHaveLength(1);
    expect(sports[0].isSingle).toBe(true);
    expect(sports[0].teams).toHaveLength(1);
  });

  it('treats each ungrouped team as its own single-team sport labeled by its name', () => {
    const sports = buildTeamPickerSports([
      team({ id: 'a', name: 'Sample', program_id: null }),
      team({ id: 'b', name: 'FOOTBALL', program_id: null }),
    ]);
    expect(sports).toHaveLength(2);
    expect(sports.every(s => s.isSingle)).toBe(true);
    expect(sports.map(s => s.label).sort()).toEqual(['FOOTBALL', 'Sample']);
  });

  it('labels sub-teams by gender + level', () => {
    const sports = buildTeamPickerSports([
      team({
        id: 'a',
        name: 'x',
        sport: 'basketball',
        program_id: 'p1',
        gender: 'girls',
        level: 'jv',
      }),
      team({
        id: 'b',
        name: 'y',
        sport: 'basketball',
        program_id: 'p1',
        gender: 'boys',
        level: 'varsity',
      }),
    ]);
    const labels = sports[0].teams.map(t => t.label);
    expect(labels).toContain('Girls JV');
    expect(labels).toContain('Boys Varsity');
  });

  it('orders sub-teams by gender then level (boys varsity before girls jv)', () => {
    const sports = buildTeamPickerSports([
      team({
        id: 'gjv',
        name: 'g',
        sport: 'basketball',
        program_id: 'p1',
        gender: 'girls',
        level: 'jv',
      }),
      team({
        id: 'bv',
        name: 'b',
        sport: 'basketball',
        program_id: 'p1',
        gender: 'boys',
        level: 'varsity',
      }),
    ]);
    expect(sports[0].teams.map(t => t.id)).toEqual(['bv', 'gjv']);
  });

  it('sorts sports alphabetically by label', () => {
    const sports = buildTeamPickerSports([
      team({ id: 'a', name: 'a', sport: 'soccer', program_id: 'p2', level: 'varsity' }),
      team({ id: 'b', name: 'b', sport: 'basketball', program_id: 'p1', level: 'varsity' }),
    ]);
    expect(sports.map(s => s.label)).toEqual(['Basketball', 'Soccer']);
  });

  it('is empty for no teams', () => {
    expect(buildTeamPickerSports([])).toEqual([]);
  });
});
