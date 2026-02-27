/**
 * Expo Config Plugin - Google OAuth URL Scheme
 *
 * Injects the reversed iOS client ID as a URL scheme into Info.plist
 * so Google OAuth redirect works. When EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID changes,
 * run prebuild to regenerate native projects.
 */

const { withInfoPlist } = require('expo/config-plugins');

function withGoogleOAuth(config) {
  return withInfoPlist(config, (config) => {
    const extra = config.extra ?? config.expo?.extra ?? {};
    const iosClientId = extra.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

    if (!iosClientId || !iosClientId.includes('.apps.googleusercontent.com')) {
      console.warn('[withGoogleOAuth] No valid iOS client ID - Google sign-in may not work');
      return config;
    }

    const prefix = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    const scheme = `com.googleusercontent.apps.${prefix}`;

    const urlTypes = config.modResults.CFBundleURLTypes || [];
    const first = urlTypes[0];
    const schemes = Array.isArray(first?.CFBundleURLSchemes) ? [...first.CFBundleURLSchemes] : [];

    // Remove old Google scheme (format: com.googleusercontent.apps.*)
    const filtered = schemes.filter((s) => !s.startsWith('com.googleusercontent.apps.'));
    if (!filtered.includes(scheme)) {
      filtered.push(scheme);
    }
    config.modResults.CFBundleURLTypes = [
      { ...first, CFBundleURLSchemes: filtered, CFBundleTypeRole: first?.CFBundleTypeRole || 'Editor' },
    ];
    console.log('[withGoogleOAuth] Injected Google OAuth scheme:', scheme);

    return config;
  });
}

module.exports = withGoogleOAuth;
