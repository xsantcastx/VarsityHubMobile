import type { CoachApplication, PrismaClient } from '@prisma/client';
import {
  getCanonicalOrganizationId,
  getCanonicalUserRole,
  isProceedingAsFan,
  isUserOnboardingComplete,
} from './userAuthState.js';

type CoachApplicationRecord = Pick<
  CoachApplication,
  | 'id'
  | 'status'
  | 'organization_name'
  | 'org_type'
  | 'location'
  | 'zip_code'
  | 'place_id'
  | 'supporting_document_url'
  | 'background_url'
  | 'payload'
  | 'submitted_at'
  | 'reviewed_at'
  | 'reviewed_by'
  | 'review_note'
  | 'created_at'
  | 'updated_at'
>;

type CoachFlowUser = {
  approval_status?: string | null;
  preferences?: unknown;
  role?: string | null;
  onboarding_completed?: boolean | null;
  organization_id?: string | null;
  proceeding_as_fan?: boolean | null;
  coach_agreement_accepted_at?: Date | string | null;
  coach_agreement_version?: number | null;
  username?: string | null;
  date_of_birth?: Date | string | null;
  zip_code?: string | null;
};

type OrganizationJoinRequestLike = {
  status?: string | null;
  organization_id?: string | null;
} | null | undefined;

export type CoachAccountState =
  | 'fan_onboarding'
  | 'fan_active'
  | 'coach_basic_info_required'
  | 'coach_application_required'
  | 'coach_application_submitted'
  | 'coach_application_rejected'
  | 'coach_pending_approval'
  | 'coach_active';

export function serializeCoachApplication(
  application: CoachApplicationRecord | null | undefined,
): CoachApplicationRecord | null {
  if (!application) return null;
  return {
    ...application,
    payload:
      application.payload && typeof application.payload === 'object' ? application.payload : {},
  };
}

export async function getLatestCoachApplication(
  prisma: PrismaClient,
  userId: string,
): Promise<CoachApplicationRecord | null> {
  return prisma.coachApplication.findFirst({
    where: {
      user_id: userId,
      status: { in: ['submitted', 'approved', 'rejected'] },
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
}

export function getCoachFlowState(
  user: CoachFlowUser | null | undefined,
  application: CoachApplicationRecord | null | undefined,
  joinRequest?: OrganizationJoinRequestLike,
): {
  account_state: CoachAccountState;
  next_step: string;
} {
  const role = getCanonicalUserRole(user as any);
  const approvalStatus = String(user?.approval_status || '').toUpperCase();
  const onboardingCompleted = isUserOnboardingComplete(user as any);
  const organizationId = getCanonicalOrganizationId(user as any);
  const proceedingAsFan = isProceedingAsFan(user as any);
  const prefs = (user?.preferences && typeof user.preferences === 'object'
    ? (user.preferences as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const username = String(user?.username || prefs.username || '').trim();
  const dateOfBirth = user?.date_of_birth || prefs.dob || null;
  const hasCompletedBasicInfo = Boolean(username && dateOfBirth);
  const joinRequestStatus = String(joinRequest?.status || '').trim().toLowerCase();
  const hasOrganizationJoinRequest = Boolean(joinRequest?.organization_id);
  const pendingFanModeNextStep = '/(tabs)';

  if (role !== 'coach') {
    return onboardingCompleted
      ? { account_state: 'fan_active', next_step: '/(tabs)' }
      : { account_state: 'fan_onboarding', next_step: '/onboarding/step-1-role' };
  }

  if (approvalStatus === 'REJECTED') {
    if (hasOrganizationJoinRequest) {
      return {
        account_state: 'coach_pending_approval',
        next_step: proceedingAsFan ? pendingFanModeNextStep : '/onboarding/pending-approval',
      };
    }
    if (application?.status === 'rejected' && !organizationId) {
      return {
        account_state: 'coach_application_rejected',
        next_step: proceedingAsFan ? pendingFanModeNextStep : '/onboarding/league-pending-approval',
      };
    }
    return {
      account_state: 'coach_pending_approval',
      next_step: proceedingAsFan
        ? pendingFanModeNextStep
        : organizationId
          ? '/onboarding/league-pending-approval'
          : '/onboarding/pending-approval',
    };
  }

  if (approvalStatus === 'PENDING') {
    if (application?.status === 'submitted' && !organizationId) {
      return {
        account_state: 'coach_application_submitted',
        next_step: proceedingAsFan ? pendingFanModeNextStep : '/onboarding/league-pending-approval',
      };
    }
    if (hasOrganizationJoinRequest || joinRequestStatus === 'pending' || joinRequestStatus === 'denied') {
      return {
        account_state: 'coach_pending_approval',
        next_step: proceedingAsFan ? pendingFanModeNextStep : '/onboarding/pending-approval',
      };
    }
    if (!hasCompletedBasicInfo && !organizationId && !proceedingAsFan) {
      return {
        account_state: 'coach_basic_info_required',
        next_step: '/onboarding/step-2-basic',
      };
    }
    if (organizationId || proceedingAsFan) {
      return {
        account_state: 'coach_pending_approval',
        next_step: proceedingAsFan
          ? pendingFanModeNextStep
          : organizationId
            ? '/onboarding/league-pending-approval'
            : '/onboarding/pending-approval',
      };
    }
    return {
      account_state: 'coach_application_required',
      next_step: '/onboarding/coach-application',
    };
  }

  return {
    account_state: 'coach_active',
    next_step: '/(tabs)',
  };
}
