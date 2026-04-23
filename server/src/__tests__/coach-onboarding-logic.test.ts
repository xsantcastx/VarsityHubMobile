import { describe, expect, it } from '@jest/globals';
import {
  DOB_GRACE_WINDOW_MS,
  evaluateDobUpdate,
  formatDobYmd,
  getCanonicalDob,
  getUserAge,
  isChild,
  isMinor,
  isVerifiedAdult,
  parseDobLocal,
  requiresParentalConsent,
} from '../lib/userAge.js';
import {
  buildAuthStateColumns,
  getCanonicalAuthState,
  getCanonicalOrganizationId,
  getCanonicalUserRole,
  getCoachAgreementAcceptedAt,
  getCoachAgreementVersion,
  isProceedingAsFan,
  isUserOnboardingComplete,
  mergeAuthStateIntoPreferences,
} from '../lib/userAuthState.js';

/**
 * Coach onboarding + coach-tool logic — universal regression suite.
 *
 * These tests pin every branch of the canonical helpers that guard the coach
 * flow. When a server route calls `getCanonicalUserRole(user)` or
 * `isUserOnboardingComplete(user)`, it MUST get the answer encoded here —
 * otherwise a coach can get stuck mid-flow (requireOnboarded 403), or a fan
 * can slip past a coach-only gate.
 *
 * Every branch of `evaluateDobUpdate` is also covered. A regression there
 * is how we ended up with the step-2 "DOB_LOCKED" trap that cost a whole
 * session of device testing to diagnose.
 */

const NOW = new Date('2026-04-23T17:00:00Z');
const TODAY_MS = NOW.getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

