/**
 * Plan Limits Matrix Test
 *
 * Pure-function tests against planLimits.ts — no DB, no network, no side effects.
 * Validates every plan tier + alias + edge case returns the correct limits.
 */
import {
  resolvePlan,
  getMaxTeamsForPlan,
  getMaxRosterSizePerTeam,
  getAuthorizedUsersPerTeam,
  getAuthorizedUsersOrgLimit,
  planSupportsExtracurricular,
  getPlanDisplayName,
} from '../lib/planLimits.js';

// ---------------------------------------------------------------------------
// 1. Plan resolution — aliases, nulls, garbage
// ---------------------------------------------------------------------------
describe('resolvePlan', () => {
  const cases: [string | null | undefined, string][] = [
    ['rookie', 'rookie'],
    ['veteran', 'veteran'],
    ['legend', 'legend'],
    // Aliases
    ['free', 'rookie'],
    ['premium', 'veteran'],
    ['pro', 'legend'],
    // Case insensitivity is NOT guaranteed (raw toLowerCase in toPlanId)
    // but the function does toLowerCase, so let's verify
    ['Rookie', 'rookie'],
    ['VETERAN', 'veteran'],
    ['LEGEND', 'legend'],
    ['Free', 'rookie'],
    ['Premium', 'veteran'],
    ['Pro', 'legend'],
    // Fallbacks
    [null, 'rookie'],
    [undefined, 'rookie'],
    ['', 'rookie'],
    ['garbage', 'rookie'],
    ['admin', 'rookie'],
    ['coach', 'rookie'],
  ];

  it.each(cases)('resolvePlan(%j) → %s', (input, expected) => {
    expect(resolvePlan(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 2. Max teams per plan
// ---------------------------------------------------------------------------
describe('getMaxTeamsForPlan', () => {
  const cases: [string | null | undefined, number | null][] = [
    ['rookie', 3],
    ['veteran', null],
    ['legend', null],
    ['free', 3],
    ['premium', null],
    ['pro', null],
    [null, 3],
    [undefined, 3],
    ['garbage', 3],
  ];

  it.each(cases)('getMaxTeamsForPlan(%j) → %j', (plan, expected) => {
    expect(getMaxTeamsForPlan(plan)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 3. Max roster size per team
// ---------------------------------------------------------------------------
describe('getMaxRosterSizePerTeam', () => {
  const cases: [string | null | undefined, number | null][] = [
    ['rookie', 50],
    ['veteran', 100],
    ['legend', null],
    ['free', 50],
    ['premium', 100],
    ['pro', null],
    [null, 50],
    [undefined, 50],
    ['garbage', 50],
  ];

  it.each(cases)('getMaxRosterSizePerTeam(%j) → %j', (plan, expected) => {
    expect(getMaxRosterSizePerTeam(plan)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 4. Authorized users per team
// ---------------------------------------------------------------------------
describe('getAuthorizedUsersPerTeam', () => {
  const cases: [string | null | undefined, number | null][] = [
    ['rookie', 6],
    ['veteran', 5],
    ['legend', null],
    [null, 6],
    ['garbage', 6],
  ];

  it.each(cases)('getAuthorizedUsersPerTeam(%j) → %j', (plan, expected) => {
    expect(getAuthorizedUsersPerTeam(plan)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 5. Authorized users org-wide limit (strategy-based)
// ---------------------------------------------------------------------------
describe('getAuthorizedUsersOrgLimit', () => {
  // Rookie: fixed strategy, value=6
  it.each([
    [0, 6],
    [1, 6],
    [5, 6],
    [100, 6],
  ])('rookie with %d teams → %d (fixed)', (teamCount, expected) => {
    expect(getAuthorizedUsersOrgLimit('rookie', teamCount)).toBe(expected);
  });

  // Veteran: per_team strategy, value=5
  it.each([
    [0, 0],
    [1, 5],
    [2, 10],
    [3, 15],
    [10, 50],
  ])('veteran with %d teams → %d (per_team)', (teamCount, expected) => {
    expect(getAuthorizedUsersOrgLimit('veteran', teamCount)).toBe(expected);
  });

  // Legend: unlimited strategy → null
  it.each([0, 1, 99])('legend with %d teams → null (unlimited)', (teamCount) => {
    expect(getAuthorizedUsersOrgLimit('legend', teamCount)).toBeNull();
  });

  // Edge: negative team count should floor to 0
  it('veteran with negative team count floors to 0', () => {
    expect(getAuthorizedUsersOrgLimit('veteran', -3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Extracurricular support
// ---------------------------------------------------------------------------
describe('planSupportsExtracurricular', () => {
  const cases: [string | null | undefined, boolean][] = [
    ['rookie', false],
    ['veteran', false],
    ['legend', true],
    ['free', false],
    ['premium', false],
    ['pro', true],
    [null, false],
    [undefined, false],
    ['garbage', false],
  ];

  it.each(cases)('planSupportsExtracurricular(%j) → %j', (plan, expected) => {
    expect(planSupportsExtracurricular(plan)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 7. Display names
// ---------------------------------------------------------------------------
describe('getPlanDisplayName', () => {
  const cases: [string | null | undefined, string][] = [
    ['rookie', 'Rookie'],
    ['veteran', 'Veteran'],
    ['legend', 'Legend'],
    ['free', 'Rookie'],
    [null, 'Rookie'],
  ];

  it.each(cases)('getPlanDisplayName(%j) → %s', (plan, expected) => {
    expect(getPlanDisplayName(plan)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 8. Cross-tier consistency checks
// ---------------------------------------------------------------------------
describe('cross-tier invariants', () => {
  const tiers = ['rookie', 'veteran', 'legend'] as const;

  it('higher tiers never have LOWER limits than lower tiers', () => {
    for (let i = 0; i < tiers.length - 1; i++) {
      const lower = tiers[i];
      const higher = tiers[i + 1];

      const lowerTeams = getMaxTeamsForPlan(lower);
      const higherTeams = getMaxTeamsForPlan(higher);
      // null means unlimited, which is always >= any number
      if (lowerTeams !== null && higherTeams !== null) {
        expect(higherTeams).toBeGreaterThanOrEqual(lowerTeams);
      }

      const lowerRoster = getMaxRosterSizePerTeam(lower);
      const higherRoster = getMaxRosterSizePerTeam(higher);
      if (lowerRoster !== null && higherRoster !== null) {
        expect(higherRoster).toBeGreaterThanOrEqual(lowerRoster);
      }

      const lowerAuth = getAuthorizedUsersPerTeam(lower);
      const higherAuth = getAuthorizedUsersPerTeam(higher);
      if (lowerAuth !== null && higherAuth !== null) {
        expect(higherAuth).toBeGreaterThanOrEqual(lowerAuth);
      }
    }
  });

  it('only legend supports extracurricular', () => {
    expect(planSupportsExtracurricular('rookie')).toBe(false);
    expect(planSupportsExtracurricular('veteran')).toBe(false);
    expect(planSupportsExtracurricular('legend')).toBe(true);
  });
});
