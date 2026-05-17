/**
 * Coach access state machine — contract tests.
 *
 * `getCoachAccessState` is the single source of truth for what the client
 * considers a valid "coach" and whether they can access coach tools.
 * ~10 fields combine via 4 different conditionals into 7 boolean outputs.
 * Every client screen that gates on coach access reads this state, so
 * regressions silently break multiple flows.
 *
 * These tests pin each state transition by behavior. If someone changes
 * the conditional logic (say, accidentally makes `isProceedingAsFan`
 * override `isApprovedCoach` when it should be the other way), the
 * relevant case below fails.
 */
import { describe, expect, it } from '@jest/globals';
import {
  getCoachAccessState,
  getCoachRecoveryRoute,
  getPendingCoachRoute,
  isOrganizationAdminMember,
  isOrganizationOwner,
} from '../utils/roleChecks';

describe('getCoachAccessState — identity', () => {
  it('null / undefined user produces a safe default (no access)', () => {
    for (const u of [null, undefined]) {
      const s = getCoachAccessState(u as any);
      expect(s.isCoach).toBe(false);
      expect(s.canAccessCoachTools).toBe(false);
      expect(s.role).toBeNull();
      expect(s.approvalStatus).toBeNull();
    }
  });

  it('fan user is not a coach', () => {
    const s = getCoachAccessState({
      approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true },
    });
    expect(s.isCoach).toBe(false);
    expect(s.canAccessCoachTools).toBe(false);
  });

  it('reads canonical top-level user.role before falling back to preferences.role', () => {
    const s = getCoachAccessState({
      role: 'fan',
      preferences: { role: 'coach' },
    });
    expect(s.isCoach).toBe(false);
    expect(s.role).toBe('fan');
  });
});

describe('getCoachAccessState — approval states', () => {
  const base = {
    preferences: {
      role: 'coach',
      coach_agreement_accepted_at: new Date().toISOString(),
      coach_agreement_version: 1,
      onboarding_completed: true,
    },
    required_coach_agreement_version: 1,
  };

  it('PENDING coach is isPending, not approved, no tool access', () => {
    const s = getCoachAccessState({ ...base, approval_status: 'PENDING' });
    expect(s.isPendingCoach).toBe(true);
    expect(s.isApprovedCoach).toBe(false);
    expect(s.canAccessCoachTools).toBe(false);
  });

  it('REJECTED coach is isRejected, no tool access', () => {
    const s = getCoachAccessState({ ...base, approval_status: 'REJECTED' });
    expect(s.isRejectedCoach).toBe(true);
    expect(s.canAccessCoachTools).toBe(false);
  });

  it('APPROVED coach with current agreement can access coach tools', () => {
    const s = getCoachAccessState({ ...base, approval_status: 'APPROVED' });
    expect(s.isApprovedCoach).toBe(true);
    expect(s.canAccessCoachTools).toBe(true);
  });
});

describe('getCoachAccessState — coach agreement versioning (DISC-2)', () => {
  const approvedCoach = (version: number, required: number, accepted: string | null) => ({
    approval_status: 'APPROVED',
    required_coach_agreement_version: required,
    preferences: {
      role: 'coach',
      coach_agreement_accepted_at: accepted,
      coach_agreement_version: version,
      onboarding_completed: true,
    },
  });

  it('approved coach with no agreement accepted still has tool access once approved', () => {
    const s = getCoachAccessState(approvedCoach(0, 1, null));
    expect(s.hasAcceptedCoachAgreement).toBe(false);
    expect(s.hasCurrentCoachAgreement).toBe(false);
    expect(s.canAccessCoachTools).toBe(true);
  });

  it('approved coach with outdated version still has tool access once approved', () => {
    const s = getCoachAccessState(approvedCoach(1, 2, new Date().toISOString()));
    expect(s.hasAcceptedCoachAgreement).toBe(true);
    expect(s.hasCurrentCoachAgreement).toBe(false);
    expect(s.canAccessCoachTools).toBe(true);
  });

  it('approved coach with current version → current, tools accessible', () => {
    const s = getCoachAccessState(approvedCoach(2, 2, new Date().toISOString()));
    expect(s.hasCurrentCoachAgreement).toBe(true);
    expect(s.canAccessCoachTools).toBe(true);
  });

  it('approved coach with version ahead of required → still valid (forward-compat)', () => {
    // If client has a newer version than the server advertises (unusual but
    // possible mid-deploy), we don't block them.
    const s = getCoachAccessState(approvedCoach(5, 2, new Date().toISOString()));
    expect(s.hasCurrentCoachAgreement).toBe(true);
  });
});

