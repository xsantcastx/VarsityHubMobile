/**
 * Sentry stub for tests - avoids loading real @sentry/node which has CJS/ESM issues.
 */
export function captureMessage(_msg: string) {}
export function initSentry(_app: unknown) {}
