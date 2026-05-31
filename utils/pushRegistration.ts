type RegisterPushTokenFn = () => Promise<unknown>;

/**
 * Best-effort push-token registration helper for onboarding flows.
 * Registration failures should never block account progression.
 */
export function bestEffortRegisterPushToken(
  registerPushToken: RegisterPushTokenFn,
  context: string
): void {
  void registerPushToken().catch((error) => {
    if (__DEV__) {
      console.warn(`[push] ${context} registration failed:`, error);
    }
  });
}
