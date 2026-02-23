/**
 * Expo Configuration
 *
 * Injects env vars at build time. Set in EAS Secrets or .env for local builds:
 * - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 * - EXPO_PUBLIC_SENTRY_DSN (monitoring)
 * - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (payments)
 * - EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME (Google OAuth proxy redirect; must match Google Console)
 */
const base = require('./app.json').expo;
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || (base.extra && base.extra.EXPO_PUBLIC_SENTRY_DSN) || '';
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || (base.extra && base.extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) || '';
const expoProjectFullName = process.env.EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME || (base.extra && base.extra.EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME) || '@varsity-hub/varsityhub';

module.exports = {
  ...base,
  extra: {
    ...(base.extra || {}),
    EXPO_PUBLIC_SENTRY_DSN: sentryDsn,
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
    EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME: expoProjectFullName,
  },
  ios: {
    ...base.ios,
    config: {
      ...(base.ios?.config || {}),
      googleMapsApiKey: mapsKey,
    },
  },
  android: {
    ...base.android,
    config: {
      ...(base.android?.config || {}),
      googleMaps: {
        ...(base.android?.config?.googleMaps || {}),
        apiKey: mapsKey,
      },
    },
  },
};
