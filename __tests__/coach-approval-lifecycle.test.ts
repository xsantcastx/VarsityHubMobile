import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { getNotificationHrefForUser } from '@/utils/notificationPresentation';
import {
  getCoachApprovalNotificationRoute,
  getCoachRecoveryRoute,
} from '@/utils/roleChecks';

describe('coach approval lifecycle', () => {
  const pendingFanModeUser = {
    email_verified: true,
    role: 'coach',
    approval_status: 'PENDING',
    account_state: 'coach_pending_approval',
    next_step: '/(tabs)',
    organization_id: 'org_123',
    proceeding_as_fan: true,
    preferences: {
      role: 'fan',
      onboarding_completed: true,
      organization_id: 'org_123',
      proceeding_as_fan: false,
    },
  };

  const approvedAwaitingAgreementUser = {
    ...pendingFanModeUser,
    approval_status: 'APPROVED',
    account_state: 'coach_active',
    role: 'coach',
    next_step: null,
    preferences: {
      ...pendingFanModeUser.preferences,
      role: 'coach',
      proceeding_as_fan: false,
    },
  };

  const approvedAcceptedAgreementUser = {
    ...approvedAwaitingAgreementUser,
    preferences: {
      ...approvedAwaitingAgreementUser.preferences,
      coach_agreement_accepted_at: '2026-01-01T00:00:00.000Z',
      coach_agreement_version: 1,
    },
  };

  it('keeps a pending coach who chose fan mode on tabs while waiting', () => {
    expect(getPostAuthRouteDecision(pendingFanModeUser as any).route).toBe('/(tabs)/feed');
    expect(getCoachRecoveryRoute(pendingFanModeUser as any)).toBe('/(tabs)/feed');
  });

  it('routes newly approved coaches into the app without reopening the pending screen', () => {
    expect(getPostAuthRouteDecision(approvedAwaitingAgreementUser as any).route).toBe('/(tabs)/feed');
    expect(getCoachRecoveryRoute(approvedAwaitingAgreementUser as any)).toBeNull();
  });

  it('keeps approval notifications on the agreement screen until acceptance exists', () => {
    expect(getCoachApprovalNotificationRoute(approvedAwaitingAgreementUser as any)).toBe(
      '/onboarding/coach-agreement'
    );
    expect(
      getNotificationHrefForUser({ type: 'ORG_APPROVED' }, approvedAwaitingAgreementUser as any)
    ).toBe('/onboarding/coach-agreement');
    expect(
      getNotificationHrefForUser(
        { type: 'JOIN_REQUEST_APPROVED', meta: { organization_id: 'org_123' } },
        approvedAwaitingAgreementUser as any
      )
    ).toBe('/onboarding/coach-agreement');
  });

  it('stops resurfacing coach-agreement after acceptance and lands on organization instead', () => {
    expect(getCoachApprovalNotificationRoute(approvedAcceptedAgreementUser as any)).toBe(
      '/organization'
    );
    expect(
      getNotificationHrefForUser({ type: 'ORG_APPROVED' }, approvedAcceptedAgreementUser as any)
    ).toBe('/organization');
    expect(
      getNotificationHrefForUser(
        { type: 'JOIN_REQUEST_APPROVED', meta: { organization_id: 'org_123' } },
        approvedAcceptedAgreementUser as any
      )
    ).toBe('/organization');
  });
});
