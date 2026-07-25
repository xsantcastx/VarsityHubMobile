/**
 * The organization header counts SPORTS, not raw teams.
 *
 * An org's billable/display unit is the sport program: boys' and girls' varsity
 * basketball are sibling level teams inside ONE basketball program. The header
 * showed `teams.length`, so an org running one sport across three levels read
 * "3 Teams" — and relabeling that to "Sports" without changing the number would
 * have made it read "3 Sports", which is worse.
 *
 * Counting mirrors the server's `countBillableProgramsForContext`: distinct
 * programs, plus each ungrouped (null-program) team as its own unit, so the
 * number a coach sees agrees with what they are billed for.
 */

import { countOrgSports } from '@/utils/countOrgSports';

describe('countOrgSports', () => {
  it('counts one sport when several level teams share a program', () => {
    expect(countOrgSports([{ program_id: 'p1' }, { program_id: 'p1' }, { program_id: 'p1' }])).toBe(
      1
    );
  });

  it('counts distinct programs separately', () => {
    expect(countOrgSports([{ program_id: 'p1' }, { program_id: 'p2' }])).toBe(2);
  });

  it('counts each ungrouped team as its own sport (matches billing)', () => {
    expect(countOrgSports([{ program_id: null }, { program_id: null }])).toBe(2);
  });

  it('mixes grouped and ungrouped correctly', () => {
    expect(
      countOrgSports([
        { program_id: 'p1' },
        { program_id: 'p1' },
        { program_id: 'p2' },
        { program_id: null },
      ])
    ).toBe(3);
  });

  it('is zero for no teams', () => {
    expect(countOrgSports([])).toBe(0);
  });

  it('treats a missing program_id as ungrouped', () => {
    expect(countOrgSports([{} as { program_id: string | null }])).toBe(1);
  });
});
