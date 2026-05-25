import type { OnboardingState } from '@/context/OnboardingContext';
import { STEP_ROUTES, nextIncompleteStep } from '@/context/onboardingReducer';
import {
  getCoachAccessState,
  getCoachOrganizationId,
  getPendingCoachRoute,
  isCoachOnboardingComplete,
  type CoachUserLike,
} from './roleChecks';
import { isProceedingAsFanSnapshot } from './authState';

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
  | '/(tabs)/create-team'
  | '/organization';

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
  | 'server_basic_info_required'
  | 'server_application_required'
  | 'server_application_submitted_waiting'
  | 'server_application_submitted_fan_mode'
  | 'server_application_rejected_waiting'
  | 'server_application_rejected_fan_mode'
  | 'server_pending_approval_league_waiting'
  | 'server_pending_approval_waiting'
  | 'server_pending_approval_fan_mode'
  | 'pending_coach_waiting'
  | 'generic_onboarding_required'
  | 'app_home';

export type PostAuthRouteDecision = {
  kind: PostAuthRouteKind;
  route: AppRoute;
};

const POST_AUTH_ROUTE_BY_KIND: Record<PostAuthRouteKind, AppRoute> = {
  unauthenticated: '/sign-in',
  pending_verification: '/verify',
  email_verification_required: '/verify',
  server_basic_info_required: '/onboarding/step-2-basic',
  server_application_required: '/onboarding/coach-application',
  server_application_submitted_waiting: '/onboarding/league-pending-approval',
  server_application_submitted_fan_mode: '/(tabs)',
  server_application_rejected_waiting: '/onboarding/league-pending-approval',
  server_application_rejected_fan_mode: '/(tabs)',
  server_pending_approval_league_waiting: '/onboarding/league-pending-approval',
  server_pending_approval_waiting: '/onboarding/pending-approval',
  server_pending_approval_fan_mode: '/(tabs)',
  pending_coach_waiting: '/onboarding/pending-approval',
  generic_onboarding_required: '/onboarding/step-1-role',
  app_home: '/(tabs)',
};

export type OnboardingIndexRouteKind =
  | 'server_basic_info_required'
  | 'server_application_required'
  | 'server_application_submitted_waiting'
  | 'server_application_submitted_fan_mode'
  | 'server_application_rejected_waiting'
  | 'server_application_rejected_fan_mode'
  | 'server_pending_approval_league_waiting'
  | 'server_pending_approval_waiting'
  | 'server_pending_approval_fan_mode'
  | 'completed_tabs'
  | 'draft_step_1'
  | 'draft_step_2'
  | 'draft_step_3';

export type OnboardingIndexRouteDecision = {
  kind: OnboardingIndexRouteKind;
  route: AppRoute;
  stepIndex?: number;
};

const ONBOARDING_INDEX_ROUTE_BY_KIND: Record<OnboardingIndexRouteKind, AppRoute> = {
  server_basic_info_required: '/onboarding/step-2-basic',
  server_application_required: '/onboarding/coach-application',
  server_application_submitted_waiting: '/onboarding/league-pending-approval',
  server_application_submitted_fan_mode: '/(tabs)',
  server_application_rejected_waiting: '/onboarding/league-pending-approval',
  server_application_rejected_fan_mode: '/(tabs)',
  server_pending_approval_league_waiting: '/onboarding/league-pending-approval',
  server_pending_approval_waiting: '/onboarding/pending-approval',
  server_pending_approval_fan_mode: '/(tabs)',
  completed_tabs: '/(tabs)',
  draft_step_1: '/onboarding/step-1-role',
  draft_step_2: '/onboarding/step-2-basic',
  draft_step_3: '/onboarding/step-3-league',
};

export type CoachAgreementRouteKind = 'final_setup' | 'create_team' | 'team_hub';

export type CoachAgreementRouteDecision = {
  kind: CoachAgreementRouteKind;
  route: AppRoute;
  params?: Record<string, string>;
};

type ServerDirectedPostAuthRouteKind =
  | 'server_basic_info_required'
  | 'server_application_required'
  | 'server_application_submitted_waiting'
  | 'server_application_submitted_fan_mode'
  | 'server_application_rejected_waiting'
  | 'server_application_rejected_fan_mode'
  | 'server_pending_approval_league_waiting'
  | 'server_pending_approval_waiting'
  | 'server_pending_approval_fan_mode'
  | 'server_coach_agreement_required'
  | 'server_final_setup_required';

