import { getConfig } from '@/config/env';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { captureAnalyticsException } from '@/utils/analytics';

const appConfig = getConfig();
const envDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '';
const configDsn = appConfig.sentryDsn || '';
const SENTRY_DSN = envDsn || configDsn;

const isPlaceholderDsn = (dsn: string) => {
  const lower = dsn.toLowerCase();
  return (
    lower.includes('your-key-here') || !lower.startsWith('http') || !lower.includes('.sentry.io')
  );
};

const shouldUseSentry = !__DEV__ && !!SENTRY_DSN && !isPlaceholderDsn(SENTRY_DSN);
const MOBILE_SERVICE_TAG = 'mobile';

let sentryReady = false;
const SENSITIVE_BREADCRUMB_KEY_RE = /password|secret|token|authorization|cookie|email|phone|code/i;
const MAX_BREADCRUMB_VALUE_LENGTH = 160;
const MAX_CONTEXT_DEPTH = 3;
const MAX_CONTEXT_KEYS = 25;
const MAX_CONTEXT_ARRAY_ITEMS = 10;

export function initSentry() {
  const dsn = SENTRY_DSN;
  if (!dsn || dsn === '' || isPlaceholderDsn(dsn)) {
    if (__DEV__) console.warn('Sentry DSN not configured — crash reporting disabled');
    return;
  }

  if (__DEV__) {
    if (__DEV__) console.log('[sentry] Skipping initialization in development mode');
    return;
  }

  try {
    const tracesSampleRate = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.2);
    Sentry.init({
      dsn,
      environment: appConfig.nodeEnv || 'development',
      debug: __DEV__,
      enableAutoSessionTracking: true,
      tracesSampleRate: Number.isNaN(tracesSampleRate) ? 0.2 : tracesSampleRate,
      beforeSend(event, hint) {
        // Disable error reporting in development to avoid blocking UI
        if (__DEV__) {
          return null; // Drop all events in dev mode
        }
        // Unauthenticated startup probes to /me are expected; they should not create production issues.
        const customContext = (event.contexts?.custom || {}) as { path?: string };
        const exceptionValue = event.exception?.values?.[0]?.value;
        if (customContext.path === '/me' && exceptionValue === 'Unauthorized') {
          return null;
        }
        // Filter out network timeouts from dev/local environments to reduce noise
        const isDev = event.environment === 'development';
        const ex = hint?.originalException as any;
        const isNetworkError = ex?.message?.includes('Network request failed');
        if (isDev && isNetworkError) {
          return null; // Drop event
        }
        return event;
      },
    });

    sentryReady = true;

    // Tag with platform and version for filtering
    Sentry.setTag('service', MOBILE_SERVICE_TAG);
    Sentry.setTag('platform', Platform.OS);
    Sentry.setTag('app_version', Constants.expoConfig?.version || '1.0.0');
    Sentry.setTag('expo_version', Constants.expoConfig?.sdkVersion || 'unknown');
  } catch (error) {
    // Silently fail in development - Sentry initialization errors are non-critical
    if (__DEV__) {
      if (__DEV__) console.log('[sentry] Init failed (dev mode, ignoring):', error);
    }
  }
}

// v1.0.2 pass 9: PII scrubbing for Sentry. Previously we sent raw user_id + email + username,
// which Sentry stores in plaintext and exposes to anyone with project access. Now we only
// send a hashed identifier so cross-error correlation still works without leaking PII.
function hashForSentry(input: string): string {
  // Lightweight FNV-1a 32-bit hash → 8-char hex. No real crypto needed for correlation.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function setUserContext(user: { id: string; email?: string; username?: string } | null) {
  if (!sentryReady) return;
  try {
    if (user) {
      // Hash the id so we can correlate errors per-user without exposing the raw identifier.
      // No email/username sent — those are PII.
      Sentry.setUser({ id: `u_${hashForSentry(user.id)}` });
    } else {
      Sentry.setUser(null);
    }
  } catch {
    // non-critical
  }
}

