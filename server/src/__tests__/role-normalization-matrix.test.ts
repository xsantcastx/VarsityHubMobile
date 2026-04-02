/**
 * Role Normalization Matrix Test
 *
 * Pure-function tests against utils/userRole.ts and utils/roles.ts.
 * No DB, no network, no React — just string logic.
 */

// These are frontend utils but they're pure TS with zero RN dependencies,
// so we can import them directly in the server test runner.
import { normalizeUserRole, isCoachRole } from '../../../utils/userRole.js';
// roles.ts was removed — strict-equality helpers had zero production usage
// and diverged from normalizeUserRole (the canonical implementation).

// ---------------------------------------------------------------------------
// 1. normalizeUserRole — full matrix
// ---------------------------------------------------------------------------
describe('normalizeUserRole', () => {
  describe('explicit role strings', () => {
    const cases: [string | null | undefined, string | null, 'coach' | 'fan'][] = [
      // Direct matches
      ['coach', null, 'coach'],
      ['fan', null, 'fan'],
      ['supporter', null, 'fan'],

      // Coach keywords embedded in role string
      ['head coach', null, 'coach'],
      ['assistant coach', null, 'coach'],
      ['team manager', null, 'coach'],
      ['league organizer', null, 'coach'],
      ['team owner', null, 'coach'],
      ['athletic director', null, 'coach'],
      ['admin', null, 'coach'],
      ['staff member', null, 'coach'],
    ];

    it.each(cases)(
      'normalizeUserRole(%j, %j) → %s',
      (role, plan, expected) => {
        expect(normalizeUserRole(role, plan)).toBe(expected);
      },
    );
  });

  describe('plan-based inference (no explicit role)', () => {
    const cases: [string | null | undefined, string | null, 'coach' | 'fan'][] = [
      [null, 'veteran', 'coach'],
      [null, 'legend', 'coach'],
      [null, 'rookie', 'fan'],
      [null, null, 'fan'],
      [null, '', 'fan'],
      ['', 'veteran', 'coach'],
      ['', 'legend', 'coach'],
      ['', 'rookie', 'fan'],
      ['', '', 'fan'],
    ];

    it.each(cases)(
      'normalizeUserRole(%j, %j) → %s (inferred from plan)',
      (role, plan, expected) => {
        expect(normalizeUserRole(role, plan)).toBe(expected);
      },
    );
  });

  describe('explicit role takes precedence over plan', () => {
    // A fan with a legend plan is still a fan (explicit role wins)
    it('fan + legend plan → fan', () => {
      expect(normalizeUserRole('fan', 'legend')).toBe('fan');
    });

    it('supporter + veteran plan → fan', () => {
      expect(normalizeUserRole('supporter', 'veteran')).toBe('fan');
    });

    // A coach with rookie plan is still a coach
    it('coach + rookie plan → coach', () => {
      expect(normalizeUserRole('coach', 'rookie')).toBe('coach');
    });
  });

  describe('whitespace and casing', () => {
    const cases: [string, string | null, 'coach' | 'fan'][] = [
      ['  Coach  ', null, 'coach'],
      ['  FAN  ', null, 'fan'],
      ['COACH', null, 'coach'],
      ['Fan', null, 'fan'],
      ['  head coach  ', null, 'coach'],
      ['SUPPORTER', null, 'fan'],
    ];

    it.each(cases)(
      'normalizeUserRole(%j, %j) → %s (trimmed + lowered)',
      (role, plan, expected) => {
        expect(normalizeUserRole(role, plan)).toBe(expected);
      },
    );
  });

  describe('unknown role strings fallback', () => {
    const cases: [string, string | null, 'coach' | 'fan'][] = [
      // No coach keyword, no coach plan → fan
      ['player', null, 'fan'],
      ['parent', null, 'fan'],
      ['member', null, 'fan'],
      ['athlete', null, 'fan'],
      ['referee', null, 'fan'],
      ['volunteer', null, 'fan'],
      ['unknown', null, 'fan'],
      ['', null, 'fan'],
      // But with a coach-tier plan, unknown roles → coach
      ['player', 'veteran', 'coach'],
      ['parent', 'legend', 'coach'],
      ['unknown', 'veteran', 'coach'],
    ];

    it.each(cases)(
      'normalizeUserRole(%j, %j) → %s',
      (role, plan, expected) => {
        expect(normalizeUserRole(role, plan)).toBe(expected);
      },
    );
  });
});

// ---------------------------------------------------------------------------
// 2. isCoachRole — wrapper consistency
// ---------------------------------------------------------------------------
describe('isCoachRole', () => {
  it('returns true when normalizeUserRole returns coach', () => {
    expect(isCoachRole('coach', null)).toBe(true);
    expect(isCoachRole(null, 'veteran')).toBe(true);
    expect(isCoachRole('head coach', null)).toBe(true);
  });

  it('returns false when normalizeUserRole returns fan', () => {
    expect(isCoachRole('fan', null)).toBe(false);
    expect(isCoachRole(null, null)).toBe(false);
    expect(isCoachRole('player', null)).toBe(false);
  });
});

