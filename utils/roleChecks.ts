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
  const accountState = normalizeString(user?.account_state);
  const acceptedCoachAgreementVersion = normalizeNumber(preferences?.coach_agreement_version, 1);
  const requiredCoachAgreementVersion = normalizeNumber(user?.required_coach_agreement_version, 1);
  const pendingPlan = normalizeString(
    preferences?.pending_plan ?? preferences?.plan
  )?.toLowerCase();
  const organizationId = getCoachOrganizationId(user);
  const isCoach = role === 'coach';
  const isApprovedCoach = isCoach && approvalStatus === 'APPROVED';
  const isPendingCoach = isCoach && approvalStatus === 'PENDING';
  const isRejectedCoach = isCoach && approvalStatus === 'REJECTED';
  const isProceedingAsFan = isProceedingAsFanSnapshot(user as any) && approvalStatus !== 'APPROVED';
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
  const isServerBlockedCoachState =
    accountState !== null &&
    [
      'coach_basic_info_required',
      'coach_application_required',
      'coach_application_submitted',
      'coach_application_rejected',
      'coach_pending_approval',
      'coach_agreement_required',
      'coach_final_setup_required',
    ].includes(accountState);
  const canAccessCoachTools =
    isApprovedCoach &&
    hasCurrentCoachAgreement &&
    Boolean(organizationId) &&
    !isServerBlockedCoachState;

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
    canAccessCoachTools,
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

function getMatchingMembership<
  T extends {
    status?: string | null;
    user_id?: string | null;
    user?: { id?: string | null } | null;
  },
>(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: T[] | null | undefined
): T | null {
  if (!user?.id || !Array.isArray(memberships)) return null;

  return (
    memberships.find(m => {
      const memberUserId = m?.user?.id || m?.user_id;
      if (!memberUserId || memberUserId !== user.id) return false;
      const status = String(m?.status || 'active').toLowerCase();
      return status === 'active';
    }) || null
  );
}

function getMatchingOrgMembership(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined
): OrgMembershipLike | null {
  return getMatchingMembership(user, memberships);
}

function getMatchingTeamMembership(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: TeamMembershipLike[] | null | undefined
): TeamMembershipLike | null {
  return getMatchingMembership(user, memberships);
}

export function getOrganizationAccess(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined
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
  orgMemberships: OrgMembershipLike[] | null | undefined
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

/**
 * Client mirror of the server's `canAssignTeamRole`
 * (`server/src/lib/teamAuthorization.ts:124`). Given the acting user's team role
 * and org-admin status, returns which of `candidateRoles` they may assign:
 *   - `owner`   → never here (ownership changes go through transfer-ownership)
 *   - `manager` → only a team owner or an org admin
 *   - any other → allowed
 *
 * The server remains the authority (every role write is 403-guarded); this keeps
 * the FE picker from offering roles the server will reject, closing the
 * dead-end where a coach could tap "Manager" and only learn on the 403.
 */
export function getAssignableTeamRoles<T extends string>(
  actor: { teamRole?: string | null; isOrgAdmin?: boolean } | null | undefined,
  candidateRoles: readonly T[]
): T[] {
  const teamRole = String(actor?.teamRole || '').toLowerCase();
  const canAssignManager = teamRole === 'owner' || actor?.isOrgAdmin === true;
  return candidateRoles.filter(role => {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'owner') return false;
    if (normalized === 'manager') return canAssignManager;
    return true;
  });
}

export function isOrganizationOwner(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined
): boolean {
  return getOrganizationAccess(user, memberships).isOwner;
}

export function isOrganizationAdminMember(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined
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
  memberships: OrgMembershipLike[] | null | undefined
): boolean {
  if (!user) return false;
  if (user.is_admin === true) return true;

  const access = getCoachAccessState(user);
  if (!access.canAccessCoachTools) return false;

  return isOrganizationAdminMember(user, memberships);
}

