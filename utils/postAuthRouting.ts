import { getPostAuthRouteDecision } from './appRouteDecisions';
import type { CoachUserLike } from './roleChecks';

type PostAuthPreferences = NonNullable<CoachUserLike['preferences']> & {
  onboarding_completed?: boolean;
};

export type PostAuthUserLike = CoachUserLike & {
  email_verified?: boolean | null;
  preferences?: PostAuthPreferences | null;
};

export function getPostAuthLandingRoute(user: PostAuthUserLike | null | undefined): string {
  return getPostAuthRouteDecision(user).route;
}
