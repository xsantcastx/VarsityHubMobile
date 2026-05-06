import {
  type CoachUserLike,
  getCoachAccessState,
  getCoachRecoveryRoute,
  getPendingCoachRoute,
} from './roleChecks';

export type CoachUpgradeCta =
  | {
      kind: 'upgrade';
      title: string;
      subtitle: string;
      route: null;
    }
  | {
      kind: 'resume';
      title: string;
      subtitle: string;
      route: string;
    };

type CoachUpgradeUser = CoachUserLike & {
  account_state?: string | null;
  next_step?: string | null;
};

export function getCoachUpgradeCta(
  user: CoachUpgradeUser | null | undefined,
): CoachUpgradeCta | null {
  const coachAccess = getCoachAccessState(user);

  if (coachAccess.isApprovedCoach) {
    return null;
  }

  if (coachAccess.isPendingCoach) {
    const recoveryRoute = getCoachRecoveryRoute(user);
    const route =
      recoveryRoute && recoveryRoute !== '/(tabs)'
        ? recoveryRoute
        : getPendingCoachRoute(user);
    return {
      kind: 'resume',
      title: 'View Coach Application Status',
      subtitle: 'Finish your pending coach approval steps',
      route,
    };
  }

  if (coachAccess.isRejectedCoach) {
    const recoveryRoute = getCoachRecoveryRoute(user);
    const route =
      recoveryRoute && recoveryRoute !== '/(tabs)'
        ? recoveryRoute
        : '/onboarding/coach-application';
    return {
      kind: 'resume',
      title: 'Resume Coach Application',
      subtitle: 'Review the decision and continue your coach application',
      route,
    };
  }

  if (coachAccess.isCoach) {
    const recoveryRoute = getCoachRecoveryRoute(user);
    return {
      kind: 'resume',
      title: 'Resume Coach Setup',
      subtitle: 'Continue the coach onboarding steps for this account',
      route:
        recoveryRoute && recoveryRoute !== '/(tabs)'
          ? recoveryRoute
          : '/onboarding/coach-application',
    };
  }

  return {
    kind: 'upgrade',
    title: 'Upgrade to Coach Account',
    subtitle: "You'll complete the coach setup steps next.",
    route: null,
  };
}
