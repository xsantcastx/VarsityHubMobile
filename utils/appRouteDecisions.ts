import type { OnboardingState } from '@/context/OnboardingContext';
import { STEP_ROUTES, nextIncompleteStep } from '@/context/onboardingReducer';
import { getCoachAccessState, getPendingCoachRoute, type CoachUserLike } from './roleChecks';

export type AppRoute =
  | '/sign-in'
  | '/verify'
  | '/verify-email'
  | '/onboarding/step-1-role'
  | '/onboarding/step-2-basic'
  | '/onboarding/step-3-league'
  | '/onboarding/coach-application'
  | '/onboarding/pending-approval'
  | '/onboarding/league-pending-approval'
  | '/onboarding/coach-agreement'
  | '/settings/manage-subscription'
  | '/(tabs)'
  | '/(tabs)/team-hub'
  | '/(tabs)/create-team';

type RoutePreference = {
  email_verified?: boolean | null;
  onboarding_completed?: boolean | null;
};

export type RoutingUserLike = CoachUserLike & {
  email_verified?: boolean | null;
  onboarding_completed?: boolean | null;
  paid_by_owner?: boolean;
  preferences?: (NonNullable<CoachUserLike['preferences']> & RoutePreference) | null;
};

export type PostAuthRouteKind =
  | 'unauthenticated'
  | 'pending_verification'
  | 'email_verification_required'
  | 'server_application_required'
  | 'server_application_submitted_waiting'
  | 'server_application_submitted_fan_mode'
  | 'server_application_rejected_waiting'
  | 'server_application_rejected_fan_mode'
  | 'server_pending_approval_league_waiting'
  | 'server_pending_approval_waiting'
  | 'server_pending_approval_fan_mode'
  | 'server_coach_agreement_required'
  | 'server_final_setup_required'
  | 'pending_coach_waiting'
  | 'approved_coach_finish_setup'
  | 'generic_onboarding_required'
  | 'coach_checkout_required'
  | 'coach_agreement_required'
  | 'app_home';

export type PostAuthRouteDecision = {
  kind: PostAuthRouteKind;
  route: AppRoute;
};

const POST_AUTH_ROUTE_BY_KIND: Record<PostAuthRouteKind, AppRoute> = {
  unauthenticated: '/sign-in',
  pending_verification: '/verify-email',
  email_verification_required: '/verify',
  server_application_required: '/onboarding/coach-application',
  server_application_submitted_waiting: '/onboarding/league-pending-approval',
  server_application_submitted_fan_mode: '/(tabs)',
  server_application_rejected_waiting: '/onboarding/league-pending-approval',
  server_application_rejected_fan_mode: '/(tabs)',
  server_pending_approval_league_waiting: '/onboarding/league-pending-approval',
  server_pending_approval_waiting: '/onboarding/pending-approval',
  server_pending_approval_fan_mode: '/(tabs)',
  server_coach_agreement_required: '/onboarding/coach-agreement',
  server_final_setup_required: '/onboarding/step-3-league',
  pending_coach_waiting: '/onboarding/pending-approval',
  approved_coach_finish_setup: '/onboarding/pending-approval',
  generic_onboarding_required: '/onboarding/step-1-role',
  coach_checkout_required: '/settings/manage-subscription',
  coach_agreement_required: '/onboarding/coach-agreement',
  app_home: '/(tabs)',
};

export type OnboardingIndexRouteKind =
  | 'server_application_required'
  | 'server_application_submitted_waiting'
  | 'server_application_submitted_fan_mode'
  | 'server_application_rejected_waiting'
  | 'server_application_rejected_fan_mode'
  | 'server_pending_approval_league_waiting'
  | 'server_pending_approval_waiting'
  | 'server_pending_approval_fan_mode'
  | 'server_coach_agreement_required'
  | 'server_final_setup_required'
  | 'completed_tabs'
  | 'draft_step_1'
  | 'draft_step_2'
  | 'draft_step_3'
  | 'draft_pending_waiting';

export type OnboardingIndexRouteDecision = {
  kind: OnboardingIndexRouteKind;
  route: AppRoute;
  stepIndex?: number;
};

const ONBOARDING_INDEX_ROUTE_BY_KIND: Record<OnboardingIndexRouteKind, AppRoute> = {
  server_application_required: '/onboarding/coach-application',
  server_application_submitted_waiting: '/onboarding/league-pending-approval',
  server_application_submitted_fan_mode: '/(tabs)',
  server_application_rejected_waiting: '/onboarding/league-pending-approval',
  server_application_rejected_fan_mode: '/(tabs)',
  server_pending_approval_league_waiting: '/onboarding/league-pending-approval',
  server_pending_approval_waiting: '/onboarding/pending-approval',
  server_pending_approval_fan_mode: '/(tabs)',
  server_coach_agreement_required: '/onboarding/coach-agreement',
  server_final_setup_required: '/onboarding/step-3-league',
  completed_tabs: '/(tabs)',
  draft_step_1: '/onboarding/step-1-role',
  draft_step_2: '/onboarding/step-2-basic',
  draft_step_3: '/onboarding/step-3-league',
  draft_pending_waiting: '/onboarding/pending-approval',
};

