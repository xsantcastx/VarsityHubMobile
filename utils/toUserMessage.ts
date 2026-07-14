/**
 * toUserMessage — the single place that turns a caught error into a string
 * that is safe to show on screen.
 *
 * Why this exists: `api/http.ts` builds transport-error messages that embed the
 * origin API URL (e.g. "Cannot connect to server at https://…railway.app…"),
 * and any server/provider error body can flow into `err.message` verbatim.
 * Rendering those raw leaks infrastructure internals to users. Every UI site
 * that would otherwise show `err.message` / `err.data.message` should route it
 * through here instead.
 *
 * The core (`sanitizeMessage`) is pure and dependency-free so it can be unit
 * tested without mocking the RN/Expo transport layer.
 */

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

// Anything matching these is infra/internal detail, never fit for the screen.
const LEAK_PATTERNS = [
  /https?:\/\//i, // any URL (origin, provider, presigned)
  /railway\.app/i, // Railway origin host
  /cloudinary|res\.cloudinary|r2\.cloudflarestorage/i, // provider hosts
  /\bat\s.+:\d+:\d+/, // stack frame ("at fn (file:line:col)")
  /\/[\w.-]+\/[\w.-]+\.(t|j)sx?/, // source file paths
];

const MAX_LEN = 200;

/**
 * Pure string sanitizer. Returns `fallback` when the input is empty, too long,
 * or contains anything that looks like infra/internal detail.
 */
export function sanitizeMessage(raw: unknown, fallback: string = GENERIC_FALLBACK): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.length > MAX_LEN) return fallback;
  if (LEAK_PATTERNS.some(re => re.test(trimmed))) return fallback;
  return trimmed;
}

function isTransportError(err: any): boolean {
  return err?.isNetworkError === true || err?.status === 0;
}

function extractRaw(err: any): string {
  return (
    (typeof err?.data?.message === 'string' && err.data.message) ||
    (typeof err?.data?.error === 'string' && err.data.error) ||
    (typeof err?.message === 'string' && err.message) ||
    ''
  );
}

/**
 * Convert any caught error into a user-safe message.
 * - Transport/network failures never reveal the host → fixed generic string.
 * - Server envelope messages pass through only if they contain no infra detail.
 * - Anything suspicious falls back to `fallback` (default generic).
 */
export function toUserMessage(err: unknown, fallback: string = GENERIC_FALLBACK): string {
  if (isTransportError(err)) return NETWORK_MESSAGE;
  return sanitizeMessage(extractRaw(err), fallback);
}

/**
 * Stable 4-hex-char fingerprint of the current API host. Lets support correlate
 * "which host failed" from a screenshot without exposing the origin URL. Read
 * lazily to avoid a module cycle with api/http and to stay test-friendly.
 */
export function apiHostFingerprint(hostOverride?: string): string {
  try {
    let host = hostOverride;
    if (!host) {
      // Lazy require: keeps this module importable in tests without the full
      // Expo transport graph, and avoids an import cycle with api/http.
      const { getApiBaseUrl } = require('@/api/http') as typeof import('@/api/http');
      host = getApiBaseUrl();
    }
    const h = (host || '').replace(/^https?:\/\//i, '').split('/')[0];
    let hash = 0x811c9dc5; // FNV-1a 32-bit
    for (let i = 0; i < h.length; i++) {
      hash ^= h.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 4);
  } catch {
    return '----';
  }
}

/**
 * Pre-auth variant: on a transport failure it appends a host *fingerprint*
 * (not the URL) so sign-in/up/forgot screens keep their "which host failed"
 * diagnostic value without leaking the origin. Non-transport errors defer to
 * the normal sanitizer.
 */
export function toAuthErrorMessage(err: unknown, fallback: string = GENERIC_FALLBACK): string {
  if (isTransportError(err)) {
    return `Couldn't reach the server (ref ${apiHostFingerprint()}). Check your connection and try again.`;
  }
  return sanitizeMessage(extractRaw(err), fallback);
}
