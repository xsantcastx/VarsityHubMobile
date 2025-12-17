export const ONBOARDING_STEP_ROUTES = [
  '/onboarding/step-1-role',
  '/onboarding/step-2-basic',
  '/onboarding/step-3-plan',
  '/onboarding/step-4-organization',
  '/onboarding/step-6-authorized-users',
  '/onboarding/step-7-profile',
  '/onboarding/step-8-interests',
  '/onboarding/step-9-features',
  '/onboarding/step-10-confirmation',
] as const;

export const OnboardingStepIndex = {
  Role: 0,
  BasicInfo: 1,
  Plan: 2,
  Organization: 3,
  AuthorizedUsers: 4,
  Profile: 5,
  Interests: 6,
  Features: 7,
  Confirmation: 8,
} as const;

export type OnboardingStepIndexValue = typeof OnboardingStepIndex[keyof typeof OnboardingStepIndex];

export const MAX_ONBOARDING_STEP_INDEX = ONBOARDING_STEP_ROUTES.length - 1;

export function getOnboardingRouteForProgress(progress: number) {
  if (progress < 0 || progress > MAX_ONBOARDING_STEP_INDEX) {
    return ONBOARDING_STEP_ROUTES[0];
  }
  return ONBOARDING_STEP_ROUTES[progress];
}