describe('coach onboarding logic — universal suite', () => {
  // ──────────────────────────────────────────────────────────────────────
  // DOB parsing + formatting — timezone invariants
  // ──────────────────────────────────────────────────────────────────────

  describe('parseDobLocal / formatDobYmd — timezone-safe DOB round-trip', () => {
    it('parses YYYY-MM-DD as UTC midnight', () => {
      const d = parseDobLocal('2000-01-23');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2000);
      expect(d!.getUTCMonth()).toBe(0);
      expect(d!.getUTCDate()).toBe(23);
    });

    it('round-trips YYYY-MM-DD through parseDobLocal + formatDobYmd', () => {
      for (const ymd of ['2000-01-23', '1999-12-31', '2013-04-23', '2008-06-15']) {
        const parsed = parseDobLocal(ymd);
        expect(formatDobYmd(parsed)).toBe(ymd);
      }
    });

    it('rejects invalid strings', () => {
      expect(parseDobLocal('')).toBeNull();
      expect(parseDobLocal('not-a-date')).toBeNull();
      expect(parseDobLocal(null as any)).toBeNull();
    });

    it('formatDobYmd returns null for null/invalid dates', () => {
      expect(formatDobYmd(null)).toBeNull();
      expect(formatDobYmd(new Date('invalid'))).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Age gates — every flow branches on these
  // ──────────────────────────────────────────────────────────────────────

  describe('age gates (isChild / isMinor / isVerifiedAdult / requiresParentalConsent)', () => {
    const makeUser = (ymd: string) => ({ date_of_birth: parseDobLocal(ymd) });

    it('under-13 (COPPA) — must be blocked from registration', () => {
      const kid = makeUser('2015-04-23'); // exactly 11 years old
      expect(isChild(kid, NOW)).toBe(true);
      expect(isMinor(kid, NOW)).toBe(true);
      expect(isVerifiedAdult(kid, NOW)).toBe(false);
      expect(requiresParentalConsent(kid, NOW)).toBe(false);
    });

    it('exactly 13 — not a child but still a minor (requires parental consent)', () => {
      const teen = makeUser('2013-04-23');
      expect(isChild(teen, NOW)).toBe(false);
      expect(isMinor(teen, NOW)).toBe(true);
      expect(requiresParentalConsent(teen, NOW)).toBe(true);
      expect(isVerifiedAdult(teen, NOW)).toBe(false);
    });

    it('17 years old — still a minor, cannot become coach', () => {
      const almostAdult = makeUser('2008-06-01');
      expect(isMinor(almostAdult, NOW)).toBe(true);
      expect(requiresParentalConsent(almostAdult, NOW)).toBe(true);
      expect(isVerifiedAdult(almostAdult, NOW)).toBe(false);
    });

    it('exactly 18 — verified adult, can become coach', () => {
      const newAdult = makeUser('2008-04-23');
      expect(isMinor(newAdult, NOW)).toBe(false);
      expect(requiresParentalConsent(newAdult, NOW)).toBe(false);
      expect(isVerifiedAdult(newAdult, NOW)).toBe(true);
    });

    it('45 years old — verified adult', () => {
      const adult = makeUser('1981-04-23');
      expect(isVerifiedAdult(adult, NOW)).toBe(true);
      expect(isMinor(adult, NOW)).toBe(false);
    });

    it('unknown DOB FAILS CLOSED for isMinor (cannot assume adult)', () => {
      const noDob = { date_of_birth: null };
      expect(isMinor(noDob, NOW)).toBe(true);
      expect(isVerifiedAdult(noDob, NOW)).toBe(false);
    });

    it('unknown DOB returns false for isChild (not treated as under-13 by default)', () => {
      expect(isChild({ date_of_birth: null }, NOW)).toBe(false);
    });

    it('handles day-before-birthday correctly (not yet 18)', () => {
      // Tomorrow is their 18th birthday — still 17 today.
      const dayBefore18 = new Date('2008-04-24T00:00:00Z');
      const user = { date_of_birth: dayBefore18 };
      expect(getUserAge(user, NOW)).toBe(17);
      expect(isVerifiedAdult(user, NOW)).toBe(false);
    });

    it('handles day-of-birthday correctly (exactly 18)', () => {
      const exactly18 = new Date('2008-04-23T00:00:00Z');
      const user = { date_of_birth: exactly18 };
      expect(getUserAge(user, NOW)).toBe(18);
      expect(isVerifiedAdult(user, NOW)).toBe(true);
    });

    it('reads from legacy preferences.dob when column is null', () => {
      const legacy = {
        date_of_birth: null,
        preferences: { dob: '1990-01-01' },
      };
      expect(getUserAge(legacy, NOW)).toBe(36);
      expect(isVerifiedAdult(legacy, NOW)).toBe(true);
    });

    it('column wins when both column and prefs present', () => {
      const both = {
        date_of_birth: parseDobLocal('2015-01-01'), // child — column says 11
        preferences: { dob: '1990-01-01' }, // prefs says adult
      };
      expect(isChild(both, NOW)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // DOB mutability — the evaluateDobUpdate state machine
  // ──────────────────────────────────────────────────────────────────────

  describe('evaluateDobUpdate — every branch', () => {
    it('first set (currentDob null) → always allowed, records newSetAt', () => {
      const result = evaluateDobUpdate({
        currentDob: null,
        currentSetAt: null,
        incomingDob: '2000-01-23',
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(true);
        expect(result.newSetAt).toEqual(NOW);
        expect(formatDobYmd(result.newDob)).toBe('2000-01-23');
      }
    });

    it('no-op when value unchanged → allowed, no setAt touch', () => {
      const current = parseDobLocal('2000-01-23')!;
      const setAt = new Date(TODAY_MS - 10 * DAY_MS);
      const result = evaluateDobUpdate({
        currentDob: current,
        currentSetAt: setAt,
        incomingDob: '2000-01-23',
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(false);
        expect(result.newSetAt).toBeNull();
      }
    });

    it('within 24h grace window → allowed with change, setAt preserved', () => {
      const current = parseDobLocal('2000-01-23')!;
      const setAt = new Date(TODAY_MS - (DOB_GRACE_WINDOW_MS - 1000)); // just under 24h ago
      const result = evaluateDobUpdate({
        currentDob: current,
        currentSetAt: setAt,
        incomingDob: '2000-01-24',
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(true);
        expect(result.newSetAt).toBeNull(); // preserve original setAt
      }
    });

    it('past 24h grace window → locked (dob_locked)', () => {
      const current = parseDobLocal('2000-01-23')!;
      const setAt = new Date(TODAY_MS - (DOB_GRACE_WINDOW_MS + 1000)); // over 24h ago
      const result = evaluateDobUpdate({
        currentDob: current,
        currentSetAt: setAt,
        incomingDob: '2000-01-24',
        now: NOW,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('dob_locked');
      }
    });

    it('LOCKED user submitting SAME value → still allowed (no-op path)', () => {
      // Critical: a returning user whose DOB was set long ago can re-submit the
      // identical value during onboarding. This is the path step-2 relies on
      // after we removed the lock UI.
      const current = parseDobLocal('2000-01-23')!;
      const setAt = new Date(TODAY_MS - 10 * DAY_MS); // way past grace
      const result = evaluateDobUpdate({
        currentDob: current,
        currentSetAt: setAt,
        incomingDob: '2000-01-23',
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(false);
      }
    });

    it('invalid incoming DOB → rejected (invalid_dob)', () => {
      const result = evaluateDobUpdate({
        currentDob: null,
        currentSetAt: null,
        incomingDob: 'not-a-date',
        now: NOW,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid_dob');
      }
    });

    it('exactly at grace window boundary (24h elapsed) → still allowed', () => {
      const current = parseDobLocal('2000-01-23')!;
      const setAt = new Date(TODAY_MS - DOB_GRACE_WINDOW_MS);
      const result = evaluateDobUpdate({
        currentDob: current,
        currentSetAt: setAt,
        incomingDob: '2000-01-24',
        now: NOW,
      });
      expect(result.ok).toBe(true);
    });

    it('currentSetAt null but currentDob set → treated as first set', () => {
      // Legacy accounts where the timestamp was never recorded must remain
      // editable (they're effectively "unset" from the grace-window POV).
      const current = parseDobLocal('2000-01-23')!;
      const result = evaluateDobUpdate({
        currentDob: current,
        currentSetAt: null,
        incomingDob: '2000-01-24',
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(true);
        expect(result.newSetAt).toEqual(NOW);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Canonical role resolution — the bug that broke coach step-3
  // ──────────────────────────────────────────────────────────────────────

  describe('getCanonicalUserRole — column wins over preferences', () => {
    it('reads "coach" from the column', () => {
      expect(getCanonicalUserRole({ role: 'coach' })).toBe('coach');
    });

    it('reads "fan" from the column', () => {
      expect(getCanonicalUserRole({ role: 'fan' })).toBe('fan');
    });

    it('falls back to preferences.role when column is null', () => {
      expect(getCanonicalUserRole({ role: null, preferences: { role: 'coach' } })).toBe('coach');
    });

    it('column takes precedence when column and prefs disagree', () => {
      // This is exactly the scenario that was breaking step-3 org creation:
      // column said coach, prefs said fan. Coach was trapped.
      expect(
        getCanonicalUserRole({
          role: 'coach',
          preferences: { role: 'fan' },
        })
      ).toBe('coach');
    });

    it('normalizes coach-adjacent roles to "coach"', () => {
      expect(getCanonicalUserRole({ role: 'team_manager' })).toBe('coach');
      expect(getCanonicalUserRole({ role: 'owner' })).toBe('coach');
      expect(getCanonicalUserRole({ role: 'staff' })).toBe('coach');
      expect(getCanonicalUserRole({ role: 'director' })).toBe('coach');
      expect(getCanonicalUserRole({ role: 'admin' })).toBe('coach');
    });

    it('defaults to "fan" when role is undefined anywhere', () => {
      expect(getCanonicalUserRole({})).toBe('fan');
      expect(getCanonicalUserRole(null)).toBe('fan');
      expect(getCanonicalUserRole({ preferences: {} })).toBe('fan');
    });

    it('handles case variations in the role string', () => {
      expect(getCanonicalUserRole({ role: 'COACH' })).toBe('coach');
      expect(getCanonicalUserRole({ role: ' Coach ' })).toBe('coach');
    });
  });

  describe('isUserOnboardingComplete — column wins over preferences', () => {
    it('true when column says true', () => {
      expect(isUserOnboardingComplete({ onboarding_completed: true })).toBe(true);
    });

    it('false when column says false', () => {
      expect(isUserOnboardingComplete({ onboarding_completed: false })).toBe(false);
    });

    it('falls back to preferences when column is null', () => {
      expect(
        isUserOnboardingComplete({
          onboarding_completed: null,
          preferences: { onboarding_completed: true },
        })
      ).toBe(true);
    });

    it('column false overrides prefs true (cannot bypass server truth)', () => {
      expect(
        isUserOnboardingComplete({
          onboarding_completed: false,
          preferences: { onboarding_completed: true },
        })
      ).toBe(false);
    });

    it('false when both missing', () => {
      expect(isUserOnboardingComplete({})).toBe(false);
      expect(isUserOnboardingComplete(null)).toBe(false);
    });

    it('defensively treats non-boolean prefs value as incomplete', () => {
      expect(
        isUserOnboardingComplete({ onboarding_completed: null, preferences: { onboarding_completed: 'yes' } })
      ).toBe(false);
    });
  });

  describe('getCanonicalOrganizationId — column wins', () => {
    it('returns column value', () => {
      expect(getCanonicalOrganizationId({ organization_id: 'org_123' })).toBe('org_123');
    });

    it('falls back to prefs when column is empty', () => {
      expect(
        getCanonicalOrganizationId({ organization_id: null, preferences: { organization_id: 'org_xyz' } })
      ).toBe('org_xyz');
    });

    it('returns null when neither is set', () => {
      expect(getCanonicalOrganizationId({})).toBeNull();
      expect(getCanonicalOrganizationId(null)).toBeNull();
    });
  });

  describe('coach agreement helpers', () => {
    it('reads accepted_at from column first', () => {
      const d = new Date('2026-04-01T00:00:00Z');
      expect(getCoachAgreementAcceptedAt({ coach_agreement_accepted_at: d })).toBe(d);
    });

    it('falls back to prefs.coach_agreement_accepted_at', () => {
      const got = getCoachAgreementAcceptedAt({
        coach_agreement_accepted_at: null,
        preferences: { coach_agreement_accepted_at: '2026-04-01T00:00:00Z' },
      });
      expect(got).toBe('2026-04-01T00:00:00Z');
    });

    it('returns null when unsigned', () => {
      expect(getCoachAgreementAcceptedAt({})).toBeNull();
    });

    it('reads version from column', () => {
      expect(getCoachAgreementVersion({ coach_agreement_version: 3 })).toBe(3);
    });

    it('falls back to prefs.coach_agreement_version', () => {
      expect(
        getCoachAgreementVersion({
          coach_agreement_version: null,
          preferences: { coach_agreement_version: 2 },
        })
      ).toBe(2);
    });
  });

  describe('isProceedingAsFan — "continue as fan" escape hatch', () => {
    it('true when column true', () => {
      expect(isProceedingAsFan({ proceeding_as_fan: true })).toBe(true);
    });

    it('false when column false (even if prefs true)', () => {
      expect(isProceedingAsFan({ proceeding_as_fan: false, preferences: { proceeding_as_fan: true } })).toBe(false);
    });

    it('falls back to prefs when column null', () => {
      expect(isProceedingAsFan({ proceeding_as_fan: null, preferences: { proceeding_as_fan: true } })).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Lockstep writes — columns + preferences must be updated together
  // ──────────────────────────────────────────────────────────────────────

  describe('buildAuthStateColumns + mergeAuthStateIntoPreferences — lockstep writers', () => {
    it('building role="coach" + onboarding_completed=true produces BOTH column and prefs updates', () => {
      const patch = { role: 'coach' as const, onboarding_completed: true, organization_id: 'org_1' };
      const columns = buildAuthStateColumns(patch);
      const prefs = mergeAuthStateIntoPreferences({}, patch);

      expect(columns.role).toBe('coach');
      expect(columns.onboarding_completed).toBe(true);
      expect(columns.organization_id).toBe('org_1');

      expect(prefs.role).toBe('coach');
      expect(prefs.onboarding_completed).toBe(true);
      expect(prefs.organization_id).toBe('org_1');
    });

    it('null organization_id in patch clears prefs and writes null column', () => {
      const patch = { organization_id: null };
      const columns = buildAuthStateColumns(patch);
      const prefs = mergeAuthStateIntoPreferences({ organization_id: 'old' }, patch);
      expect(columns.organization_id).toBeNull();
      expect(prefs.organization_id).toBeUndefined();
    });

    it('does not carry over preferences keys outside the auth-state domain', () => {
      const prefs = mergeAuthStateIntoPreferences(
        { role: 'fan', affiliation: 'high_school', zip_code: '06907' },
        { role: 'coach' }
      );
      expect(prefs.role).toBe('coach');
      // Unrelated prefs keys preserved
      expect(prefs.affiliation).toBe('high_school');
      expect(prefs.zip_code).toBe('06907');
    });

    it('undefined in patch means "leave alone" (no-op key)', () => {
      const prefs = mergeAuthStateIntoPreferences({ role: 'coach' }, {});
      expect(prefs.role).toBe('coach');
    });

    it('coach_agreement_accepted_at serializes Date → ISO string for prefs', () => {
      const d = new Date('2026-04-23T17:00:00Z');
      const prefs = mergeAuthStateIntoPreferences({}, { coach_agreement_accepted_at: d });
      expect(prefs.coach_agreement_accepted_at).toBe(d.toISOString());
    });

    it('coach_agreement_accepted_at null clears prefs key and writes null column', () => {
      const columns = buildAuthStateColumns({ coach_agreement_accepted_at: null });
      const prefs = mergeAuthStateIntoPreferences(
        { coach_agreement_accepted_at: '2026-01-01T00:00:00Z' },
        { coach_agreement_accepted_at: null }
      );
      expect(columns.coach_agreement_accepted_at).toBeNull();
      expect(prefs.coach_agreement_accepted_at).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // End-to-end snapshot — getCanonicalAuthState pulls it all together
  // ──────────────────────────────────────────────────────────────────────

  describe('getCanonicalAuthState — composed canonical snapshot', () => {
    it('returns the authoritative canonical state for an approved coach', () => {
      const user = {
        role: 'coach' as const,
        onboarding_completed: true,
        organization_id: 'org_123',
        proceeding_as_fan: false,
        coach_agreement_accepted_at: new Date('2026-04-01T00:00:00Z'),
        coach_agreement_version: 3,
      };
      const state = getCanonicalAuthState(user);
      expect(state).toEqual({
        role: 'coach',
        onboarding_completed: true,
        organization_id: 'org_123',
        proceeding_as_fan: false,
        coach_agreement_accepted_at: new Date('2026-04-01T00:00:00Z'),
        coach_agreement_version: 3,
      });
    });

    it('handles split brain (column vs prefs disagree) — column always wins', () => {
      const user = {
        role: 'coach' as const,
        onboarding_completed: false,
        preferences: {
          role: 'fan',
          onboarding_completed: true,
          organization_id: 'org_from_prefs',
        },
      };
      const state = getCanonicalAuthState(user);
      expect(state.role).toBe('coach'); // column wins
      expect(state.onboarding_completed).toBe(false); // column wins
      expect(state.organization_id).toBe('org_from_prefs'); // column null → prefs fallback
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Helper — getCanonicalDob
  // ──────────────────────────────────────────────────────────────────────

  describe('getCanonicalDob — unified DOB access', () => {
    it('prefers the column Date', () => {
      const d = new Date('2000-01-23T00:00:00Z');
      expect(getCanonicalDob({ date_of_birth: d })).toBe(d);
    });

    it('parses a string column value', () => {
      const parsed = getCanonicalDob({ date_of_birth: '2000-01-23' });
      expect(formatDobYmd(parsed)).toBe('2000-01-23');
    });

    it('falls back to preferences.dob when column is null', () => {
      const parsed = getCanonicalDob({ date_of_birth: null, preferences: { dob: '1990-06-15' } });
      expect(formatDobYmd(parsed)).toBe('1990-06-15');
    });

    it('returns null when no DOB is available', () => {
      expect(getCanonicalDob({})).toBeNull();
      expect(getCanonicalDob(null)).toBeNull();
    });
  });
});
