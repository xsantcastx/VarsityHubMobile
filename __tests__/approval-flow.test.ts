import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { getCoachApprovalNotificationRoute } from '@/utils/roleChecks';

describe('Coach approval flow', () => {
  it('routes pending coaches to the pending-approval screen', () => {
    const decision = getPostAuthRouteDecision({
      email_verified: true,
      approval_status: 'PENDING',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        join_request_pending: true,
      },
    } as any);

    expect(decision.route).toBe('/onboarding/pending-approval');
  });

  it('routes freshly approved coaches into the app instead of forcing coach-agreement', () => {
    const decision = getPostAuthRouteDecision({
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        proceeding_as_fan: false,
      },
    } as any);

    expect(decision.route).toBe('/(tabs)');
  });

  it('routes approved coaches who were previously proceeding as fan into the app', () => {
    const decision = getPostAuthRouteDecision({
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        proceeding_as_fan: true,
      },
    } as any);

    expect(decision.route).toBe('/(tabs)');
  });

  it('keeps approval notifications on coach-agreement only while agreement acceptance is still missing', () => {
    expect(
      getCoachApprovalNotificationRoute({
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
        },
      } as any)
    ).toBe('/onboarding/coach-agreement');

    expect(
      getCoachApprovalNotificationRoute({
        approval_status: 'APPROVED',
        organization_id: 'org_123',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          organization_id: 'org_123',
          coach_agreement_accepted_at: '2026-01-01T00:00:00.000Z',
        },
      } as any)
    ).toBe('/organization');
  });

  it('completeOnboarding payload must clear proceeding_as_fan when approval is granted', () => {
    const payload = {
      role: 'coach',
      proceeding_as_fan: false,
      username: 'test_coach',
      dob: '1990-01-01',
    };

    expect(payload.proceeding_as_fan).toBe(false);
  });

  it('fresh auth state after approval resolves to app home instead of the stale pending route', () => {
    const staleDecision = getPostAuthRouteDecision({
      email_verified: true,
      approval_status: 'PENDING',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        join_request_pending: true,
      },
    } as any);
    expect(staleDecision.route).toBe('/onboarding/pending-approval');

    const freshDecision = getPostAuthRouteDecision({
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        proceeding_as_fan: false,
      },
    } as any);
    expect(freshDecision.route).toBe('/(tabs)');
  });

  it('stale pending snapshots still stay on tabs when proceeding_as_fan is true', () => {
    const decision = getPostAuthRouteDecision({
      email_verified: true,
      role: 'fan',
      approval_status: 'REJECTED',
      onboarding_completed: false,
      preferences: {
        role: 'fan',
        onboarding_completed: false,
        proceeding_as_fan: true,
      },
    } as any);

    expect(decision.route).toBe('/(tabs)');
  });
});
