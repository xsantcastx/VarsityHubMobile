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

import { buildProgramSubTeams } from '@/constants/programs';

// The owner's model (July 28): a sport is ONE page. Its sub-teams (Boys
// Varsity, Girls JV, …) are a tappable list; picking one shows just that
// sub-team's upcoming events. There are never separate per-sub-team pages.
describe('buildProgramSubTeams — one page, tap a sub-team for its events', () => {
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

  it('returns each sub-team as its own tappable unit, labelled by gender + level', () => {
    const subs = buildProgramSubTeams([
      entry('varsity', 'boys', 'bv'),
      entry('jv', 'girls', 'gjv'),
    ]);
    expect(subs.map(s => s.label)).toEqual(['Boys Varsity', 'Girls JV']);
    expect(subs.map(s => s.teamId)).toEqual(['bv', 'gjv']);
  });

  it('orders sub-teams by level then gender (varsity before jv; boys before girls)', () => {
    const subs = buildProgramSubTeams([
      entry('jv', 'girls', 'gjv'),
      entry('varsity', 'girls', 'gv'),
      entry('varsity', 'boys', 'bv'),
      entry('jv', 'boys', 'bjv'),
    ]);
    expect(subs.map(s => s.teamId)).toEqual(['bv', 'gv', 'bjv', 'gjv']);
  });

  it("carries each sub-team's OWN games ascending by date, dateless last (no merging)", () => {
    const subs = buildProgramSubTeams([
      entry('varsity', 'boys', 'bv', [
        g('v2', '2026-03-05T00:00:00.000Z'),
        g('vnodate', null),
        g('v1', '2026-03-01T00:00:00.000Z'),
      ]),
      entry('jv', 'boys', 'bjv', [g('j1', '2026-03-02T00:00:00.000Z')]),
    ]);
    const bv = subs.find(s => s.teamId === 'bv')!;
    const bjv = subs.find(s => s.teamId === 'bjv')!;
    expect(bv.games.map((x: any) => x.id)).toEqual(['v1', 'v2', 'vnodate']);
    expect(bjv.games.map((x: any) => x.id)).toEqual(['j1']);
  });

  it('family-tree case: Freshman + JV + Varsity on ONE list, each with its own events', () => {
    const subs = buildProgramSubTeams([
      entry('freshman', 'boys', 'fr', [g('f1', '2026-03-05T00:00:00.000Z')]),
      entry('jv', 'boys', 'jv', [g('j1', '2026-03-03T00:00:00.000Z')]),
      entry('varsity', 'boys', 'vr', [g('v1', '2026-03-01T00:00:00.000Z')]),
    ]);
    expect(subs.map(s => s.label)).toEqual(['Boys Varsity', 'Boys JV', 'Boys Freshman']);
    expect(subs.find(s => s.teamId === 'fr')!.games.map((x: any) => x.id)).toEqual(['f1']);
    expect(subs.find(s => s.teamId === 'jv')!.games.map((x: any) => x.id)).toEqual(['j1']);
    expect(subs.find(s => s.teamId === 'vr')!.games.map((x: any) => x.id)).toEqual(['v1']);
  });

  it('skips entries with no team id', () => {
    const subs = buildProgramSubTeams([
      entry('varsity', 'boys', 'bv'),
      { level: 'jv', team: { id: null, gender: 'boys' }, games: [] },
    ]);
    expect(subs.map(s => s.teamId)).toEqual(['bv']);
  });
});

describe('buildProgramSubTeams schedule passthrough', () => {
  it('carries the server schedule array for each sub-team', () => {
    const subs = buildProgramSubTeams([
      {
        level: 'varsity',
        team: { id: 't1', gender: 'boys' },
        games: [],
        schedule: [
          { kind: 'event', id: 'e1', title: 'Practice', date: '2026-08-01T00:00:00.000Z' },
        ],
      },
    ] as any);
    expect(subs[0].schedule).toEqual([
      { kind: 'event', id: 'e1', title: 'Practice', date: '2026-08-01T00:00:00.000Z' },
    ]);
  });

  it('falls back to games when schedule is absent (old server response)', () => {
    const subs = buildProgramSubTeams([
      {
        level: 'jv',
        team: { id: 't2', gender: 'boys' },
        games: [{ id: 'g1', date: '2026-08-01' }],
      },
    ] as any);
    expect(subs[0].schedule.map((s: any) => s.id)).toEqual(['g1']);
  });
});