describe('getCoachAccessState — paid-tier checkout gate', () => {
  const approvedPaidCoach = (prefs: Record<string, unknown>) => ({
    approval_status: 'APPROVED',
    paid_by_owner: false,
    required_coach_agreement_version: 1,
    preferences: {
      role: 'coach',
      coach_agreement_accepted_at: new Date().toISOString(),
      coach_agreement_version: 1,
      onboarding_completed: true,
      ...prefs,
    },
  });

  it('needsPaidPlanCheckout true for Veteran with payment_pending', () => {
    const s = getCoachAccessState(
      approvedPaidCoach({ pending_plan: 'veteran', payment_pending: true, payment_approved: true })
    );
    expect(s.needsPaidPlanCheckout).toBe(true);
  });

  it('needsPaidPlanCheckout false when paid_by_owner=true', () => {
    const s = getCoachAccessState({
      ...approvedPaidCoach({ pending_plan: 'veteran', payment_pending: true, payment_approved: true }),
      paid_by_owner: true,
    });
    expect(s.needsPaidPlanCheckout).toBe(false);
  });

  it('needsPaidPlanCheckout false for rookie plan', () => {
    const s = getCoachAccessState(
      approvedPaidCoach({ pending_plan: 'rookie', payment_pending: true, payment_approved: true })
    );
    expect(s.needsPaidPlanCheckout).toBe(false);
  });

  it('needsPaidPlanCheckout false when payment already not pending', () => {
    const s = getCoachAccessState(
      approvedPaidCoach({ pending_plan: 'veteran', payment_pending: false })
    );
    expect(s.needsPaidPlanCheckout).toBe(false);
  });

  it('needsPaidPlanCheckout false when join request still pending AND payment not approved', () => {
    const s = getCoachAccessState(
      approvedPaidCoach({
        pending_plan: 'veteran',
        payment_pending: true,
        payment_approved: false,
        join_request_pending: true,
      })
    );
    expect(s.needsPaidPlanCheckout).toBe(false);
  });
});

describe('getCoachAccessState — isProceedingAsFan', () => {
  it('isProceedingAsFan true when flag set and approval not APPROVED', () => {
    const s = getCoachAccessState({
      approval_status: 'PENDING',
      preferences: { role: 'coach', proceeding_as_fan: true },
    });
    expect(s.isProceedingAsFan).toBe(true);
  });

  it('isProceedingAsFan false once approved (flag is overridden by approval)', () => {
    const s = getCoachAccessState({
      approval_status: 'APPROVED',
      preferences: { role: 'coach', proceeding_as_fan: true },
    });
    expect(s.isProceedingAsFan).toBe(false);
  });
});

describe('getPendingCoachRoute', () => {
  it('returns org-pending route when join_request_pending', () => {
    expect(
      getPendingCoachRoute({
        preferences: { join_request_pending: true },
      })
    ).toBe('/onboarding/pending-approval');
  });

  it('returns league-pending route when organization_id set but no join request', () => {
    expect(
      getPendingCoachRoute({
        preferences: { organization_id: 'org_123' },
      })
    ).toBe('/onboarding/league-pending-approval');
  });

  it('defaults to /onboarding/pending-approval for missing preferences', () => {
    expect(getPendingCoachRoute({} as any)).toBe('/onboarding/pending-approval');
    expect(getPendingCoachRoute(null)).toBe('/onboarding/pending-approval');
  });
});

