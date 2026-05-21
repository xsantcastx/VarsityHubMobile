import { describe, expect, it } from '@jest/globals';
import { resolveAuthRouting } from '../utils/authRouting';

describe('resolveAuthRouting', () => {
  it('redirects unauthenticated users to sign-in when backend is unhealthy', () => {
    const result = resolveAuthRouting({
      user: null,
      pendingVerificationEmail: null,
      firstSegment: '',
      currentPath: '',
      isPublic: false,
      healthOk: false,
      unauthenticatedEntryRoute: '/sign-in',
    });

    expect(result.redirectTo).toBe('/sign-in');
    expect(result.redirectReason).toBe('unauthenticated_backend_unhealthy');
  });

  it('prefers the server next_step for pending application states', () => {
    const result = resolveAuthRouting({
      user: {
        email_verified: true,
        approval_status: 'PENDING',
        account_state: 'coach_application_submitted',
        next_step: '/onboarding/league-pending-approval',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
        },
      },
      pendingVerificationEmail: null,
      firstSegment: 'sign-in',
      currentPath: 'sign-in',
      isPublic: true,
      healthOk: true,
      unauthenticatedEntryRoute: '/sign-in',
    });

    expect(result.redirectTo).toBe('/onboarding/league-pending-approval');
    expect(result.redirectReason).toBe('server_next_step:coach_application_submitted');
  });

  it('flags approved coaches in fan mode for in-place restoration', () => {
    const result = resolveAuthRouting({
      user: {
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          proceeding_as_fan: true,
        },
      },
      pendingVerificationEmail: null,
      firstSegment: '(tabs)',
      currentPath: '(tabs)',
      isPublic: false,
      healthOk: true,
      unauthenticatedEntryRoute: '/sign-in',
    });

    expect(result.shouldRestoreApprovedCoachRole).toBe(true);
    expect(result.redirectTo).toBeNull();
  });

  it('uses canonical proceeding_as_fan for approved-coach restoration when preferences are stale', () => {
    const result = resolveAuthRouting({
      user: {
        email_verified: true,
        approval_status: 'APPROVED',
        proceeding_as_fan: true,
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          proceeding_as_fan: false,
        },
      },
      pendingVerificationEmail: null,
      firstSegment: '(tabs)',
      currentPath: '(tabs)',
      isPublic: false,
      healthOk: true,
      unauthenticatedEntryRoute: '/sign-in',
    });

    expect(result.shouldRestoreApprovedCoachRole).toBe(true);
    expect(result.redirectTo).toBeNull();
  });

  it('redirects authenticated users away from public auth screens to the app home route', () => {
    const result = resolveAuthRouting({
      user: {
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
      pendingVerificationEmail: null,
      firstSegment: 'sign-in',
      currentPath: 'sign-in',
      isPublic: true,
      healthOk: true,
      unauthenticatedEntryRoute: '/sign-in',
    });

    expect(result.redirectTo).toBe('/(tabs)');
    expect(result.redirectReason).toBe('public_route_authenticated');
  });
});
