/**
 * Expo Config Plugin — Instagram Stories sharing.
 *
 * Lets the app hand a background image + sticker to the Instagram app's
 * "Add to Story" flow (via react-native-share). Sharing needs the OS to let us
 * query/launch Instagram:
 *   - iOS:     LSApplicationQueriesSchemes must list `instagram-stories` (and
 *              `instagram`) or canOpenURL / the share silently no-ops.
 *   - Android: a <queries> entry for the Instagram package, required since
 *              Android 11 (package visibility) for the ADD_TO_STORY intent.
 *
 * This is NATIVE config — it ships only via `eas build`, never OTA. Re-run
 * prebuild after changing it.
 */
const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

const IOS_QUERY_SCHEMES = ['instagram-stories', 'instagram'];
const IG_PACKAGE = 'com.instagram.android';

function withIosInstagramQuery(config) {
  return withInfoPlist(config, config => {
    const existing = Array.isArray(config.modResults.LSApplicationQueriesSchemes)
      ? config.modResults.LSApplicationQueriesSchemes
      : [];
    config.modResults.LSApplicationQueriesSchemes = Array.from(
      new Set([...existing, ...IOS_QUERY_SCHEMES])
    );
    return config;
  });
}

function withAndroidInstagramQuery(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    if (!Array.isArray(manifest.queries)) {
      manifest.queries = manifest.queries ? [manifest.queries] : [];
    }
    const alreadyListed = manifest.queries.some(q =>
      (q.package || []).some(p => p?.$?.['android:name'] === IG_PACKAGE)
    );
    if (!alreadyListed) {
      manifest.queries.push({ package: [{ $: { 'android:name': IG_PACKAGE } }] });
    }
    return config;
  });
}

module.exports = function withInstagramStories(config) {
  config = withIosInstagramQuery(config);
  config = withAndroidInstagramQuery(config);
  return config;
};
