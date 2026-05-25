import {
  getCanonicalOrganizationId,
  getCanonicalRole,
  hasAcceptedCoachAgreement as hasAcceptedCoachAgreementSnapshot,
  isOnboardingCompleteSnapshot,
  isProceedingAsFanSnapshot,
} from './authState';

type CoachPreferencesLike = {
  role?: string | null;
  onboarding_completed?: boolean;
  payment_pending?: boolean;
  payment_approved?: boolean;
  join_request_pending?: boolean;
  proceeding_as_fan?: boolean;
  coach_agreement_accepted_at?: string | null;
  coach_agreement_version?: number | string | null;
  pending_plan?: string | null;
  plan?: string | null;
  organization_id?: string | null;
};

export type CoachUserLike = {
  role?: string | null;
  approval_status?: string | null;
  account_state?: string | null;
  next_step?: string | null;
  proceeding_as_fan?: boolean | null;
  paid_by_owner?: boolean;
  is_admin?: boolean;
  onboarding_completed?: boolean | null;
  organization_id?: string | null;
  required_coach_agreement_version?: number | string | null;
  preferences?: CoachPreferencesLike | null;
};

export type CoachAccessState = {
  role: string | null;
  approvalStatus: string | null;
  isCoach: boolean;
  isApprovedCoach: boolean;
  isPendingCoach: boolean;
  isRejectedCoach: boolean;
  isProceedingAsFan: boolean;
  onboardingCompleted: boolean;
  hasAcceptedCoachAgreement: boolean;
  hasCurrentCoachAgreement: boolean;
  canAccessCoachTools: boolean;
  requiredCoachAgreementVersion: number;
  acceptedCoachAgreementVersion: number;
  needsPaidPlanCheckout: boolean;
};