export function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (!__DEV__) {
    captureAnalyticsException(error, context);
  }

  if (!sentryReady) {
    if (__DEV__) {
      console.debug('[sentry] captureException skipped in dev:', error);
    } else {
      if (__DEV__) console.warn('[sentry] captureException skipped; Sentry not ready');
    }
    return;
  }

  if (__DEV__) console.error('[sentry] Capturing exception:', error);
  Sentry.withScope(scope => {
    scope.setTag('service', MOBILE_SERVICE_TAG);
    if (context) {
      const { tags, ...rest } = context;
      if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
        Object.entries(tags).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            !SENSITIVE_BREADCRUMB_KEY_RE.test(key)
          ) {
            scope.setTag(key, String(value));
          }
        });
      }
      const sanitizedContext = sanitizeContextData(rest);
      if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
        scope.setContext('custom', sanitizedContext);
      }
    }
    scope.setTag('platform', Platform.OS);
    Sentry.captureException(error);
  });
}

function normalizeBreadcrumbValue(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'non-finite';
  if (typeof value === 'string') {
    return value.length > MAX_BREADCRUMB_VALUE_LENGTH
      ? `${value.slice(0, MAX_BREADCRUMB_VALUE_LENGTH)}...`
      : value;
  }
  if (Array.isArray(value)) {
    return `[${value.slice(0, 5).map((item) => normalizeBreadcrumbValue(item)).join(', ')}${value.length > 5 ? ', ...' : ''}]`;
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return 'empty-object';
    return serialized.length > MAX_BREADCRUMB_VALUE_LENGTH
      ? `${serialized.slice(0, MAX_BREADCRUMB_VALUE_LENGTH)}...`
      : serialized;
  } catch {
    return '[unserializable]';
  }
}

function normalizeBreadcrumbData(data?: Record<string, any>) {
  if (!data) return undefined;

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'undefined') continue;
    normalized[key] = SENSITIVE_BREADCRUMB_KEY_RE.test(key)
      ? '[redacted]'
      : normalizeBreadcrumbValue(value);
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function sanitizeContextValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean') return value ?? null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'non-finite';
  if (typeof value === 'string') {
    return value.length > MAX_BREADCRUMB_VALUE_LENGTH
      ? `${value.slice(0, MAX_BREADCRUMB_VALUE_LENGTH)}...`
      : value;
  }
  if (depth >= MAX_CONTEXT_DEPTH) {
    return normalizeBreadcrumbValue(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_CONTEXT_ARRAY_ITEMS).map(item => sanitizeContextValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const sanitized = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_CONTEXT_KEYS)
        .filter(([, nestedValue]) => typeof nestedValue !== 'undefined')
        .map(([key, nestedValue]) => [
          key,
          SENSITIVE_BREADCRUMB_KEY_RE.test(key)
            ? '[redacted]'
            : sanitizeContextValue(nestedValue, depth + 1),
        ])
    );
    return Object.keys(sanitized).length > 0 ? sanitized : '[empty-object]';
  }
  return normalizeBreadcrumbValue(value);
}

function sanitizeContextData(data?: Record<string, any>) {
  if (!data) return undefined;

  const sanitized = Object.fromEntries(
    Object.entries(data)
      .slice(0, MAX_CONTEXT_KEYS)
      .filter(([, value]) => typeof value !== 'undefined')
      .map(([key, value]) => [
        key,
        SENSITIVE_BREADCRUMB_KEY_RE.test(key) ? '[redacted]' : sanitizeContextValue(value),
      ])
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function captureBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) {
  const normalizedData = normalizeBreadcrumbData(data);

  if (!sentryReady) {
    if (__DEV__) {
      console.debug('[sentry] breadcrumb (dev-only, not sent):', {
        message,
        category,
        level,
        data: normalizedData,
      });
    }
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: normalizedData,
  });
}

export default Sentry;
