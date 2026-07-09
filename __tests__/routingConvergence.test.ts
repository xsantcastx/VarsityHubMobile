import { describe, expect, it } from '@jest/globals';
import { getOnboardingIndexRouteDecision } from '../utils/appRouteDecisions';
import { resolveAuthRouting } from '../utils/authRouting';
import { isPublicRouteSegment } from '../utils/publicRoutes';

function getRoutingInput(route: string) {
  const normalized = route.replace(/^\//, '').split('?')[0] || '';
  const firstSegment = normalized.split('/')[0] || '';

  return {
    firstSegment,
    currentPath: normalized,
    isPublic: isPublicRouteSegment(firstSegment),
  };
}

function resolveForRoute(user: any, route: string) {
  const routingInput = getRoutingInput(route);
  return resolveAuthRouting({
    user,
    pendingVerificationEmail: null,
    healthOk: true,
    unauthenticatedEntryRoute: '/sign-in',
    ...routingInput,
  });
}

function expectStableAfterRedirect(user: any, initialRoute: string) {
  const first = resolveForRoute(user, initialRoute);
  if (!first.redirectTo) {
    return first;
  }

  const second = resolveForRoute(user, String(first.redirectTo));
  expect(second.redirectTo).toBeNull();
  expect(second.redirectReason).toBeNull();
  return second;
}

describe('routing convergence', () => {
  it('settles unauthenticated onboarding access onto sign-in in one redirect', () => {
    const resolution = expectStableAfterRedirect(null, '/onboarding/step-1-role');
    expect(resolution.postAuthDecision).toBeNull();
  });

  it('settles unauthenticated users from the root splash onto guest home in one redirect', () => {
    const resolution = expectStableAfterRedirect(null, '/');
    expect(resolution.postAuthDecision).toBeNull();
  });

  it('keeps guest-browseable content routes stable for anonymous users', () => {
    for (const route of [
      '/post-detail?id=post_123',
      '/public-event?id=evt_456',
      '/event-detail?id=evt_123',
      '/game/123',
      '/user-profile?id=user_123',
      '/team-page?id=team_123',
      '/organization?id=org_123',
      '/organizations/org_123',
      '/game-map',
    ]) {
      const authResolution = resolveForRoute(null, route);
      expect(authResolution.redirectTo).toBeNull();
      expect(authResolution.redirectReason).toBeNull();
    }
  });

  it('settles unverified onboarding access onto verify in one redirect', () => {
    const user = {
      email_verified: false,
      preferences: { role: 'fan', onboarding_completed: false },
    };

    const resolution = expectStableAfterRedirect(user, '/onboarding/step-1-role');
    expect(resolution.redirectTo).toBeNull();
  });

  it('keeps onboarding index and auth routing aligned for incomplete fan onboarding', () => {
    const user = {
      email_verified: true,
      preferences: { role: 'fan', onboarding_completed: false },
    };
    const onboardingState = {
      role: 'fan',
    };

    const decision = getOnboardingIndexRouteDecision(user as any, onboardingState as any);
    expect(decision.route).toBe('/onboarding/step-2-basic');

    const authResolution = resolveForRoute(user, decision.route);
    expect(authResolution.redirectTo).toBeNull();
    expect(authResolution.needsOnboarding).toBe(true);
  });

  it('keeps onboarding index and auth routing aligned for coach application waiting', () => {
    const user = {
      email_verified: true,
      approval_status: 'PENDING',
      account_state: 'coach_application_submitted',
      next_step: '/onboarding/league-pending-approval',
      preferences: { role: 'coach', onboarding_completed: false },
    };

    const decision = getOnboardingIndexRouteDecision(user as any, {} as any);
    expect(decision.route).toBe('/onboarding/league-pending-approval');

    const authResolution = resolveForRoute(user, decision.route);
    expect(authResolution.redirectTo).toBeNull();
    expect(authResolution.redirectReason).toBeNull();
  });

  it('keeps onboarding index and auth routing aligned for pending coach fan mode', () => {
    const user = {
      email_verified: true,
      approval_status: 'PENDING',
      account_state: 'coach_pending_approval',
      next_step: '/onboarding/pending-approval',
      proceeding_as_fan: true,
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        organization_id: 'org_123',
        proceeding_as_fan: false,
      },
    };

    const decision = getOnboardingIndexRouteDecision(user as any, {} as any);
    expect(decision.route).toBe('/(tabs)/feed');

    const authResolution = resolveForRoute(user, decision.route);
    expect(authResolution.redirectTo).toBeNull();
    expect(authResolution.redirectReason).toBeNull();
  });

  it('settles authenticated users from public auth screens in one redirect', () => {
    const user = {
      email_verified: true,
      preferences: { role: 'fan', onboarding_completed: true },
    };

    expectStableAfterRedirect(user, '/sign-in');
  });

  it('keeps authenticated users stable on guest-browseable detail routes', () => {
    const user = {
      email_verified: true,
      preferences: { role: 'fan', onboarding_completed: true },
    };

    for (const route of [
      '/event-detail?id=evt_123',
      '/post-detail?id=post_123',
      '/game/123',
      '/organization?id=org_123',
    ]) {
      const resolution = resolveForRoute(user, route);
      expect(resolution.redirectTo).toBeNull();
      expect(resolution.redirectReason).toBeNull();
    }
  });

  it('settles authenticated app-home users from the root splash in one redirect', () => {
    const user = {
      email_verified: true,
      preferences: { role: 'fan', onboarding_completed: true },
    };

    const resolution = expectStableAfterRedirect(user, '/');
    expect(resolution.postAuthDecision?.route).toBe('/(tabs)/feed');
  });

  it('keeps approved coaches on coach agreement without bouncing away before acceptance', () => {
    const user = {
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
      },
    };

    const authResolution = resolveForRoute(user, '/onboarding/coach-agreement');
    expect(authResolution.redirectTo).toBeNull();
    expect(authResolution.redirectReason).toBeNull();
  });

  it('settles approved coaches off coach agreement after acceptance in one redirect', () => {
    const user = {
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        coach_agreement_accepted_at: '2026-01-01T00:00:00.000Z',
        coach_agreement_version: 1,
      },
    };

    const resolution = expectStableAfterRedirect(user, '/onboarding/coach-agreement');
    expect(resolution.postAuthDecision?.route).toBe('/(tabs)/feed');
  });

  it('settles approved onboarding users off draft steps in one redirect', () => {
    const user = {
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'fan',
        onboarding_completed: true,
      },
    };

    expectStableAfterRedirect(user, '/onboarding/step-1-role');
  });

  it('keeps pending coach waiting screens stable once reached', () => {
    const joinRequestCoach = {
      email_verified: true,
      approval_status: 'PENDING',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        join_request_pending: true,
        organization_id: 'org_123',
      },
    };

    const authResolution = resolveForRoute(joinRequestCoach, '/onboarding/pending-approval');
    expect(authResolution.redirectTo).toBeNull();
    expect(authResolution.redirectReason).toBeNull();
  });

  it('settles a pending coach who opens tabs onto the pending screen in one redirect', () => {
    const pendingCoach = {
      email_verified: true,
      approval_status: 'PENDING',
      account_state: 'coach_pending_approval',
      next_step: '/onboarding/pending-approval',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        join_request_pending: true,
        organization_id: 'org_123',
      },
    };

    const resolution = expectStableAfterRedirect(pendingCoach, '/(tabs)');
    expect(resolution.postAuthDecision?.route).toBe('/onboarding/pending-approval');
  });

  it('settles a pending coach who opens sign-in onto the pending screen in one redirect', () => {
    const pendingCoach = {
      email_verified: true,
      approval_status: 'PENDING',
      account_state: 'coach_application_submitted',
      next_step: '/onboarding/league-pending-approval',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
      },
    };

    const resolution = expectStableAfterRedirect(pendingCoach, '/sign-in');
    expect(resolution.postAuthDecision?.route).toBe('/onboarding/league-pending-approval');
  });
});
