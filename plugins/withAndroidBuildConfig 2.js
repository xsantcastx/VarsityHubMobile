/**
 * Custom Expo Config Plugin - Android Build Configuration
 *
 * This plugin modifies android/app/build.gradle to:
 * - Enable R8 minification for release builds
 * - Enable resource shrinking
 * - Configure production signing (reads from keystore.properties or env vars)
 *
 * Usage: Add to plugins array in app.json:
 * ["./plugins/withAndroidBuildConfig"]
 */

const { withAppBuildGradle } = require('expo/config-plugins');

function withAndroidBuildConfig(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Enable minification by default for release builds
    contents = contents.replace(
      /def enableMinifyInReleaseBuilds = \(findProperty\('android\.enableMinifyInReleaseBuilds'\) \?\: false\)\.toBoolean\(\)/,
      'def enableMinifyInReleaseBuilds = true'
    );

    // Replace the signingConfigs and buildTypes block
    const signingConfigsRegex = /signingConfigs \{[\s\S]*?buildTypes \{[\s\S]*?release \{[\s\S]*?\}\s*\}/;

    const newSigningAndBuildConfig = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        // Production signing config - populate via keystore.properties or environment variables
        // To create keystore: keytool -genkeypair -v -storetype PKCS12 -keystore varsityhub-release.keystore -alias varsityhub -keyalg RSA -keysize 2048 -validity 10000
        release {
            def keystorePropertiesFile = rootProject.file("keystore.properties")
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            } else if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                // EAS Build / CI environment variables
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            } else {
                // Fallback to debug for local development (NOT for Play Store!)
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            shrinkResources true
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }`;

    contents = contents.replace(signingConfigsRegex, newSigningAndBuildConfig);

    config.modResults.contents = contents;
    console.log('✅ Applied Android build config (R8 minification, release signing)');

    return config;
  });
}

module.exports = withAndroidBuildConfig;
