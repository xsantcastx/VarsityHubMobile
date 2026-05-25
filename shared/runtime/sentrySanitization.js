export const SENSITIVE_SENTRY_KEY_RE =
  /password|secret|token|authorization|cookie|email|phone|code/i;
export const MAX_SENTRY_VALUE_LENGTH = 160;

export function normalizeSentryValue(value) {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'non-finite';
  if (typeof value === 'string') {
    return value.length > MAX_SENTRY_VALUE_LENGTH
      ? `${value.slice(0, MAX_SENTRY_VALUE_LENGTH)}...`
      : value;
  }
  if (Array.isArray(value)) {
    return `[${value
      .slice(0, 5)
      .map((item) => normalizeSentryValue(item))
      .join(', ')}${value.length > 5 ? ', ...' : ''}]`;
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return 'empty-object';
    return serialized.length > MAX_SENTRY_VALUE_LENGTH
      ? `${serialized.slice(0, MAX_SENTRY_VALUE_LENGTH)}...`
      : serialized;
  } catch {
    return '[unserializable]';
  }
}

export function normalizeSentryBreadcrumbData(data) {
  if (!data) return undefined;

  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'undefined') continue;
    normalized[key] = SENSITIVE_SENTRY_KEY_RE.test(key)
      ? '[redacted]'
      : normalizeSentryValue(value);
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
