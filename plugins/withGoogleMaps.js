/**
 * Expo Config Plugin - Google Maps API Key Injection
 *
 * Injects the Google Maps API key (sourced from env via app.config.js) into:
 *   - iOS Info.plist (GMSApiKey) for react-native-maps
 *   - Android AndroidManifest.xml (com.google.android.geo.API_KEY)
 *
 * Keeping both platforms in one plugin means there is exactly one place in
 * the repo that holds the key at build time: the env var. The committed
 * native artifacts are blanked so an accidental commit can never leak it.
 */

const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

function withGoogleMapsIos(config) {
  return withInfoPlist(config, (config) => {
    const apiKey = config.ios?.config?.googleMapsApiKey;
    if (apiKey) {
      config.modResults.GMSApiKey = apiKey;
      console.log('[withGoogleMaps] ✅ Injected Google Maps API key into Info.plist');
    } else {
      console.warn('[withGoogleMaps] ⚠️  iOS Google Maps API key not found in config');
    }
    return config;
  });
}

function withGoogleMapsAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const apiKey = config.android?.config?.googleMaps?.apiKey;
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) {
      console.warn('[withGoogleMaps] ⚠️  AndroidManifest has no <application> tag; skipping');
      return config;
    }
    application['meta-data'] = application['meta-data'] || [];

    const existing = application['meta-data'].find(
      (md) => md.$?.['android:name'] === 'com.google.android.geo.API_KEY'
    );
    const value = apiKey || '';
    if (existing) {
      existing.$['android:value'] = value;
    } else {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': value,
        },
      });
    }
    if (apiKey) {
      console.log('[withGoogleMaps] ✅ Injected Google Maps API key into AndroidManifest');
    } else {
      console.warn('[withGoogleMaps] ⚠️  Android Google Maps API key not found in config');
    }
    return config;
  });
}

function withGoogleMaps(config) {
  return withGoogleMapsAndroid(withGoogleMapsIos(config));
}

module.exports = withGoogleMaps;