export type CoachAgreementRouteKind = 'final_setup' | 'create_team' | 'team_hub';

export type CoachAgreementRouteDecision = {
  kind: CoachAgreementRouteKind;
  route: AppRoute;
  params?: Record<string, string>;
};

const COACH_AGREEMENT_ROUTE_BY_KIND: Record<CoachAgreementRouteKind, AppRoute> = {
  final_setup: '/onboarding/step-3-league',
  create_team: '/(tabs)/create-team',
  team_hub: '/(tabs)/team-hub',
};

function resolveServerDirectedPostAuthKind(user: RoutingUserLike): PostAuthRouteKind | null {
  const accountState = String(user.account_state || '').trim();
  const explicitNextStep =
    typeof user.next_step === 'string' && user.next_step.trim().startsWith('/')
      ? (user.next_step.trim() as AppRoute)
      : null;

  switch (accountState) {
    case 'coach_application_required':
      return 'server_application_required';
    case 'coach_application_submitted':
      return explicitNextStep === '/(tabs)'
        ? 'server_application_submitted_fan_mode'
        : 'server_application_submitted_waiting';
    case 'coach_application_rejected':
      return explicitNextStep === '/(tabs)'
        ? 'server_application_rejected_fan_mode'
        : 'server_application_rejected_waiting';
    case 'coach_pending_approval':
      return explicitNextStep === '/(tabs)'
        ? 'server_pending_approval_fan_mode'
        : explicitNextStep === '/onboarding/league-pending-approval'
          ? 'server_pending_approval_league_waiting'
          : 'server_pending_approval_waiting';
    case 'coach_agreement_required':
      return 'server_coach_agreement_required';
    case 'coach_final_setup_required':
      return 'server_final_setup_required';
    default:
      return null;
  }
}

function resolvePendingRouteKind(route: string, baseKind: 'pending_coach_waiting' | 'approved_coach_finish_setup'): PostAuthRouteKind {
  if (route === '/onboarding/league-pending-approval') {
    return baseKind;
  }
  return baseKind;
}

export function getPostAuthRouteDecision(
  user: RoutingUserLike | null | undefined,
  options?: { pendingVerification?: boolean }
): PostAuthRouteDecision {
  if (!user) {
    return { kind: 'unauthenticated', route: POST_AUTH_ROUTE_BY_KIND.unauthenticated };
  }

  if (options?.pendingVerification) {
    return { kind: 'pending_verification', route: POST_AUTH_ROUTE_BY_KIND.pending_verification };
  }

  if (user.email_verified !== true) {
    return {
      kind: 'email_verification_required',
      route: POST_AUTH_ROUTE_BY_KIND.email_verification_required,
    };
  }

  // Platform admins should not be trapped behind coach recovery states if
  // their account was temporarily marked coach/pending/rejected during testing.
  // They still follow the normal auth rules above plus generic onboarding below.
  if (user.is_admin === true) {
    const needsOnboarding = user.preferences?.onboarding_completed !== true;
    return needsOnboarding
      ? {
          kind: 'generic_onboarding_required',
          route: POST_AUTH_ROUTE_BY_KIND.generic_onboarding_required,
        }
      : { kind: 'app_home', route: POST_AUTH_ROUTE_BY_KIND.app_home };
  }

  const serverDirectedKind = resolveServerDirectedPostAuthKind(user);
  if (serverDirectedKind) {
    return { kind: serverDirectedKind, route: POST_AUTH_ROUTE_BY_KIND[serverDirectedKind] };
  }

  const coachAccess = getCoachAccessState(user);
  const needsOnboarding = user.preferences?.onboarding_completed !== true;

  if ((coachAccess.isPendingCoach || coachAccess.isRejectedCoach) && !coachAccess.isProceedingAsFan) {
    const route = getPendingCoachRoute(user) as AppRoute;
    return {
      kind: resolvePendingRouteKind(route, 'pending_coach_waiting'),
      route,
    };
  }

  if (needsOnboarding && coachAccess.isApprovedCoach) {
    const route = getPendingCoachRoute(user) as AppRoute;
    return {
      kind: resolvePendingRouteKind(route, 'approved_coach_finish_setup'),
      route,
    };
  }

  if (needsOnboarding) {
    return {
      kind: 'generic_onboarding_required',
      route: POST_AUTH_ROUTE_BY_KIND.generic_onboarding_required,
    };
  }

  if (coachAccess.needsPaidPlanCheckout) {
    return {
      kind: 'coach_checkout_required',
      route: POST_AUTH_ROUTE_BY_KIND.coach_checkout_required,
    };
  }

  if (coachAccess.isApprovedCoach && !coachAccess.hasCurrentCoachAgreement) {
    return {
      kind: 'coach_agreement_required',
      route: POST_AUTH_ROUTE_BY_KIND.coach_agreement_required,
    };
  }

  return { kind: 'app_home', route: POST_AUTH_ROUTE_BY_KIND.app_home };
}

