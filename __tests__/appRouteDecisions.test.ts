import { describe, expect, it } from '@jest/globals';
import {
  getCoachAgreementRouteDecision,
  getOnboardingIndexRouteDecision,
  getPostAuthRouteDecision,
} from '../utils/appRouteDecisions';

describe('getPostAuthRouteDecision', () => {
  const cases = [
    {
      label: 'routes unauthenticated users to sign-in',
      user: null,
      expected: '/sign-in',
      kind: 'unauthenticated',
    },
    {
      label: 'routes unverified users to verify',
      user: {
        email_verified: false,
        preferences: { onboarding_completed: false, role: 'fan' },
      },
      expected: '/verify',
      kind: 'email_verification_required',
    },
    {
      label: 'routes onboarded admins with dirty rejected coach state to app home',
      user: {
        email_verified: true,
        is_admin: true,
        account_state: 'coach_application_rejected',
        next_step: '/onboarding/league-pending-approval',
        preferences: { onboarding_completed: true, role: 'coach' },
      },
      expected: '/(tabs)',
      kind: 'app_home',
    },
    {
      label: 'routes server-directed rejected applicants to waiting screen',
      user: {
        email_verified: true,
        account_state: 'coach_application_rejected',
        next_step: '/onboarding/league-pending-approval',
        preferences: { onboarding_completed: false, role: 'coach' },
      },
      expected: '/onboarding/league-pending-approval',
      kind: 'server_application_rejected_waiting',
    },
    {
      label: 'routes pending coaches to the join-request waiting screen',
      user: {
        email_verified: true,
        approval_status: 'PENDING',
        preferences: {
          onboarding_completed: true,
          role: 'coach',
          join_request_pending: true,
          organization_id: 'org_123',
        },
      },
      expected: '/onboarding/pending-approval',
      kind: 'pending_coach_waiting',
    },
    {
      label: 'keeps pending coaches in fan mode on app home even without server next_step',
      user: {
        email_verified: true,
        approval_status: 'PENDING',
        onboarding_completed: false,
        proceeding_as_fan: true,
        preferences: {
          onboarding_completed: false,
          role: 'coach',
          proceeding_as_fan: false,
        },
      },
      expected: '/(tabs)',
      kind: 'app_home',
    },
    {
      label: 'respects server-directed league pending approvals',
      user: {
        email_verified: true,
        account_state: 'coach_pending_approval',
        next_step: '/onboarding/league-pending-approval',
        preferences: {
          onboarding_completed: false,
          role: 'coach',
          organization_id: 'org_123',
        },
      },
      expected: '/onboarding/league-pending-approval',
      kind: 'server_pending_approval_league_waiting',
    },
    {
      label: 'routes approved coaches with incomplete setup into the app once approved',
      user: {
        email_verified: true,
        approval_status: 'APPROVED',
        onboarding_completed: false,
        organization_id: 'org_123',
        preferences: {
          onboarding_completed: true,
          role: 'coach',
          organization_id: '',
        },
      },
      expected: '/(tabs)',
      kind: 'app_home',
    },
    {
      label: 'routes approved coaches without agreement into the app once approved',
      user: {
        email_verified: true,
        approval_status: 'APPROVED',
        required_coach_agreement_version: 1,
        preferences: {
          onboarding_completed: true,
          role: 'coach',
        },
      },
      expected: '/(tabs)',
      kind: 'app_home',
    },
    {
      label: 'routes active fans to app home',
      user: {
        email_verified: true,
        account_state: 'fan_active',
        preferences: {
          onboarding_completed: true,
          role: 'fan',
        },
      },
      expected: '/(tabs)',
      kind: 'app_home',
    },
  ] as const;

  for (const testCase of cases) {
    it(testCase.label, () => {
      const decision = getPostAuthRouteDecision(testCase.user as any);
      expect(decision.route).toBe(testCase.expected);
      expect(decision.kind).toBe(testCase.kind);
    });
  }

  it('routes pending verification sign-ins to the canonical verify screen', () => {
    const decision = getPostAuthRouteDecision(
      {
        email_verified: false,
        preferences: { onboarding_completed: false, role: 'fan' },
      } as any,
      { pendingVerification: true }
    );

    expect(decision.kind).toBe('pending_verification');
    expect(decision.route).toBe('/verify');
  });
});

