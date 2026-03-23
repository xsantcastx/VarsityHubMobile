const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Ensures Android release builds keep Stripe classes during shrinking.
 * The transform is idempotent and leaves existing keep rules untouched.
 */
module.exports = function withStripeProguardFix(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults;
    const keepRule = '-keep class com.stripe.** { *; }';

    if (!gradle.contents.includes(keepRule)) {
      config.modResults.contents = `${gradle.contents}\n${keepRule}\n`;
    }

    return config;
  });
};
