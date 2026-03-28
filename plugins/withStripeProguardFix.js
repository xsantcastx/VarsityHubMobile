/**
 * Custom Expo Config Plugin - Stripe R8 Missing Classes Fix
 *
 * AGP 8+ enables R8 full mode by default, which treats missing class
 * references as hard errors (ignoring -dontwarn rules). Expo prebuild
 * regenerates the android/ directory, so we must apply these fixes via
 * config plugins rather than editing files directly.
 *
 * This plugin:
 * 1. Adds -dontwarn rules to proguard-rules.pro for Stripe push provisioning
 * 2. Adds android.enableR8.fullMode=false to gradle.properties
 */

const {
  withGradleProperties,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PROGUARD_RULES = `
# Stripe push provisioning — optional module not bundled in stripe-react-native.
# These classes are referenced but never instantiated at runtime.
-dontwarn com.stripe.android.pushProvisioning.**
-dontwarn com.google.android.gms.tapandpay.**
-dontwarn com.reactnativestripesdk.pushprovisioning.**
`;

function withStripeProguardFix(config) {
  // Step 1: Add R8 full mode disable to gradle.properties
  config = withGradleProperties(config, (config) => {
    const key = 'android.enableR8.fullMode';
    // Remove existing entry if present
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === key)
    );
    // Add the property
    config.modResults.push({
      type: 'property',
      key,
      value: 'false',
    });
    console.log('✅ Added android.enableR8.fullMode=false to gradle.properties');
    return config;
  });

  // Step 2: Append Stripe dontwarn rules to proguard-rules.pro
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );

      let contents = '';
      if (fs.existsSync(proguardPath)) {
        contents = fs.readFileSync(proguardPath, 'utf-8');
      }

      // Only add if not already present
      if (!contents.includes('com.stripe.android.pushProvisioning')) {
        contents += PROGUARD_RULES;
        fs.writeFileSync(proguardPath, contents, 'utf-8');
        console.log('✅ Added Stripe push provisioning -dontwarn rules to proguard-rules.pro');
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withStripeProguardFix;
