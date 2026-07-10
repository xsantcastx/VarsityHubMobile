import { formatProgramLabel, formatLevelLabel, LEVEL_OPTIONS } from '@/constants/programs';

describe('program labels', () => {
  it('formats gendered and coed programs', () => {
    expect(formatProgramLabel({ id: '1', sport: 'basketball', gender: 'girls' })).toBe(
      'Girls Basketball'
    );
    expect(formatProgramLabel({ id: '2', sport: 'basketball', gender: 'coed' })).toBe('Basketball');
    expect(formatProgramLabel({ id: '3', sport: 'track_field', gender: 'boys' })).toBe(
      'Boys Track & Field'
    );
    expect(
      formatProgramLabel({ id: '4', sport: 'basketball', gender: 'girls', name: 'Lady Knights' })
    ).toBe('Lady Knights');
    expect(formatProgramLabel({ id: '5', sport: 'unknown_slug', gender: 'coed' })).toBe(
      'unknown_slug'
    );
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