type OnboardingDraftSummary = {
  role: 'fan' | 'coach' | undefined;
  serverComplete: boolean;
  allComplete: boolean;
  calculatedStepIndex: number;
};

function summarizeOnboardingDraft(user: RoutingUserLike, state: OnboardingState): OnboardingDraftSummary {
  const role = state?.role as 'fan' | 'coach' | undefined;
  const calculatedStepIndex = nextIncompleteStep(state, role);
  const serverComplete =
    user.onboarding_completed === true || user.preferences?.onboarding_completed === true;
  const allComplete =
    role === 'coach'
      ? !!state?.role && !!state?.step_2_visited && !!(state?.join_request_pending || state?.organization_id)
      : !!state?.role && !!state?.step_2_visited;

  return {
    role,
    serverComplete,
    allComplete,
    calculatedStepIndex,
  };
}

export function getOnboardingIndexRouteDecision(
  user: RoutingUserLike,
  state: OnboardingState
): OnboardingIndexRouteDecision {
  const serverDirectedKind = resolveServerDirectedPostAuthKind(user);
  if (serverDirectedKind) {
    const serverKindMap: Record<PostAuthRouteKind, OnboardingIndexRouteKind> = {
      unauthenticated: 'draft_step_1',
      pending_verification: 'draft_step_1',
      email_verification_required: 'draft_step_1',
      server_application_required: 'server_application_required',
      server_application_submitted_waiting: 'server_application_submitted_waiting',
      server_application_submitted_fan_mode: 'server_application_submitted_fan_mode',
      server_application_rejected_waiting: 'server_application_rejected_waiting',
      server_application_rejected_fan_mode: 'server_application_rejected_fan_mode',
      server_pending_approval_league_waiting: 'server_pending_approval_league_waiting',
      server_pending_approval_waiting: 'server_pending_approval_waiting',
      server_pending_approval_fan_mode: 'server_pending_approval_fan_mode',
      server_coach_agreement_required: 'server_coach_agreement_required',
      server_final_setup_required: 'server_final_setup_required',
      pending_coach_waiting: 'draft_pending_waiting',
      approved_coach_finish_setup: 'draft_pending_waiting',
      generic_onboarding_required: 'draft_step_1',
      coach_checkout_required: 'completed_tabs',
      coach_agreement_required: 'server_coach_agreement_required',
      app_home: 'completed_tabs',
    };
    const kind = serverKindMap[serverDirectedKind];
    return { kind, route: ONBOARDING_INDEX_ROUTE_BY_KIND[kind] };
  }

  const draft = summarizeOnboardingDraft(user, state);

  if (draft.serverComplete && draft.allComplete) {
    return { kind: 'completed_tabs', route: ONBOARDING_INDEX_ROUTE_BY_KIND.completed_tabs };
  }

  if (!draft.serverComplete && draft.role === 'coach' && draft.allComplete) {
    const route = getPendingCoachRoute({
      preferences: {
        join_request_pending: state?.join_request_pending,
        organization_id: state?.organization_id,
      },
    }) as AppRoute;

    return {
      kind: 'draft_pending_waiting',
      route,
    };
  }

  const targetRoute = STEP_ROUTES[draft.calculatedStepIndex] as AppRoute;
  const kind =
    draft.calculatedStepIndex === 0
      ? 'draft_step_1'
      : draft.calculatedStepIndex === 1
        ? 'draft_step_2'
        : 'draft_step_3';

  return {
    kind,
    route: targetRoute,
    stepIndex: draft.calculatedStepIndex,
  };
}

export function getCoachAgreementRouteDecision(
  user: RoutingUserLike,
  redirect?: string | null
): CoachAgreementRouteDecision {
  const organizationId = String(
    user.preferences?.organization_id || (user as { organization_id?: string | null }).organization_id || ''
  ).trim();

  if (!organizationId) {
    return {
      kind: 'final_setup',
      route: COACH_AGREEMENT_ROUTE_BY_KIND.final_setup,
    };
  }

  if (redirect === 'create-team') {
    return {
      kind: 'create_team',
      route: COACH_AGREEMENT_ROUTE_BY_KIND.create_team,
      params: { organization_id: organizationId },
    };
  }

  return {
    kind: 'team_hub',
    route: COACH_AGREEMENT_ROUTE_BY_KIND.team_hub,
  };
}

export function getRouteFamily(route: string): string {
  if (route.startsWith('/verify')) return 'verify';
  if (route.startsWith('/sign-')) return 'sign-in';
  if (route.includes('manage-subscription') || route.includes('subscription-paywall')) return 'billing';
  if (route.includes('coach-agreement')) return 'coach-agreement';
  if (route.includes('pending-approval')) return 'pending-approval';
  if (route.includes('coach-application')) return 'coach-application';
  if (route.includes('step-3-league')) return 'step-3';
  if (route.includes('step-2-basic')) return 'step-2';
  if (route.includes('step-1-role')) return 'step-1';
  if (route.startsWith('/onboarding')) return 'onboarding';
  if (route.startsWith('/(tabs)')) return 'tabs';
  return route;
}
