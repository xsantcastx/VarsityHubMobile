export const SENSITIVE_SENTRY_KEY_RE: RegExp;
export const MAX_SENTRY_VALUE_LENGTH: number;

export function normalizeSentryValue(value: unknown): string;
export function normalizeSentryBreadcrumbData(
  data?: Record<string, any>,
): Record<string, string> | undefined;
