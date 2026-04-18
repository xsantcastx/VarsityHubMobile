/**
 * Custom Expo Config Plugin - Android Manifest Cleanup
 *
 * This plugin removes legacy/deprecated Android manifest entries that can cause
 * Play Store rejection or policy review friction:
 * - requestLegacyExternalStorage (deprecated in Android 11+)
 * - legacy storage/audio permissions contributed by transitive Expo plugins
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
      let changed = false;

      const forceRemovedPermissions = [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ];

      // Remove requestLegacyExternalStorage attribute
      if (manifest.includes('android:requestLegacyExternalStorage')) {
        manifest = manifest.replace(/\s*android:requestLegacyExternalStorage="[^"]*"/g, '');
        changed = true;
      }

      for (const permission of forceRemovedPermissions) {
        const plainPermissionLine = new RegExp(
          `\\s*<uses-permission android:name="${permission}"\\s*/>\\n?`,
          'g'
        );
        const removeDirective =
          `  <uses-permission android:name="${permission}" tools:node="remove"/>\n`;

        if (plainPermissionLine.test(manifest)) {
          manifest = manifest.replace(plainPermissionLine, '');
          changed = true;
        }

        if (!manifest.includes(removeDirective.trim())) {
          manifest = manifest.replace(
            /(<manifest[^>]*>\s*)/,
            `$1${removeDirective}`
          );
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(manifestPath, manifest);
        console.log('✅ Cleaned Android manifest legacy attributes and blocked permissions');
      }
    }

    return config;
  }]);
}

module.exports = withAndroidManifestCleanup;
