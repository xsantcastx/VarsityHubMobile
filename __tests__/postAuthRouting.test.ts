import { describe, expect, it } from '@jest/globals';
import { getPostAuthLandingRoute } from '../utils/postAuthRouting';

describe('getPostAuthLandingRoute', () => {
  it('routes approved coach with incomplete onboarding back to the pending completion screen', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: false,
          organization_id: 'org_123',
        },
      })
    ).toBe('/onboarding/league-pending-approval');
  });

  it('routes approved join-request coach with incomplete onboarding to join pending screen', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: false,
          join_request_pending: true,
          organization_id: 'org_123',
        },
      })
    ).toBe('/onboarding/pending-approval');
  });

  it('keeps generic incomplete users on onboarding step 1', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: false,
        },
      })
    ).toBe('/onboarding/step-1-role');
  });

  it('routes approved coaches without the agreement to coach-agreement after onboarding completes', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        approval_status: 'APPROVED',
        required_coach_agreement_version: 1,
        preferences: {
          role: 'coach',
          onboarding_completed: true,
        },
      })
    ).toBe('/onboarding/coach-agreement');
  });

  it('prefers canonical next_step for pending coach entry', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        approval_status: 'PENDING',
        account_state: 'coach_application_submitted',
        next_step: '/onboarding/league-pending-approval',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
        },
      })
    ).toBe('/onboarding/league-pending-approval');
  });

  it('prefers canonical next_step for approved coach final setup entry', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        approval_status: 'APPROVED',
        account_state: 'coach_final_setup_required',
        next_step: '/onboarding/step-3-league',
        preferences: {
          role: 'coach',
          onboarding_completed: false,
        },
      })
    ).toBe('/onboarding/step-3-league');
  });

  it('keeps active fans on the main tabs route', () => {
    expect(
      getPostAuthLandingRoute({
        email_verified: true,
        account_state: 'fan_active',
        next_step: '/(tabs)',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      })
    ).toBe('/(tabs)');
  });
});