describe('getOnboardingIndexRouteDecision', () => {
  it('prefers server-directed routes over draft progression', () => {
    const decision = getOnboardingIndexRouteDecision(
      {
        email_verified: true,
        account_state: 'coach_final_setup_required',
        next_step: '/onboarding/step-3-league',
        preferences: { onboarding_completed: false, role: 'coach' },
      } as any,
      {
        role: 'coach',
        step_2_visited: true,
      }
    );

    expect(decision.kind).toBe('draft_step_3');
    expect(decision.route).toBe('/onboarding/step-3-league');
  });

  it('routes incomplete coach drafts with submitted org data to waiting screen', () => {
    const decision = getOnboardingIndexRouteDecision(
      {
        email_verified: true,
        preferences: { onboarding_completed: false, role: 'coach' },
      } as any,
      {
        role: 'coach',
        step_2_visited: true,
        organization_id: 'org_123',
      }
    );

    expect(decision.kind).toBe('draft_pending_waiting');
    expect(decision.route).toBe('/onboarding/league-pending-approval');
  });

  it('treats top-level onboarding_completed=false as authoritative even when preferences are stale', () => {
    const decision = getOnboardingIndexRouteDecision(
      {
        email_verified: true,
        onboarding_completed: false,
        preferences: { onboarding_completed: true, role: 'coach' },
      } as any,
      {
        role: 'coach',
        step_2_visited: true,
        organization_id: 'org_123',
      }
    );

    expect(decision.kind).toBe('draft_pending_waiting');
    expect(decision.route).toBe('/onboarding/league-pending-approval');
  });

  it('routes ordinary incomplete users to the next draft step', () => {
    const decision = getOnboardingIndexRouteDecision(
      {
        email_verified: true,
        preferences: { onboarding_completed: false, role: 'fan' },
      } as any,
      {
        role: 'fan',
      }
    );

    expect(decision.kind).toBe('draft_step_2');
    expect(decision.route).toBe('/onboarding/step-2-basic');
    expect(decision.stepIndex).toBe(1);
  });
});

describe('getCoachAgreementRouteDecision', () => {
  it('routes coaches without an organization into final setup', () => {
    const decision = getCoachAgreementRouteDecision(
      {
        preferences: { role: 'coach' },
      } as any,
      null
    );

    expect(decision.kind).toBe('final_setup');
    expect(decision.route).toBe('/onboarding/step-3-league');
  });

  it('routes create-team redirects with the organization id preserved', () => {
    const decision = getCoachAgreementRouteDecision(
      {
        preferences: { role: 'coach', organization_id: 'org_123' },
      } as any,
      'create-team'
    );

    expect(decision.kind).toBe('create_team');
    expect(decision.route).toBe('/(tabs)/create-team');
    expect(decision.params).toEqual({ organization_id: 'org_123' });
  });

  it('preserves top-level organization_id when preferences are stale', () => {
    const decision = getCoachAgreementRouteDecision(
      {
        role: 'coach',
        organization_id: 'org_123',
        preferences: { role: 'coach', organization_id: '' },
      } as any,
      'create-team'
    );

    expect(decision.kind).toBe('create_team');
    expect(decision.params).toEqual({ organization_id: 'org_123' });
  });

  it('routes approved coaches with an organization into organization tools by default', () => {
    const decision = getCoachAgreementRouteDecision(
      {
        preferences: { role: 'coach', organization_id: 'org_456' },
      } as any,
      null
    );

    expect(decision.kind).toBe('team_hub');
    expect(decision.route).toBe('/organization');
  });
});
