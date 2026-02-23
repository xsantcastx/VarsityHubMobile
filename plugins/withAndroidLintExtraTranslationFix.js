/**
 * Expo Config Plugin: Android ExtraTranslation / values-b+en fix
 *
 * Prevents lint ExtraTranslation errors by ensuring values-b+en/strings.xml
 * either doesn't exist or doesn't contain name/displayName (which must only
 * live in default values/strings.xml with translatable="false").
 *
 * Runs after withLocales so we remove the problematic file if it was created.
 */

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidLintExtraTranslationFix(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const projectRoot = config.modRequest.platformProjectRoot;
    const valuesBEnDir = path.join(projectRoot, 'app/src/main/res/values-b+en');
    const stringsPath = path.join(valuesBEnDir, 'strings.xml');

    if (fs.existsSync(stringsPath)) {
      const content = fs.readFileSync(stringsPath, 'utf-8');
      // If file contains name or displayName, remove the file to prevent ExtraTranslation
      if (content.includes('name="name"') || content.includes('name="displayName"')) {
        fs.unlinkSync(stringsPath);
        try {
          if (fs.readdirSync(valuesBEnDir).length === 0) {
            fs.rmdirSync(valuesBEnDir);
          }
        } catch (_) {}
        console.log('✅ Removed values-b+en/strings.xml (ExtraTranslation fix)');
      }
    }

    // Ensure default values/strings.xml has name and displayName with translatable="false"
    const defaultStringsPath = path.join(projectRoot, 'app/src/main/res/values/strings.xml');
    if (fs.existsSync(defaultStringsPath)) {
      let defaultContent = fs.readFileSync(defaultStringsPath, 'utf-8');
      const needsName = !defaultContent.includes('name="name"');
      const needsDisplayName = !defaultContent.includes('name="displayName"');
      if (needsName || needsDisplayName) {
        const before = '</resources>';
        const insert = [];
        if (needsName) insert.push('  <string name="name" translatable="false">VarsityHub Mobile</string>');
        if (needsDisplayName) insert.push('  <string name="displayName" translatable="false">VarsityHub Mobile</string>');
        if (insert.length) {
          defaultContent = defaultContent.replace(before, insert.join('\n') + '\n' + before);
          fs.writeFileSync(defaultStringsPath, defaultContent);
        }
      }
    }

    return config;
  }]);
}

module.exports = withAndroidLintExtraTranslationFix;
