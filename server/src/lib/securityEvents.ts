/**
 * Security event stream.
 *
 * The 2026-07-23 audit found the server had plenty of *diagnostic* logging
 * (request IDs, slow-request warnings, Sentry on 500s) but no way to answer the
 * only question that matters mid-incident: "is someone attacking me right now?"
 * Auth failures, rate-limit breaches and authz denials were each logged in their
 * own ad-hoc shape, so there was nothing to alert on.
 *
 * This module is the single funnel for those events. Two design rules:
 *
 *   1. ONE greppable line per event: `[security] {"type":...}`. Railway log
 *      search and any log-drain alerting keys on the prefix, and the payload is
 *      strict JSON so it can be parsed without a regex.
 *   2. Thresholding is NOT done here. Warning/critical events are forwarded to
 *      Sentry with stable tags (`security_event`, `security_event_type`) and
 *      Sentry's own alert rules do the counting. Doing it in-process would
 *      repeat the MemoryStore mistake documented in middleware/rateLimiters.ts:
 *      counters reset on every Railway deploy and multiply per replica.
 *
 * Identifiers are hashed, never raw. A leaked log bundle must not double as a
 * user list, and this stream is high-volume by nature (every failed login).
 *
 * @module lib/securityEvents
 */

import crypto from 'crypto';

import { captureMessage } from './sentry.js';

/** Stable prefix every security line starts with. Alerting keys on this. */
export const SECURITY_LOG_PREFIX = '[security]';

/**
 * Event taxonomy. Kept as a closed union so a typo can't silently create a new
 * event type that no alert rule is watching.
 */
export type SecurityEventType =
  // Authentication
  | 'auth.login_failed'
  | 'auth.login_lockout'
  | 'auth.refresh_failed'
  | 'auth.token_reuse'
  | 'auth.oauth_failed'
  // Authorization
  | 'authz.denied'
  | 'authz.admin_denied'
  | 'authz.unverified_admin_attempt'
  // Abuse / throttling
  | 'ratelimit.exceeded'
  // Input handling
  | 'input.rejected'
  | 'upload.rejected';

export type SecuritySeverity = 'info' | 'warning' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  /** Raw user id — hashed before it reaches the log. */
  userId?: string | null;
  /** Raw email — lowercased and hashed before it reaches the log. */
  email?: string | null;
  /** Client IP. Retained in full: it is the actionable field for blocking. */
  ip?: string | null;
  /** Request path, for correlating with the route tag in Sentry. */
  path?: string | null;
  method?: string | null;
  /** Correlates with the `x-request-id` echoed to the client. */
  requestId?: string | null;
  /** Extra context. Secret-looking keys are dropped, see SECRET_KEY_PATTERN. */
  metadata?: Record<string, unknown>;
}

/**
 * Keys whose values must never reach a log line. Matched case-insensitively as
 * a substring, so `refresh_token`, `Authorization` and `apiKey` all trip it.
 * Mirrors the redaction list in middleware/errorHandler.ts — keep them aligned.
 */
const SECRET_KEY_PATTERN = /pass|secret|token|auth|key|credential|cookie|session|otp|code/i;

/**
 * Stable, non-reversible identifier hash. 16 hex chars (64 bits) is far past
 * collision risk at our volume while keeping log lines short, and matches the
 * `u_<16 hex>` shape already used by setUserContext in lib/sentry.ts.
 *
 * Emails are lowercased first so `Bob@x.com` and `bob@x.com` — which are the
 * same account — cannot split into two hashes and hide a credential-stuffing
 * pattern from whoever is reading the logs.
 */
export function hashIdentifier(prefix: string, value: string): string {
  const normalized = prefix === 'e' ? value.trim().toLowerCase() : value.trim();
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `${prefix}_${digest}`;
}

/** Strip secret-bearing keys and anything non-serializable from metadata. */
function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    // Only primitives survive. Nested objects are the usual vector for a stray
    // token riding along inside a request body, and they bloat the line.
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

/**
 * Where warning/critical events go for alerting. Indirected through a setter so
 * tests can assert routing without reaching into Sentry, and so a future log
 * drain can be added without touching call sites.
 */
type SecurityEventSink = (event: Record<string, unknown>, severity: SecuritySeverity) => void;

const defaultSink: SecurityEventSink = (event, severity) => {
  captureMessage(`security.${event.type}`, severity === 'critical' ? 'error' : 'warning', {
    context: 'security_event',
    tags: {
      security_event: 'true',
      security_event_type: String(event.type),
      security_severity: severity,
    },
    extra: event,
  });
};

let sink: SecurityEventSink = defaultSink;

export function setSecurityEventSink(next: SecurityEventSink): void {
  sink = next;
}

export function __resetSecurityEventSinkForTests(): void {
  sink = defaultSink;
}

/**
 * Emit a security event.
 *
 * Never throws. This sits directly in the auth and rate-limit request paths, so
 * a logging failure must never become a request failure — that would turn the
 * observability layer into a denial-of-service surface of its own.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  try {
    const payload: Record<string, unknown> = {
      type: event.type,
      severity: event.severity,
      at: new Date().toISOString(),
    };

    if (event.userId) payload.user = hashIdentifier('u', event.userId);
    if (event.email) payload.email = hashIdentifier('e', event.email);
    if (event.ip) payload.ip = event.ip;
    if (event.path) payload.path = event.path;
    if (event.method) payload.method = event.method;
    if (event.requestId) payload.requestId = event.requestId;

    const metadata = sanitizeMetadata(event.metadata);
    if (metadata) payload.metadata = metadata;

    const line = `${SECURITY_LOG_PREFIX} ${JSON.stringify(payload)}`;

    // Deliberately console.warn/error, not debugLog: security events must be
    // emitted in production, where debugLog is silent by default.
    if (event.severity === 'critical') {
      console.error(line);
    } else {
      console.warn(line);
    }

    // `info` is for volume-heavy expected events; forwarding them would burn
    // the Sentry quota without adding signal.
    if (event.severity !== 'info') {
      sink(payload, event.severity);
    }
  } catch (error) {
    // Last-resort: swallow. A broken logger must not break a login.
    try {
      console.error('[security] failed to emit security event', (error as Error)?.message);
    } catch {
      /* ignore */
    }
  }
}
