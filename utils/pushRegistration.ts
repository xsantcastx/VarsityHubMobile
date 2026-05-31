/**
 * Best-effort push-token registration helper.
 *
 * Wraps the provided `registerFn` in a try/catch so callers can fire-and-forget
 * without worrying about unhandled rejections. Failures are logged in __DEV__
 * but never propagated.
 */
export async function bestEffortRegisterPushToken(
  registerFn: (() => Promise<unknown>) | undefined,
  tag: string,
): Promise<void> {
  if (!registerFn) return;
  try {
    await registerFn();
  } catch (err) {
    if (__DEV__) {
      console.warn(`[${tag}] Push token registration failed:`, err);
    }
  }
}
