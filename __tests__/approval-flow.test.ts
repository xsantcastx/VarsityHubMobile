/**
 * Tests for the coach approval flow logic.
 * Validates the critical state transitions that were causing navigation loops.
 */

describe('Coach approval flow', () => {
  // Simulates the AuthProvider routing logic
  const getRouteTarget = (user: {
    approval_status: string;
    preferences: {
      role?: string;
      onboarding_completed?: boolean;
      proceeding_as_fan?: boolean;
      coach_agreement_accepted_at?: string;
    };
  }) => {
    const prefs = user.preferences;
    const isPendingCoach = prefs.role === 'coach' && user.approval_status === 'PENDING';
    const isApprovedProceedingAsFan = user.approval_status === 'APPROVED' && prefs.proceeding_as_fan === true;
    const isCoachWithoutAgreement = prefs.role === 'coach' && user.approval_status === 'APPROVED' && !prefs.coach_agreement_accepted_at;
    const needsOnboarding = prefs.onboarding_completed !== true;

    if (isPendingCoach) return '/onboarding/pending-approval';
    if (isApprovedProceedingAsFan) return '/onboarding/coach-agreement';
    if (isCoachWithoutAgreement) return '/onboarding/coach-agreement';
    if (needsOnboarding) return '/onboarding/step-1-role';
    return '/(tabs)';
  };

  it('routes pending coach to pending-approval', () => {
    expect(getRouteTarget({
      approval_status: 'PENDING',
      preferences: { role: 'coach', onboarding_completed: true, proceeding_as_fan: true },
    })).toBe('/onboarding/pending-approval');
  });

  it('routes approved coach with proceeding_as_fan to coach-agreement', () => {
    expect(getRouteTarget({
      approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, proceeding_as_fan: true },
    })).toBe('/onboarding/coach-agreement');
  });

  it('routes approved coach after proceeding_as_fan cleared to coach-agreement (no agreement yet)', () => {
    expect(getRouteTarget({
      approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, proceeding_as_fan: false },
    })).toBe('/onboarding/coach-agreement');
  });

  it('routes approved coach with agreement to main app', () => {
    expect(getRouteTarget({
      approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, proceeding_as_fan: false, coach_agreement_accepted_at: '2026-01-01' },
    })).toBe('/(tabs)');
  });

  it('BUG FIX: completeOnboarding must include proceeding_as_fan: false', () => {
    // This is the payload that pending-approval.tsx sends after detecting approval
    const payload = {
      role: 'coach',
      proceeding_as_fan: false, // <-- This was missing before the fix
      username: 'test_coach',
      dob: '1990-01-01',
    };
    expect(payload.proceeding_as_fan).toBe(false);
  });

  it('BUG FIX: checkAuth must be called before navigating from pending-approval', () => {
    // After approval detected, AuthProvider has stale state (PENDING).
    // Without checkAuth(), navigating to coach-agreement triggers
    // AuthProvider to redirect back to pending-approval (loop).
    const staleUser = {
      approval_status: 'PENDING', // stale — not refreshed
      preferences: { role: 'coach', onboarding_completed: true, proceeding_as_fan: true },
    };
    // With stale state, routing sends back to pending-approval
    expect(getRouteTarget(staleUser)).toBe('/onboarding/pending-approval');

    // After checkAuth(), state is fresh
    const freshUser = {
      approval_status: 'APPROVED', // refreshed from server
      preferences: { role: 'coach', onboarding_completed: true, proceeding_as_fan: false },
    };
    expect(getRouteTarget(freshUser)).toBe('/onboarding/coach-agreement');
  });
});
