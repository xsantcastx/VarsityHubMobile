/**
 * Session-expired event bus.
 *
 * The HTTP layer detects unrecoverable auth failures (401 after refresh,
 * missing refresh token) and emits here. AuthProvider subscribes and
 * handles the navigation + local cleanup.
 *
 * This keeps api/http.ts free of any routing or React state concerns, and
 * lets the app react to a dead session without requiring the user to
 * manually "sign out and sign back in" as the old alert instructed.
 *
 * A short dedupe window coalesces bursts of 401s from parallel requests so
 * we only fire one handler per real expiry.
 */

export type SessionExpiredReason =
  | 'refresh_failed'
  | 'refresh_missing'
  | 'token_rejected_after_refresh';

type Listener = (reason: SessionExpiredReason) => void;

const listeners = new Set<Listener>();
let lastFiredAt = 0;
const DEDUPE_WINDOW_MS = 2_000;

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionExpired(reason: SessionExpiredReason): void {
  const now = Date.now();
  if (now - lastFiredAt < DEDUPE_WINDOW_MS) return;
  lastFiredAt = now;
  listeners.forEach(fn => {
    try {
      fn(reason);
    } catch {
      // Listener errors must not break the event bus.
    }
  });
}

/**
 * Test-only: reset internal state so unit tests can exercise the dedupe
 * window without cross-contamination.
 */
export function __resetSessionEventsForTest(): void {
  listeners.clear();
  lastFiredAt = 0;
}
