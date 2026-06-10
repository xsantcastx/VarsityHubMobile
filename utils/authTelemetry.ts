import { analytics } from '@/utils/analytics';
import { markNextHistoryEntryAsRedirect } from '@/context/NavigationHistoryContext';
import { captureBreadcrumb } from '@/utils/sentry';
import type { Router } from 'expo-router';

type AuthRedirectTelemetryPayload = {
  from: string;
  to: string;
  reason: string;
  userStateFingerprint: string;
  userId?: string | null;
  role?: string | null;
  approvalStatus?: string | null;
  onboardingCompleted?: boolean | null;
  emailVerified?: boolean | null;
  pendingVerification?: boolean;
  healthOk?: boolean;
  paidByOwner?: boolean | null;
  proceedingAsFan?: boolean | null;
  coachAgreementAccepted?: boolean | null;
};

const normalizeSegment = (value: string | null | undefined) => {
  const trimmed = String(value || '').trim();
  return trimmed || 'none';
};

export function buildAuthRedirectFingerprint(payload: {
  role?: string | null;
  approvalStatus?: string | null;
  onboardingCompleted?: boolean | null;
  emailVerified?: boolean | null;
  pendingVerification?: boolean;
  healthOk?: boolean;
  from: string;
  paidByOwner?: boolean | null;
  proceedingAsFan?: boolean | null;
  coachAgreementAccepted?: boolean | null;
}) {
  return [
    `from:${normalizeSegment(payload.from)}`,
    `role:${normalizeSegment(payload.role)}`,
    `approval:${normalizeSegment(payload.approvalStatus)}`,
    `onboarding:${payload.onboardingCompleted === true ? 'done' : 'pending'}`,
    `verified:${payload.emailVerified === true ? 'yes' : 'no'}`,
    `pendingVerification:${payload.pendingVerification ? 'yes' : 'no'}`,
    `health:${payload.healthOk === false ? 'down' : 'ok'}`,
    `paidByOwner:${payload.paidByOwner === true ? 'yes' : 'no'}`,
    `proceedingAsFan:${payload.proceedingAsFan === true ? 'yes' : 'no'}`,
    `coachAgreement:${payload.coachAgreementAccepted === true ? 'yes' : 'no'}`,
  ].join('|');
}

export function logAuthRedirect(payload: AuthRedirectTelemetryPayload) {
  captureBreadcrumb('Auth redirect fired', 'auth.redirect', payload);
  analytics.track('auth_redirect_fired', payload);
}

export function navigateWithAuthRedirect(router: Router, payload: AuthRedirectTelemetryPayload) {
  logAuthRedirect(payload);
  markNextHistoryEntryAsRedirect();
  router.replace(payload.to as any);
}