describe('organization membership helpers', () => {
  const baseUser = { id: 'user-1', approval_status: 'PENDING', preferences: { role: 'coach' } };

  it('isOrganizationOwner only returns true for active owner membership', () => {
    expect(
      isOrganizationOwner(baseUser as any, [
        { user_id: 'user-1', role: 'owner', status: 'active' },
      ])
    ).toBe(true);

    expect(
      isOrganizationOwner(baseUser as any, [
        { user_id: 'user-1', role: 'manager', status: 'active' },
      ])
    ).toBe(false);

    expect(
      isOrganizationOwner(baseUser as any, [
        { user_id: 'user-1', role: 'owner', status: 'inactive' },
      ])
    ).toBe(false);
  });

  it('isOrganizationAdminMember returns true for active owner or manager membership', () => {
    expect(
      isOrganizationAdminMember(baseUser as any, [
        { user_id: 'user-1', role: 'owner', status: 'active' },
      ])
    ).toBe(true);

    expect(
      isOrganizationAdminMember(baseUser as any, [
        { user_id: 'user-1', role: 'manager', status: 'active' },
      ])
    ).toBe(true);

    expect(
      isOrganizationAdminMember(baseUser as any, [
        { user_id: 'user-1', role: 'member', status: 'active' },
      ])
    ).toBe(false);
  });
});

describe('getCoachRecoveryRoute', () => {
  it('does not trap admins in coach recovery routes', () => {
    expect(
      getCoachRecoveryRoute({
        is_admin: true,
        approval_status: 'REJECTED',
        account_state: 'coach_application_rejected',
        next_step: '/onboarding/league-pending-approval',
        preferences: { role: 'coach', onboarding_completed: true },
      })
    ).toBeNull();
  });

  it('uses server next_step for rejected application recovery', () => {
    expect(
      getCoachRecoveryRoute({
        account_state: 'coach_application_rejected',
        next_step: '/onboarding/league-pending-approval',
        preferences: { role: 'coach' },
      })
    ).toBe('/onboarding/league-pending-approval');
  });

  it('routes application-required coaches back to the application flow', () => {
    expect(
      getCoachRecoveryRoute({
        account_state: 'coach_application_required',
        preferences: { role: 'coach' },
      })
    ).toBe('/onboarding/coach-application');
  });

  it('routes pending or rejected coaches to their waiting screen', () => {
    expect(
      getCoachRecoveryRoute({
        approval_status: 'PENDING',
        preferences: { role: 'coach', organization_id: 'org_123' },
      })
    ).toBe('/onboarding/league-pending-approval');

    expect(
      getCoachRecoveryRoute({
        approval_status: 'REJECTED',
        preferences: { role: 'coach', join_request_pending: true },
      })
    ).toBe('/onboarding/pending-approval');
  });

  it('returns tabs when a pending or rejected coach is already proceeding as fan', () => {
    expect(
      getCoachRecoveryRoute({
        approval_status: 'PENDING',
        preferences: { role: 'coach', proceeding_as_fan: true },
      })
    ).toBe('/(tabs)');
  });

  it('does not force approved coaches into recovery routes for agreement state', () => {
    expect(
      getCoachRecoveryRoute({
        approval_status: 'APPROVED',
        preferences: { role: 'coach', onboarding_completed: true },
      })
    ).toBeNull();
  });

  it('routes approved coaches with pending paid checkout to manage subscription', () => {
    expect(
      getCoachRecoveryRoute({
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          pending_plan: 'legend',
          payment_pending: true,
          payment_approved: true,
        },
      })
    ).toBe('/settings/manage-subscription');
  });
});
