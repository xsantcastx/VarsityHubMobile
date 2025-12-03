import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const isPlaceholderDsn = (dsn: string) => {
  const lower = dsn.toLowerCase();
  return (
    lower.includes('your-key-here') ||
    !lower.startsWith('http') ||
    !lower.includes('ingest.sentry.io')
  );
};

export function initSentry() {
  if (!SENTRY_DSN || isPlaceholderDsn(SENTRY_DSN)) {
    console.warn('[sentry] No valid DSN; crash reporting disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_NODE_ENV || 'development',
    debug: false,
    tracesSampleRate: 0.2, // 20% of transactions for performance monitoring
    beforeSend(event, hint) {
      // Filter out network timeouts from dev/local environments to reduce noise
      const isDev = __DEV__ || event.environment === 'development';
      const ex = hint?.originalException as any;
      const isNetworkError = ex?.message?.includes('Network request failed');
      if (isDev && isNetworkError) {
        return null; // Drop event
      }
      return event;
    },
  });

  // Tag with platform and version for filtering
  Sentry.setTag('platform', Platform.OS);
  Sentry.setTag('app_version', Constants.expoConfig?.version || '1.0.0');
  Sentry.setTag('expo_version', Constants.expoConfig?.sdkVersion || 'unknown');
}

export function captureException(error: Error | unknown, context?: Record<string, any>) {
  console.error('[sentry] Capturing exception:', error);
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureException(error);
}

export function captureBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}

export default Sentry;
