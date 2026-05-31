type RegisterPushToken = (() => Promise<boolean | void>) | null | undefined;

/**
 * Fire-and-forget wrapper for push token registration.
 * Push registration must never block the main user flow.
 */
export function bestEffortRegisterPushToken(
  registerPushToken: RegisterPushToken,
  logPrefix = 'push-token-register'
): void {
  if (typeof registerPushToken !== 'function') {
    return;
  }

  void Promise.resolve()
    .then(() => registerPushToken())
    .catch((error: unknown) => {
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[${logPrefix}] Failed to register push token: ${message}`);
      }
    });
}