export function canAccessCreateTeamSurface(
  user: CoachUserLike | null | undefined,
  options?: { hasManagedOrganizationAccess?: boolean }
): boolean {
  if (!user) return false;

  const coachAccess = getCoachAccessState(user);
  if (coachAccess.isProceedingAsFan || coachAccess.needsPaidPlanCheckout) {
    return false;
  }

  if (coachAccess.canAccessCoachTools) {
    return true;
  }

  return !coachAccess.isCoach && options?.hasManagedOrganizationAccess === true;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getCanonicalCoachRole(user: CoachUserLike | null | undefined): string | null {
  return getCanonicalRole(user as any);
}

export function isCoachOnboardingComplete(user: CoachUserLike | null | undefined): boolean {
  return isOnboardingCompleteSnapshot(user as any);
}

export function getCoachOrganizationId(user: CoachUserLike | null | undefined): string | null {
  return getCanonicalOrganizationId(user as any);
}

export function getCoachAccessState(user: CoachUserLike | null | undefined): CoachAccessState {
  const preferences = user?.preferences ?? null;
  const role = getCanonicalCoachRole(user);
  const approvalStatus = normalizeString(user?.approval_status);
  const acceptedCoachAgreementVersion = normalizeNumber(
    preferences?.coach_agreement_version,
    1
  );
  const requiredCoachAgreementVersion = normalizeNumber(
    user?.required_coach_agreement_version,
    1
  );
  const pendingPlan = normalizeString(preferences?.pending_plan ?? preferences?.plan)?.toLowerCase();
  const isCoach = role === 'coach';
  const isApprovedCoach = isCoach && approvalStatus === 'APPROVED';
  const isPendingCoach = isCoach && approvalStatus === 'PENDING';
  const isRejectedCoach = isCoach && approvalStatus === 'REJECTED';
  const isProceedingAsFan =
    isProceedingAsFanSnapshot(user as any) && approvalStatus !== 'APPROVED';
  const onboardingCompleted = isCoachOnboardingComplete(user);
  const hasAcceptedCoachAgreement = hasAcceptedCoachAgreementSnapshot(user as any);
  const hasCurrentCoachAgreement =
    isApprovedCoach &&
    hasAcceptedCoachAgreement &&
    acceptedCoachAgreementVersion >= requiredCoachAgreementVersion;
  const needsPaidPlanCheckout =
    isApprovedCoach &&
    user?.paid_by_owner !== true &&
    preferences?.payment_pending === true &&
    (pendingPlan === 'veteran' || pendingPlan === 'legend') &&
    (preferences?.payment_approved === true || preferences?.join_request_pending !== true);

  return {
    role,
    approvalStatus,
    isCoach,
    isApprovedCoach,
    isPendingCoach,
    isRejectedCoach,
    isProceedingAsFan,
    onboardingCompleted,
    hasAcceptedCoachAgreement,
    hasCurrentCoachAgreement,
    canAccessCoachTools: isApprovedCoach,
    requiredCoachAgreementVersion,
    acceptedCoachAgreementVersion,
    needsPaidPlanCheckout,
  };
}

type OrgMembershipLike = {
  role?: string | null;
  status?: string | null;
  user_id?: string | null;
  user?: { id?: string | null } | null;
};

type TeamMembershipLike = {
  role?: string | null;
  status?: string | null;
  user_id?: string | null;
  user?: { id?: string | null } | null;
};

export const TEAM_STAFF_ROLES = ['owner', 'manager', 'coach', 'assistant_coach'] as const;

function getMatchingMembership<T extends {
  status?: string | null;
  user_id?: string | null;
  user?: { id?: string | null } | null;
}>(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: T[] | null | undefined,
): T | null {
  if (!user?.id || !Array.isArray(memberships)) return null;

  return (
    memberships.find((m) => {
      const memberUserId = m?.user?.id || m?.user_id;
      if (!memberUserId || memberUserId !== user.id) return false;
      const status = String(m?.status || 'active').toLowerCase();
      return status === 'active';
    }) || null
  );
}

function getMatchingOrgMembership(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined,
): OrgMembershipLike | null {
  return getMatchingMembership(user, memberships);
}

function getMatchingTeamMembership(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: TeamMembershipLike[] | null | undefined,
): TeamMembershipLike | null {
  return getMatchingMembership(user, memberships);
}

export function getOrganizationAccess(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined,
) {
  if (user?.is_admin === true) {
    return {
      membership: null,
      role: 'owner' as const,
      isMember: true,
      isOwner: true,
      isAdmin: true,
    };
  }

  const membership = getMatchingOrgMembership(user, memberships);
  const role = String(membership?.role || '').toLowerCase();
  const isMember = Boolean(membership);
  const isOwner = role === 'owner';
  const isAdmin = isOwner || role === 'manager';

  return {
    membership,
    role,
    isMember,
    isOwner,
    isAdmin,
  };
}

export function getTeamManagementAccess(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  teamMemberships: TeamMembershipLike[] | null | undefined,
  orgMemberships: OrgMembershipLike[] | null | undefined,
) {
  if (user?.is_admin === true) {
    return {
      teamMembership: null,
      teamRole: 'owner' as const,
      isTeamStaff: true,
      isTeamOwner: true,
      isOrgAdmin: true,
      canManageTeam: true,
    };
  }

  const teamMembership = getMatchingTeamMembership(user, teamMemberships);
  const teamRole = String(teamMembership?.role || '').toLowerCase();
  const isTeamStaff = TEAM_STAFF_ROLES.includes(teamRole as (typeof TEAM_STAFF_ROLES)[number]);
  const isTeamOwner = teamRole === 'owner';
  const orgAccess = getOrganizationAccess(user, orgMemberships);

  return {
    teamMembership,
    teamRole,
    isTeamStaff,
    isTeamOwner,
    isOrgAdmin: orgAccess.isAdmin,
    canManageTeam: isTeamStaff || orgAccess.isAdmin,
  };
}

export function isOrganizationOwner(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined,
): boolean {
  return getOrganizationAccess(user, memberships).isOwner;
}

export function isOrganizationAdminMember(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined,
): boolean {
  return getOrganizationAccess(user, memberships).isAdmin;
}

/**
 * Single source of truth for "is this user allowed to use org-admin UI."
 *
 * Combines two checks the codebase had been doing inconsistently:
 *   1. The user holds an owner/manager membership in the org.
 *   2. The user is currently allowed to use coach tools at all (approved
 *      coach by approval status, OR is_admin=true god-override).
 *
 * Without (2), a pending or rejected coach who still has membership
 * left over from a prior approved state could see and tap admin CTAs
 * (review join requests, edit org, etc.) and only discover the denial
 * on the eventual API 403. That UX leak — and the broader inconsistency
 * across organization.tsx, league.tsx, edit-organization.tsx, and
 * organization-join-requests.tsx — is what this helper fixes.
 */
export function canManageOrgAsCoach(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined,
): boolean {
  if (!user) return false;
  if (user.is_admin === true) return true;

  const access = getCoachAccessState(user);
  if (!access.canAccessCoachTools) return false;

  return isOrganizationAdminMember(user, memberships);
}

export function canReviewCoachRequests(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined,
): boolean {
  if (!user) return false;

  const access = getCoachAccessState(user);
  if (!access.canAccessCoachTools) return false;

  return isOrganizationOwner(user, memberships);
}

export function getPendingCoachRoute(user: CoachUserLike | null | undefined): string {
  const explicitNextStep =
    typeof user?.next_step === 'string' && user.next_step.trim().startsWith('/')
      ? user.next_step.trim()
      : null;
  if (explicitNextStep) {
    return explicitNextStep;
  }
  const preferences = user?.preferences ?? null;
  if (preferences?.join_request_pending === true) {
    return '/onboarding/pending-approval';
  }
  if (getCoachOrganizationId(user)) {
    return '/onboarding/league-pending-approval';
  }
  return '/onboarding/pending-approval';
}

export function getCoachRecoveryRoute(user: CoachUserLike | null | undefined): string | null {
  if (user?.is_admin === true) {
    return null;
  }

  const coachAccess = getCoachAccessState(user);
  if (coachAccess.isProceedingAsFan) {
    return '/(tabs)';
  }

  const explicitNextStep =
    typeof user?.next_step === 'string' && user.next_step.trim().startsWith('/')
      ? user.next_step.trim()
      : null;
  const accountState = normalizeString(user?.account_state);

  if (
    explicitNextStep &&
    accountState &&
    [
      'coach_basic_info_required',
      'coach_application_required',
      'coach_application_submitted',
      'coach_application_rejected',
      'coach_pending_approval',
    ].includes(accountState)
  ) {
    return explicitNextStep;
  }

  if (accountState === 'coach_basic_info_required') {
    return '/onboarding/step-2-basic';
  }

  if (accountState === 'coach_application_required') {
    return '/onboarding/coach-application';
  }

  if (
    accountState === 'coach_application_submitted' ||
    accountState === 'coach_application_rejected' ||
    accountState === 'coach_pending_approval'
  ) {
    return getPendingCoachRoute(user);
  }

  if (coachAccess.needsPaidPlanCheckout) {
    return '/settings/manage-subscription';
  }

  if ((coachAccess.isPendingCoach || coachAccess.isRejectedCoach) && !coachAccess.isProceedingAsFan) {
    return getPendingCoachRoute(user);
  }

  return null;
}

export function getCoachApprovalNotificationRoute(user: CoachUserLike | null | undefined): string {
  if (!user) {
    return '/onboarding/coach-agreement';
  }

  if (user.is_admin === true) {
    return '/(tabs)';
  }

  const coachAccess = getCoachAccessState(user);
  if (coachAccess.isProceedingAsFan) {
    return '/(tabs)';
  }

  if (coachAccess.hasAcceptedCoachAgreement) {
    return getCoachOrganizationId(user) ? '/organization' : '/(tabs)';
  }

  return '/onboarding/coach-agreement';
}
