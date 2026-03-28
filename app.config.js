// app.config.js — Dynamic Expo config
// Sensitive values are loaded from environment variables.
// Non-sensitive values (app name, permissions, colors, plugins) remain inline.
//
// Set these env vars in your EAS build profile (eas.json) or local .env:
//   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
//   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
//   EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID
//   EXPO_PUBLIC_SENTRY_DSN
//   EAS_PROJECT_ID

module.exports = ({ config }) => {
  const EAS_PROJECT_ID =
    process.env.EAS_PROJECT_ID || '64489ed7-a8c0-41de-91ec-5846ea79a27f';

  // Client IDs are NOT secrets — they're embedded in the app bundle.
  // Hardcoded fallbacks ensure the URL scheme is always registered even
  // when EAS build env vars are not explicitly set.
  const GOOGLE_IOS_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    '514463516787-dm665i3u3a6un7eties8q73eik17vcs3.apps.googleusercontent.com';

  return {
    ...config,
    name: 'VarsityHub',
    slug: 'varsityhub',
    owner: 'varsity-hub',
    version: '1.0.2',
    runtimeVersion: '1.0.2',
    description:
      'The ultimate sports team management and social platform for athletes, coaches, and fans.',
    githubUrl: 'https://github.com/xsantcastx/VarsityHubMobile',
    icon: './assets/images/icon.png',
    scheme: 'varsityhubmobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    orientation: 'portrait',
    locales: {
      en: './locales/en.json',
    },
    updates: {
      enabled: true,
      fallbackToCacheTimeout: 0,
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    },
    ios: {
      buildNumber: '49',
      supportsTablet: true,
      appleTeamId: 'B5H8F69RW5',
      bundleIdentifier: 'com.varsithub.varsityhub-ios',
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'VarsityHub uses your camera to take photos and videos for team posts, profile pictures, and game highlights.',
        NSMicrophoneUsageDescription:
          'VarsityHub uses your microphone to capture audio when recording game-day videos and highlight clips.',
        NSPhotoLibraryUsageDescription:
          'VarsityHub uses your photo library so you can select existing photos and videos to share in team posts or set as your profile picture.',
        NSLocationWhenInUseUsageDescription:
          'VarsityHub uses your location to display nearby games, tournaments, and team events on the map.',
        NSPrivacyPolicyURL: 'https://varsityhub.app/privacy-policy',
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              'varsityhubmobile',
              'com.varsithub.varsityhub-ios',
              // Reversed Google iOS client ID for OAuth redirect
              // e.g. 514463516787-xxx.apps.googleusercontent.com → com.googleusercontent.apps.514463516787-xxx
              ...(GOOGLE_IOS_CLIENT_ID
                ? [`com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '')}`]
                : []),
            ],
          },
        ],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#000000',
      },
      softwareKeyboardLayoutMode: 'pan',
      edgeToEdgeEnabled: true,
      package: 'com.varsityhub.varsityhub',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.VIBRATE',
        'android.permission.INTERNET',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.ACCESS_MEDIA_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
      blockedPermissions: [
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/splash.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'VarsityHub uses your photo library to let you attach game photos, team logos, and other images to your posts.',
          cameraPermission:
            'VarsityHub uses your camera to capture photos and videos for team posts and profile pictures.',
          microphonePermission:
            'VarsityHub uses your microphone to record audio when capturing video highlights through the camera.',
        },
      ],
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: false,
          locationWhenInUsePermission:
            'VarsityHub uses your location to display nearby games, tournaments, and team events on the map.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'VarsityHub uses your photo library to let you browse and select images and videos for team posts and profiles.',
          savePhotosPermission:
            'VarsityHub uses save access to download shared team photos and game-day images to your device.',
          isAccessMediaLocationEnabled: true,
        },
      ],
      'expo-video',
      'expo-web-browser',
      'expo-secure-store',
      'expo-font',
      'expo-audio',
      'expo-apple-authentication',
      'expo-asset',
      'expo-notifications',
      './plugins/withAndroidManifestCleanup',
      './plugins/withAndroidLintExtraTranslationFix',
      './plugins/withAndroidBuildConfig',
      './plugins/withStripeProguardFix',
      './plugins/withGoogleMaps',
      './plugins/withGoogleOAuth',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: 'lime-productions',
          project: 'varsity-hub-mobile',
          uploadSourcemaps: false,
        },
      ],
      [
        '@stripe/stripe-react-native',
        {
          merchantIdentifier: 'merchant.app.varsityhub',
          enableGooglePay: true,
        },
      ],
      'react-native-iap',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: EAS_PROJECT_ID,
      },
      EXPO_PUBLIC_API_URL: 'https://api-production-8ac3.up.railway.app',
      EXPO_PUBLIC_FORCE_REMOTE_API: '1',
      EXPO_PUBLIC_NODE_ENV: 'production',
      EXPO_PUBLIC_APP_SCHEME: 'varsityhubmobile',
      EXPO_PUBLIC_WEB_BASE_URL: 'https://varsityhub.app',
      APP_STORE_PRIVACY_POLICY_URL: 'https://varsityhub.app/privacy-policy',

      // Sensitive values — loaded from environment variables
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
      EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      EXPO_PUBLIC_ADMIN_EMAILS:
        process.env.EXPO_PUBLIC_ADMIN_EMAILS || 'emancero@varsityhub.app',
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
        '514463516787-bhvkja2devf8mrk204pcti7nld90d2g9.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: GOOGLE_IOS_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
        '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID:
        process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
        '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_FORCE_PROXY: '0',
      EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME: '@varsity-hub/varsityhub',
    },
  };
};