export function canReviewCoachRequests(
  user: (CoachUserLike & { id?: string | null }) | null | undefined,
  memberships: OrgMembershipLike[] | null | undefined
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
    return '/(tabs)/feed';
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
      'coach_agreement_required',
      'coach_final_setup_required',
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

  if (accountState === 'coach_agreement_required') {
    return '/onboarding/coach-agreement';
  }

  if (accountState === 'coach_final_setup_required') {
    return '/onboarding/step-3-league';
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

  if (
    (coachAccess.isPendingCoach || coachAccess.isRejectedCoach) &&
    !coachAccess.isProceedingAsFan
  ) {
    return getPendingCoachRoute(user);
  }

  // Approved coaches are never forced into recovery routes here (see
  // roleChecks.test.ts) — callers like useRequireCoach decide their own
  // agreement/landing fallbacks.
  return null;
}

/**
 * Resolve a never-null destination for a "Finish Setup" CTA shown to an
 * approved coach who cannot yet access coach tools.
 *
 * getCoachRecoveryRoute intentionally returns null for approved coaches whose
 * only gap is a stale agreement or a missing org link (their approval is
 * done). A CTA that pushes its raw result would be a no-op in exactly those
 * cases. This mirrors the fallback the canonical guard useRequireCoach uses so
 * both surfaces agree: stale agreement -> agreement screen; otherwise the app.
 */
export function getCoachFinishSetupRoute(user: CoachUserLike | null | undefined): string {
  const recoveryRoute = getCoachRecoveryRoute(user);
  if (recoveryRoute) return recoveryRoute;

  const coachAccess = getCoachAccessState(user);
  return coachAccess.hasCurrentCoachAgreement ? '/(tabs)/feed' : '/onboarding/coach-agreement';
}

/**
 * Pure form of the redirect decision made by the `useRequireCoach` guard.
 *
 * Returns the route a coach-gated screen should redirect to, or null when the
 * user is allowed to stay. Extracted so both `useRequireCoach` and the
 * membership-aware `useRequireTeamManagement` guard share one implementation
 * and can never drift. Mirrors the hook's effect exactly:
 *   - admin with dirty pending/rejected coach state  -> feed
 *   - non-coach (or no user)                          -> feed
 *   - coach proceeding as fan                         -> feed
 *   - coach without tools access                      -> recovery route / fallback
 *   - otherwise                                       -> null (allowed)
 */
export function getCoachGuardRedirect(user: CoachUserLike | null | undefined): string | null {
  const coachAccess = getCoachAccessState(user);
  const isAdmin = user?.is_admin === true;

  if (isAdmin && (coachAccess.isPendingCoach || coachAccess.isRejectedCoach)) {
    return '/(tabs)/feed';
  }
  if (!user || !coachAccess.isCoach) {
    return '/(tabs)/feed';
  }
  if (coachAccess.isProceedingAsFan) {
    return '/(tabs)/feed';
  }

  const canAccessCoachTools = coachAccess.canAccessCoachTools && !coachAccess.needsPaidPlanCheckout;
  if (!canAccessCoachTools) {
    const recoveryRoute = getCoachRecoveryRoute(user);
    const fallback = coachAccess.isApprovedCoach
      ? coachAccess.hasCurrentCoachAgreement
        ? '/(tabs)/feed'
        : '/onboarding/coach-agreement'
      : '/onboarding/pending-approval';
    return recoveryRoute || fallback;
  }

  return null;
}

/**
 * Access decision for team-management surfaces (manage-teams, my-team,
 * team-hub, team-admin, manage-users, manage-season, ...).
 *
 * Coaches keep their EXACT existing guard semantics (agreement/approval/billing
 * gates are intentional and unchanged). The only thing this adds on top of the
 * coach guard is a membership escape hatch for NON-coach users: a fan-role
 * member who holds a team-staff membership (owner/manager/coach/assistant_coach)
 * or is an org owner/manager may manage — mirroring the server's
 * `canManageTeam` rule (which is membership-based, not user-role-based).
 *
 * `managedTeamCount` / `orgAdminCount` come from the membership-filtered
 * `Team.managed()` and `Organization.reviewSummaries()` responses, so the
 * `equipment`/`health_wellness` authorized roles are correctly excluded — they
 * are billing/roster staff, not managers, exactly as the server treats them.
 */
export function resolveTeamManagementAccess(params: {
  user: CoachUserLike | null | undefined;
  managedTeamCount: number;
  orgAdminCount: number;
}): { allow: boolean; redirectTo: string | null } {
  const { user, managedTeamCount, orgAdminCount } = params;

  const coachRedirect = getCoachGuardRedirect(user);
  if (coachRedirect === null) {
    return { allow: true, redirectTo: null };
  }

  // Coaches retain their coach-guard redirect untouched.
  if (getCoachAccessState(user).isCoach) {
    return { allow: false, redirectTo: coachRedirect };
  }

  // Non-coach members: allow when they actually manage something.
  if (managedTeamCount > 0 || orgAdminCount > 0) {
    return { allow: true, redirectTo: null };
  }

  return { allow: false, redirectTo: coachRedirect };
}

export function getCoachApprovalNotificationRoute(user: CoachUserLike | null | undefined): string {
  if (!user) {
    return '/onboarding/coach-agreement';
  }

  if (user.is_admin === true) {
    return '/(tabs)/feed';
  }

  const coachAccess = getCoachAccessState(user);
  if (coachAccess.isProceedingAsFan) {
    return '/(tabs)/feed';
  }

  const explicitNextStep =
    typeof user.next_step === 'string' && user.next_step.trim().startsWith('/')
      ? user.next_step.trim()
      : null;
  const accountState = normalizeString(user.account_state);
  if (
    explicitNextStep &&
    accountState &&
    ['coach_agreement_required', 'coach_final_setup_required'].includes(accountState)
  ) {
    return explicitNextStep;
  }

  if (coachAccess.hasAcceptedCoachAgreement) {
    return getCoachOrganizationId(user) ? '/organization' : '/(tabs)/feed';
  }

  return '/onboarding/coach-agreement';
}
