/** Coalesce pending-update notifications and explicit downloads into one reload.
 * A successful reload stays latched until the new JS runtime starts. Failures
 * are reported once and release the latch so a later update check can retry.
 */
export function createOtaReloadRequest(
  reload: () => Promise<void>,
  reportFailure: (error: unknown) => void
): () => Promise<boolean> {
  let attempt: Promise<boolean> | null = null;
  return () => {
    if (!attempt) {
      attempt = Promise.resolve()
        .then(reload)
        .then(() => true)
        .catch(error => {
          attempt = null;
          reportFailure(error);
          return false;
        });
    }
    return attempt;
  };
}
