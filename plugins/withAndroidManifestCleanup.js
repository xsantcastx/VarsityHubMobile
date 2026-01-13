const { withAndroidManifest } = require("expo/config-plugins");

/**
 * A config plugin to clean up the Android manifest.
 * This is a stub plugin - add custom manifest modifications here as needed.
 */
const withAndroidManifestCleanup = (config) => {
  return withAndroidManifest(config, (config) => {
    // Add any manifest cleanup logic here
    return config;
  });
};

module.exports = withAndroidManifestCleanup;
