import { getConfig } from '@/config/env';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SentryExpo from 'sentry-expo';
// Access Native Sentry methods from the re-export
const SentryNative = (SentryExpo as any).Native || SentryExpo;

const appConfig = getConfig();
const SENTRY_DSN = appConfig.sentryDsn || '';
const isPlaceholderDsn = (dsn: string) => {
  const lower = dsn.toLowerCase();
  return (
    lower.includes('your-key-here') ||
    !lower.startsWith('http') ||
    !lower.includes('ingest.sentry.io')
  );
};
const shouldUseSentry = !__DEV__ && !!SENTRY_DSN && !isPlaceholderDsn(SENTRY_DSN);
let sentryReady = false;

export function initSentry() {
  if (!shouldUseSentry) {
    if (__DEV__) {
      console.log('[sentry] Skipping initialization in development mode');
    } else {
      console.warn('[sentry] No valid DSN; crash reporting disabled');
    }
    return;
  }

  try {
    SentryExpo.init({
      dsn: SENTRY_DSN,
      environment: appConfig.nodeEnv || 'development',
      debug: false,
      tracesSampleRate: 0.2, // 20% of transactions for performance monitoring
      beforeSend(event, hint) {
        // Disable error reporting in development to avoid blocking UI
        if (__DEV__) {
          return null; // Drop all events in dev mode
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
    if (SentryNative?.setTag) {
      try {
        SentryNative.setTag('platform', Platform.OS);
        SentryNative.setTag('app_version', Constants.expoConfig?.version || '1.0.0');
        SentryNative.setTag('expo_version', Constants.expoConfig?.sdkVersion || 'unknown');
      } catch (e) {
        // Silently ignore tag errors
      }
    }
  } catch (error) {
    // Silently fail in development - Sentry initialization errors are non-critical
    if (__DEV__) {
      console.log('[sentry] Init failed (dev mode, ignoring):', error);
    }
  }
}

export function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (!sentryReady) {
    if (__DEV__) {
      console.debug('[sentry] captureException skipped in dev:', error);
    } else {
      console.warn('[sentry] captureException skipped; Sentry not ready');
    }
    return;
  }

  console.error('[sentry] Capturing exception:', error);
  if (context && SentryNative?.setContext) {
    try {
      SentryNative.setContext('custom', context);
    } catch (e) {
      // Silently ignore context errors
    }
  }
  if (SentryNative?.captureException) {
    SentryNative.captureException(error);
  }
}

export function captureBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!sentryReady) {
    if (!__DEV__) {
      console.warn('[sentry] captureBreadcrumb skipped; Sentry not ready');
    }
    return;
  }

  if (SentryNative?.addBreadcrumb) {
    SentryNative.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
    });
  }
}

export default SentryExpo;
