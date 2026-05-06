import { describe, expect, it } from '@jest/globals';
import { getCoachUpgradeCta } from '../utils/coachUpgradeCta';

describe('getCoachUpgradeCta', () => {
  it('offers coach upgrade to fans', () => {
    expect(
      getCoachUpgradeCta({
        role: 'fan',
        approval_status: 'APPROVED',
        preferences: { role: 'fan' },
      })
    ).toEqual({
      kind: 'upgrade',
      title: 'Upgrade to Coach Account',
      subtitle: "You'll complete the coach setup steps next.",
      route: null,
    });
  });

  it('routes pending coaches back to their approval status screen', () => {
    expect(
      getCoachUpgradeCta({
        role: 'coach',
        approval_status: 'PENDING',
        preferences: { role: 'coach', organization_id: 'org_123' },
      })
    ).toEqual({
      kind: 'resume',
      title: 'View Coach Application Status',
      subtitle: 'Finish your pending coach approval steps',
      route: '/onboarding/league-pending-approval',
    });
  });

  it('routes rejected coaches back into coach recovery instead of hiding the pathway', () => {
    expect(
      getCoachUpgradeCta({
        role: 'coach',
        approval_status: 'REJECTED',
        account_state: 'coach_application_rejected',
        next_step: '/onboarding/league-pending-approval',
        preferences: { role: 'coach' },
      } as any)
    ).toEqual({
      kind: 'resume',
      title: 'Resume Coach Application',
      subtitle: 'Review the decision and continue your coach application',
      route: '/onboarding/league-pending-approval',
    });
  });

  it('hides the upgrade CTA for approved coaches', () => {
    expect(
      getCoachUpgradeCta({
        role: 'coach',
        approval_status: 'APPROVED',
        required_coach_agreement_version: 1,
        preferences: {
          role: 'coach',
          coach_agreement_accepted_at: new Date().toISOString(),
          coach_agreement_version: 1,
        },
      } as any)
    ).toBeNull();
  });
});