const COACH_AGREEMENT_ROUTE_BY_KIND: Record<CoachAgreementRouteKind, AppRoute> = {
  final_setup: '/onboarding/step-3-league',
  create_team: '/(tabs)/create-team',
  team_hub: '/organization',
};

function resolveServerDirectedPostAuthKind(user: RoutingUserLike): ServerDirectedPostAuthRouteKind | null {
  const accountState = String(user.account_state || '').trim();
  const explicitNextStep =
    typeof user.next_step === 'string' && user.next_step.trim().startsWith('/')
      ? (user.next_step.trim() as AppRoute)
      : null;
  const isProceedingAsFan = isProceedingAsFanSnapshot(user as any);

  switch (accountState) {
    case 'coach_basic_info_required':
      return 'server_basic_info_required';
    case 'coach_application_required':
      return explicitNextStep === '/onboarding/step-2-basic'
        ? 'server_basic_info_required'
        : 'server_application_required';
    case 'coach_application_submitted':
      return isProceedingAsFan || explicitNextStep === '/(tabs)'
        ? 'server_application_submitted_fan_mode'
        : 'server_application_submitted_waiting';
    case 'coach_application_rejected':
      return isProceedingAsFan || explicitNextStep === '/(tabs)'
        ? 'server_application_rejected_fan_mode'
        : 'server_application_rejected_waiting';
    case 'coach_pending_approval':
      return isProceedingAsFan || explicitNextStep === '/(tabs)'
        ? 'server_pending_approval_fan_mode'
        : explicitNextStep === '/onboarding/league-pending-approval'
          ? 'server_pending_approval_league_waiting'
          : 'server_pending_approval_waiting';
    default:
      return null;
  }
}

function resolvePendingRouteKind(route: string, baseKind: 'pending_coach_waiting'): PostAuthRouteKind {
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
    const needsOnboarding = !isCoachOnboardingComplete(user);
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
  const needsOnboarding = !isCoachOnboardingComplete(user);

  if ((coachAccess.isPendingCoach || coachAccess.isRejectedCoach) && !coachAccess.isProceedingAsFan) {
    const route = getPendingCoachRoute(user) as AppRoute;
    return {
      kind: resolvePendingRouteKind(route, 'pending_coach_waiting'),
      route,
    };
  }

  if ((coachAccess.isPendingCoach || coachAccess.isRejectedCoach) && coachAccess.isProceedingAsFan) {
    return { kind: 'app_home', route: POST_AUTH_ROUTE_BY_KIND.app_home };
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

  if (needsOnboarding && coachAccess.isApprovedCoach) {
    const route = getPendingCoachRoute(user) as AppRoute;
    return {
      kind: resolvePendingRouteKind(route, 'approved_coach_finish_setup'),
      route,
    };
  }

  if (needsOnboarding && !coachAccess.isApprovedCoach) {
    return {
      kind: 'generic_onboarding_required',
      route: POST_AUTH_ROUTE_BY_KIND.generic_onboarding_required,
    };
  }

  return { kind: 'app_home', route: POST_AUTH_ROUTE_BY_KIND.app_home };
}

type OnboardingDraftSummary = {
  role: 'fan' | 'coach' | undefined;
  serverComplete: boolean;
  calculatedStepIndex: number;
};

function summarizeOnboardingDraft(user: RoutingUserLike, state: OnboardingState): OnboardingDraftSummary {
  const role = state?.role as 'fan' | 'coach' | undefined;
  const calculatedStepIndex = nextIncompleteStep(state, role);
  const serverComplete = isCoachOnboardingComplete(user);

  return {
    role,
    serverComplete,
    calculatedStepIndex,
  };
}

export function getOnboardingIndexRouteDecision(
  user: RoutingUserLike,
  state: OnboardingState
): OnboardingIndexRouteDecision {
  const serverDirectedKind = resolveServerDirectedPostAuthKind(user);
  if (serverDirectedKind) {
    const serverKindMap: Record<ServerDirectedPostAuthRouteKind, OnboardingIndexRouteKind> = {
      server_basic_info_required: 'server_basic_info_required',
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
    };
    const kind = serverKindMap[serverDirectedKind];
    return { kind, route: ONBOARDING_INDEX_ROUTE_BY_KIND[kind] };
  }

  const draft = summarizeOnboardingDraft(user, state);

  if (draft.serverComplete) {
    return { kind: 'completed_tabs', route: ONBOARDING_INDEX_ROUTE_BY_KIND.completed_tabs };
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
    getCoachOrganizationId(user) || ''
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
