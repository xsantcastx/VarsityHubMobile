import { getConfig } from '@/config/env';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Sentry from 'sentry-expo';
// Native methods are available via Sentry.Native; type as any to avoid missing type declarations
const SentryNative = ((Sentry as any).Native || Sentry) as {
  setTag?: (key: string, value: string) => void;
  setContext?: (key: string, context: Record<string, any>) => void;
  captureException?: (error: any) => void;
  addBreadcrumb?: (crumb: { message: string; category: string; level?: string; data?: Record<string, any> }) => void;
};

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
    Sentry.init({
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
    try {
      SentryNative.setTag('platform', Platform.OS);
      SentryNative.setTag('app_version', Constants.expoConfig?.version || '1.0.0');
      SentryNative.setTag('expo_version', Constants.expoConfig?.sdkVersion || 'unknown');
    } catch (e) {
      // Silently ignore tag errors
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
  try {
    if (context) {
      SentryNative.setContext('custom', context);
    }
    SentryNative.captureException(error);
  } catch {
    // ignore capture failures
  }
}

export function captureBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!sentryReady) {
    if (!__DEV__) {
      console.warn('[sentry] captureBreadcrumb skipped; Sentry not ready');
    }
    return;
  }

  try {
    SentryNative.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
    });
  } catch {
    // ignore breadcrumb failures
  }
}

/**
 * Test Sentry connectivity by sending a test event.
 * Only works if EXPO_PUBLIC_SENTRY_DSN is set to a valid DSN and app is running in production mode.
 * @returns {Promise<{success: boolean; message: string; dsn?: string}>}
 */
export async function testSentryConnection(): Promise<{ success: boolean; message: string; dsn?: string }> {
  if (__DEV__) {
    return {
      success: false,
      message: 'Sentry test skipped: app is in development mode',
    };
  }

  if (!SENTRY_DSN || isPlaceholderDsn(SENTRY_DSN)) {
    return {
      success: false,
      message: 'Sentry is disabled: EXPO_PUBLIC_SENTRY_DSN is not set or invalid',
    };
  }

  if (!sentryReady) {
    return {
      success: false,
      message: 'Sentry is not initialized. Check console for initialization errors.',
    };
  }

  try {
    // Add a test breadcrumb first
    captureBreadcrumb('Sentry test initiated', 'test');

    // Capture a test exception
    const testError = new Error('🔍 Sentry test event - if you see this in your Sentry dashboard, connectivity is working!');
    SentryNative.captureException(testError);

    console.log('[sentry] Test event sent successfully');
    return {
      success: true,
      message: 'Test event sent! Check your Sentry dashboard in a few seconds.',
      dsn: SENTRY_DSN.substring(0, 40) + '...',
    };
  } catch (error) {
    console.error('[sentry] Test failed:', error);
    return {
      success: false,
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if Sentry is currently active and ready.
 */
export function isSentryActive(): boolean {
  return sentryReady;
}

/**
 * Get Sentry status info for debugging.
 */
export function getSentryStatus(): { isActive: boolean; isDev: boolean; hasDsn: boolean; dsnPreview?: string } {
  return {
    isActive: sentryReady,
    isDev: __DEV__,
    hasDsn: !!(SENTRY_DSN && !isPlaceholderDsn(SENTRY_DSN)),
    dsnPreview: SENTRY_DSN ? SENTRY_DSN.substring(0, 40) + '...' : undefined,
  };
}

export default Sentry;
