import * as Sentry from 'sentry-expo';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Initialize Sentry only if DSN is provided
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    enableInExpoDevelopment: true,
    debug: __DEV__,
  });
}
