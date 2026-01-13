const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * A config plugin to customize Android build configuration.
 * This is a stub plugin - add custom build config modifications here as needed.
 */
const withAndroidBuildConfig = (config) => {
  return withAppBuildGradle(config, (config) => {
    // Add any build.gradle modifications here
    return config;
  });
};

module.exports = withAndroidBuildConfig;
