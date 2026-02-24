/**
 * Custom Expo Config Plugin - Android Manifest Cleanup
 *
 * This plugin removes legacy/deprecated Android attributes that can cause
 * Play Store rejection or security issues:
 * - requestLegacyExternalStorage (deprecated in Android 11+)
 *
 * Uses withDangerousMod to run AFTER all other plugins have finished.
 *
 * Usage: Add to plugins array in app.json (should be LAST):
 * ["./plugins/withAndroidManifestCleanup"]
 */

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidManifestCleanup(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const manifestPath = path.join(
      config.modRequest.platformProjectRoot,
      'app/src/main/AndroidManifest.xml'
    );

    if (fs.existsSync(manifestPath)) {
      let manifest = fs.readFileSync(manifestPath, 'utf-8');

      // Remove requestLegacyExternalStorage attribute
      if (manifest.includes('android:requestLegacyExternalStorage')) {
        manifest = manifest.replace(/\s*android:requestLegacyExternalStorage="[^"]*"/g, '');
        fs.writeFileSync(manifestPath, manifest);
        console.log('✅ Removed android:requestLegacyExternalStorage from manifest');
      }
    }

    return config;
  }]);
}

module.exports = withAndroidManifestCleanup;
