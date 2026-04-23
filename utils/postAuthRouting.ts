import { getCoachAccessState, getPendingCoachRoute, type CoachUserLike } from './roleChecks';

type PostAuthPreferences = NonNullable<CoachUserLike['preferences']> & {
  onboarding_completed?: boolean;
};

export type PostAuthUserLike = CoachUserLike & {
  email_verified?: boolean | null;
  preferences?: PostAuthPreferences | null;
};

export function getPostAuthLandingRoute(user: PostAuthUserLike | null | undefined): string {
  if (!user) return '/sign-in';
  if (user.email_verified !== true) return '/verify';

  const coachAccess = getCoachAccessState(user);
  const needsOnboarding = user.preferences?.onboarding_completed !== true;

  if (
    (coachAccess.isPendingCoach || coachAccess.isRejectedCoach) &&
    !coachAccess.isProceedingAsFan
  ) {
    return getPendingCoachRoute(user);
  }

  if (needsOnboarding && coachAccess.isApprovedCoach) {
    return getPendingCoachRoute(user);
  }

  if (needsOnboarding) {
    return '/onboarding/step-1-role';
  }

  if (coachAccess.needsPaidPlanCheckout) {
    return '/settings/manage-subscription';
  }

  if (coachAccess.isApprovedCoach && !coachAccess.hasCurrentCoachAgreement) {
    return '/onboarding/coach-agreement';
  }

  return '/(tabs)';
}
