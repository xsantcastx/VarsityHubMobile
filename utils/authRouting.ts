import {
  hasAcceptedCoachAgreement,
  isOnboardingCompleteSnapshot,
  isProceedingAsFanSnapshot,
} from './authState';
import {
  getPostAuthRouteDecision,
  type AppRoute,
  type PostAuthRouteDecision,
} from './appRouteDecisions';
import {
  getCoachAccessState,
  type CoachAccessState,
  type CoachUserLike,
} from './roleChecks';

export type AuthRoutingUserLike = CoachUserLike & {
  email_verified?: boolean | null;
  paid_by_owner?: boolean;
};

export type AuthRoutingResolution = {
  coachAccess: CoachAccessState;
  postAuthDecision: PostAuthRouteDecision | null;
  redirectTo: AppRoute | string | null;
  redirectReason: string | null;
  shouldFlushDeferredDeepLink: boolean;
  shouldRestoreApprovedCoachRole: boolean;
  needsOnboarding: boolean;
};

export function resolveAuthRouting(input: {
  user: AuthRoutingUserLike | null;
  pendingVerificationEmail: string | null;
  firstSegment: string;
  currentPath: string;
  isPublic: boolean;
  healthOk: boolean;
  unauthenticatedEntryRoute: string;
}): AuthRoutingResolution {
  const defaultCoachAccess = getCoachAccessState(input.user);
  const defaultResolution: AuthRoutingResolution = {
    coachAccess: defaultCoachAccess,
    postAuthDecision: null,
    redirectTo: null,
    redirectReason: null,
    shouldFlushDeferredDeepLink: false,
    shouldRestoreApprovedCoachRole: false,
    needsOnboarding: false,
  };

  if (!input.user) {
    if (!input.healthOk && !input.pendingVerificationEmail && !input.isPublic) {
      return {
        ...defaultResolution,
        redirectTo: input.unauthenticatedEntryRoute,
        redirectReason: 'unauthenticated_backend_unhealthy',
      };
    }

    if (!input.pendingVerificationEmail && !input.isPublic) {
      return {
        ...defaultResolution,
        redirectTo: input.unauthenticatedEntryRoute,
        redirectReason: 'unauthenticated',
      };
    }

    return defaultResolution;
  }

  const coachAccess = getCoachAccessState(input.user);
  const postAuthDecision = getPostAuthRouteDecision(input.user, {
    pendingVerification: !!input.pendingVerificationEmail,
  });
  const accountState = String(input.user.account_state || '').trim();
  const explicitNextStep =
    typeof input.user.next_step === 'string' && input.user.next_step.trim().startsWith('/')
      ? (input.user.next_step.trim() as AppRoute)
      : null;
  const normalizedExplicitNextStep = explicitNextStep?.replace(/^\//, '') || '';
  const isOnExplicitNextStep =
    !!normalizedExplicitNextStep &&
    (input.currentPath === normalizedExplicitNextStep ||
      input.currentPath.startsWith(`${normalizedExplicitNextStep}/`));
  const shouldRestoreApprovedCoachRole =
    coachAccess.isApprovedCoach && isProceedingAsFanSnapshot(input.user as any);
  const needsOnboarding =
    !isOnboardingCompleteSnapshot(input.user as any) && !coachAccess.isProceedingAsFan;
  const isOnAgreementScreen = input.currentPath.includes('coach-agreement');
  const needsCoachAgreementAcceptance =
    isOnAgreementScreen && !hasAcceptedCoachAgreement(input.user as any);
  const isPendingCoach =
    input.user?.is_admin !== true &&
    (coachAccess.isPendingCoach || coachAccess.isRejectedCoach) &&
    !coachAccess.isProceedingAsFan;
  const isOnPendingScreen =
    input.currentPath.includes('pending-approval') ||
    input.currentPath.includes('league-pending-approval');
  const isPaymentRedirectScreen =
    input.firstSegment === 'payment-success' || input.firstSegment === 'payment-cancel';

  if (input.user.email_verified !== true) {
    const verifyRoutes = new Set(['verify', 'verify-email', 'verify-identity']);
    if (!verifyRoutes.has(input.firstSegment)) {
      return {
        coachAccess,
        postAuthDecision,
        redirectTo: '/verify',
        redirectReason: 'email_not_verified',
        shouldFlushDeferredDeepLink: false,
        shouldRestoreApprovedCoachRole,
        needsOnboarding,
      };
    }
  }

  if (
    explicitNextStep &&
    postAuthDecision.kind.startsWith('server_') &&
    explicitNextStep !== '/(tabs)' &&
    !coachAccess.isProceedingAsFan &&
    ['coach_application_submitted', 'coach_application_rejected', 'coach_pending_approval'].includes(
      accountState
    ) &&
    !isOnExplicitNextStep
  ) {
    return {
      coachAccess,
      postAuthDecision,
      redirectTo: explicitNextStep,
      redirectReason: `server_next_step:${accountState}`,
      shouldFlushDeferredDeepLink: false,
      shouldRestoreApprovedCoachRole,
      needsOnboarding,
    };
  }

  if (
    isPendingCoach &&
    input.firstSegment !== 'sign-in' &&
    input.firstSegment !== 'sign-up' &&
    input.firstSegment !== 'onboarding'
  ) {
    return {
      coachAccess,
      postAuthDecision,
      redirectTo: postAuthDecision.route,
      redirectReason: 'coach_pending_approval',
      shouldFlushDeferredDeepLink: false,
      shouldRestoreApprovedCoachRole,
      needsOnboarding,
    };
  }

  if (postAuthDecision.kind === 'generic_onboarding_required' && input.firstSegment !== 'onboarding') {
    return {
      coachAccess,
      postAuthDecision,
      redirectTo: postAuthDecision.route,
      redirectReason: 'onboarding_required',
      shouldFlushDeferredDeepLink: false,
      shouldRestoreApprovedCoachRole,
      needsOnboarding,
    };
  }

  if (
    !needsOnboarding &&
    input.firstSegment === 'onboarding' &&
    !isPendingCoach &&
    !isOnPendingScreen &&
    !needsCoachAgreementAcceptance
  ) {
    return {
      coachAccess,
      postAuthDecision,
      redirectTo: postAuthDecision.route,
      redirectReason: 'onboarding_complete',
      shouldFlushDeferredDeepLink: false,
      shouldRestoreApprovedCoachRole,
      needsOnboarding,
    };
  }

  if (
    input.isPublic &&
    postAuthDecision.kind === 'app_home' &&
    input.firstSegment !== 'verify-email' &&
    !isPaymentRedirectScreen
  ) {
    return {
      coachAccess,
      postAuthDecision,
      redirectTo: postAuthDecision.route,
      redirectReason: 'public_route_authenticated',
      shouldFlushDeferredDeepLink: false,
      shouldRestoreApprovedCoachRole,
      needsOnboarding,
    };
  }

  return {
    coachAccess,
    postAuthDecision,
    redirectTo: null,
    redirectReason: null,
    shouldFlushDeferredDeepLink: !needsOnboarding,
    shouldRestoreApprovedCoachRole,
    needsOnboarding,
  };
}
