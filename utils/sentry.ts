import { getConfig } from '@/config/env';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

let sentryReady = false;

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
    if (context) {
      scope.setContext('custom', context);
    }
    scope.setTag('platform', Platform.OS);
    Sentry.captureException(error);
  });
}

export function captureBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!sentryReady) {
    if (!__DEV__) {
      if (__DEV__) console.warn('[sentry] captureBreadcrumb skipped; Sentry not ready');
    }
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}

export default Sentry;
