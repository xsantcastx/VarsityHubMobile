/**
 * Dynamic Expo Configuration
 *
 * This file wraps app.json and injects sensitive values from environment variables.
 * API keys should be set via:
 *   - Local: .env file (not committed)
 *   - EAS Build: EAS Secrets in dashboard
 */

const baseConfig = require('./app.json');

module.exports = ({ config }) => {
  // API & Service Keys
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  const sentryDsn = process.env.SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN || '';
  
  // iOS Configuration
  const appleTeamId =
    process.env.EXPO_APPLE_TEAM_ID ||
    process.env.APPLE_TEAM_ID ||
    baseConfig.expo.ios?.appleTeamId;
  const iosBundleIdentifier =
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER ||
    process.env.IOS_BUNDLE_IDENTIFIER ||
    baseConfig.expo.ios?.bundleIdentifier;

  return {
    ...config,
    ...baseConfig.expo,
    ios: {
      ...baseConfig.expo.ios,
      appleTeamId,
      bundleIdentifier: iosBundleIdentifier,
      config: {
        ...baseConfig.expo.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...baseConfig.expo.android,
      config: {
        ...baseConfig.expo.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...baseConfig.expo.extra,
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
      EXPO_PUBLIC_SENTRY_DSN: sentryDsn,
    },
  };
};
