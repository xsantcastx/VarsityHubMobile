import { describe, expect, it, jest } from '@jest/globals';

import {
  getAuthSnapshot,
  getCanonicalOrganizationId,
  getCanonicalRole,
  hasAcceptedCoachAgreement,
  isApprovedCoach,
  isOnboardingCompleteSnapshot,
  isProceedingAsFanSnapshot,
} from '@/utils/authState';

describe('authState helpers', () => {
  it('returns the current user snapshot without calling checkAuth again', async () => {
    const checkAuth = jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'server-user' });
    const localUser = { id: 'local-user' };

    await expect(getAuthSnapshot(checkAuth as any, localUser)).resolves.toEqual(localUser);
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it('falls back to checkAuth when no current user snapshot exists', async () => {
    const serverUser = { id: 'server-user' };
    const checkAuth = jest.fn<() => Promise<any>>().mockResolvedValue(serverUser);

    await expect(getAuthSnapshot(checkAuth as any, null)).resolves.toEqual(serverUser);
    expect(checkAuth).toHaveBeenCalledTimes(1);
  });

  it('detects approved coaches from canonical role + approval status', () => {
    expect(
      isApprovedCoach({
        role: 'coach',
        approval_status: 'APPROVED',
      })
    ).toBe(true);
  });

  it('prefers top-level auth state before falling back to preferences', () => {
    const source = {
      role: 'coach',
      onboarding_completed: false,
      organization_id: 'org_top',
      coach_agreement_accepted_at: '2026-05-13T00:00:00.000Z',
      proceeding_as_fan: false,
      preferences: {
        role: 'fan',
        onboarding_completed: true,
        organization_id: 'org_pref',
        coach_agreement_accepted_at: null,
        proceeding_as_fan: true,
      },
    };

    expect(getCanonicalRole(source)).toBe('coach');
    expect(isOnboardingCompleteSnapshot(source)).toBe(false);
    expect(getCanonicalOrganizationId(source)).toBe('org_top');
    expect(hasAcceptedCoachAgreement(source)).toBe(true);
    expect(isProceedingAsFanSnapshot(source)).toBe(false);
  });

  it('falls back to preferences when top-level auth fields are absent', () => {
    const source = {
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        organization_id: 'org_pref',
        coach_agreement_accepted_at: '2026-05-13T00:00:00.000Z',
        proceeding_as_fan: true,
      },
    };

    expect(getCanonicalRole(source)).toBe('coach');
    expect(isOnboardingCompleteSnapshot(source)).toBe(true);
    expect(getCanonicalOrganizationId(source)).toBe('org_pref');
    expect(hasAcceptedCoachAgreement(source)).toBe(true);
    expect(isProceedingAsFanSnapshot(source)).toBe(true);
  });
});
