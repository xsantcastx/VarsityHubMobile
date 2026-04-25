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
  paid_by_owner?: boolean;
  is_admin?: boolean;
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

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getCoachAccessState(user: CoachUserLike | null | undefined): CoachAccessState {
  const preferences = user?.preferences ?? null;
  const role = normalizeString(preferences?.role) ?? normalizeString(user?.role);
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
  const isProceedingAsFan = preferences?.proceeding_as_fan === true && approvalStatus !== 'APPROVED';
  const onboardingCompleted = preferences?.onboarding_completed === true;
  const hasAcceptedCoachAgreement = !!preferences?.coach_agreement_accepted_at;
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
    canAccessCoachTools: isApprovedCoach && hasCurrentCoachAgreement,
    requiredCoachAgreementVersion,
    acceptedCoachAgreementVersion,
    needsPaidPlanCheckout,
  };
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
  if (preferences?.organization_id) {
    return '/onboarding/league-pending-approval';
  }
  return '/onboarding/pending-approval';
}

export function getCoachRecoveryRoute(user: CoachUserLike | null | undefined): string | null {
  const explicitNextStep =
    typeof user?.next_step === 'string' && user.next_step.trim().startsWith('/')
      ? user.next_step.trim()
      : null;
  const accountState = normalizeString(user?.account_state);

  if (
    explicitNextStep &&
    accountState &&
    [
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

  if (accountState === 'coach_agreement_required') {
    return '/onboarding/coach-agreement';
  }

  if (accountState === 'coach_final_setup_required') {
    return '/onboarding/step-3-league';
  }

  const coachAccess = getCoachAccessState(user);

  if (coachAccess.isProceedingAsFan) {
    return '/(tabs)';
  }

  if ((coachAccess.isPendingCoach || coachAccess.isRejectedCoach) && !coachAccess.isProceedingAsFan) {
    return getPendingCoachRoute(user);
  }

  if (coachAccess.isApprovedCoach && !coachAccess.hasCurrentCoachAgreement) {
    return '/onboarding/coach-agreement';
  }

  return null;
}
