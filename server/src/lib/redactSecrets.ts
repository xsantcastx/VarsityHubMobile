/**
 * Strip secret-bearing query params from any string before it reaches logs or
 * Sentry. Outbound URLs frequently embed credentials (e.g. Google Maps `?key=…`),
 * and axios errors serialize the full request URL into the error object — so the
 * raw error must never be logged verbatim. Pure + side-effect free for testing.
 */
const SECRET_PARAM_RE =
  /([?&](?:key|api_?key|access_token|token|secret|password|signature|sig)=)[^&\s'")]+/gi;

/** Replace the value of any secret-bearing query param with `***`. */
export const redactSecrets = (value: string): string => value.replace(SECRET_PARAM_RE, '$1***');

/** Sanitized, length-capped message for an unknown thrown value. */
export const safeErrorMessage = (error: unknown, max = 300): string =>
  redactSecrets(String((error as { message?: unknown })?.message ?? error)).slice(0, max);
