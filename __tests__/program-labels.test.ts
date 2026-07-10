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
