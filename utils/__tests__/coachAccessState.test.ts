import { describe, expect, it } from '@jest/globals';

import { getCoachAccessState } from '@/utils/roleChecks';

describe('getCoachAccessState', () => {
  const baseCoach = {
    role: 'coach',
    approval_status: 'APPROVED',
    onboarding_completed: true,
    organization_id: 'org_123',
    required_coach_agreement_version: 2,
    preferences: {
      role: 'coach',
      onboarding_completed: true,
      organization_id: 'org_123',
      coach_agreement_accepted_at: '2026-05-30T00:00:00.000Z',
      coach_agreement_version: 2,
      plan: 'rookie',
      payment_pending: false,
      payment_approved: false,
    },
  } as const;

  it('allows coach tools only for coach_active-ready accounts', () => {
    const state = getCoachAccessState({
      ...baseCoach,
      account_state: 'coach_active',
      next_step: '/(tabs)',
    });

    expect(state.isApprovedCoach).toBe(true);
    expect(state.hasCurrentCoachAgreement).toBe(true);
    expect(state.canAccessCoachTools).toBe(true);
  });

  it.each([
    'coach_agreement_required',
    'coach_final_setup_required',
    'coach_application_submitted',
    'coach_pending_approval',
  ])('blocks coach tools for staged server state %s', account_state => {
    const state = getCoachAccessState({
      ...baseCoach,
      account_state,
      next_step: '/onboarding/coach-agreement',
    });

    expect(state.isApprovedCoach).toBe(true);
    expect(state.canAccessCoachTools).toBe(false);
  });

  it('blocks coach tools when the agreement version is stale even without account_state', () => {
    const state = getCoachAccessState({
      ...baseCoach,
      account_state: null,
      preferences: {
        ...baseCoach.preferences,
        coach_agreement_version: 1,
      },
    });

    expect(state.hasCurrentCoachAgreement).toBe(false);
    expect(state.canAccessCoachTools).toBe(false);
  });

  it('blocks coach tools when organization setup is still missing', () => {
    const state = getCoachAccessState({
      ...baseCoach,
      account_state: null,
      organization_id: null,
      preferences: {
        ...baseCoach.preferences,
        organization_id: null,
      },
    });

    expect(state.canAccessCoachTools).toBe(false);
  });
});
