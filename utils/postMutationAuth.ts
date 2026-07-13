import {
  getPostAuthRouteDecision,
  type PostAuthRouteDecision,
  type RoutingUserLike,
} from './appRouteDecisions';

type RefreshAuthFn<T extends RoutingUserLike> = () => Promise<T | null | undefined>;

export async function getFreshPostAuthState<T extends RoutingUserLike>(
  refreshAuth: RefreshAuthFn<T>,
  refreshUser?: RefreshAuthFn<T>,
  fallbackUser?: T | null
): Promise<{ user: T; decision: PostAuthRouteDecision }> {
  let user: T | null | undefined = null;

  try {
    user = (await refreshAuth()) ?? null;
  } catch {
    user = null;
  }

  if (!user && typeof refreshUser === 'function') {
    try {
      user = (await refreshUser()) ?? null;
    } catch {
      user = null;
    }
  }

  if (!user) {
    user = fallbackUser ?? null;
  }

  if (!user) {
    throw new Error(
      'We saved your account, but could not refresh your latest access state. Please try again.'
    );
  }

  return {
    user,
    decision: getPostAuthRouteDecision(user),
  };
}
