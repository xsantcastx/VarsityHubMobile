const { expo } = require('./app.json');

const readEnv = (key, fallback = '') => {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
};

const mapsKey =
  readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') ||
  readEnv('GOOGLE_MAPS_API_KEY') ||
  readEnv('GOOGLE_MAPS_API_KEY_MOBILE');

const sentryDsn = readEnv('EXPO_PUBLIC_SENTRY_DSN', expo.extra?.EXPO_PUBLIC_SENTRY_DSN || '');
const stripeKey = readEnv(
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  expo.extra?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

const isProductionBuild =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.APP_ENV === 'production' ||
  (process.env.EAS_BUILD === 'true' && process.env.NODE_ENV === 'production');

if (isProductionBuild && !mapsKey) {
  // Fail fast in CI rather than shipping a build with a broken Maps SDK. The
  // hardcoded key used to live in app.json; committing empty + this check is
  // how we prevent that regression.
  throw new Error(
    '[app.config] GOOGLE_MAPS_API_KEY (or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) must be set for production builds. ' +
      'Provision via EAS secrets: `eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value <key>`.'
  );
}
if (!mapsKey && !isProductionBuild) {
  console.warn('[app.config] GOOGLE_MAPS_API_KEY is not set — map surfaces will be blank in this build.');
}

module.exports = () => {
  const ios = {
    ...expo.ios,
    config: {
      ...(expo.ios?.config ?? {}),
      ...(mapsKey ? { googleMapsApiKey: mapsKey } : {}),
    },
  };

  const android = {
    ...expo.android,
    config: {
      ...(expo.android?.config ?? {}),
      googleMaps: {
        ...(expo.android?.config?.googleMaps ?? {}),
        ...(mapsKey ? { apiKey: mapsKey } : {}),
      },
    },
  };

  const extra = {
    ...(expo.extra ?? {}),
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
      readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', expo.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''),
    EXPO_PUBLIC_SENTRY_DSN: sentryDsn,
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripeKey,
  };

  return {
    ...expo,
    ios,
    android,
    extra,
  };
};
