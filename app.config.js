const IS_DEV = process.env.EXPO_PUBLIC_ENV !== 'production';

// Import base config from app.json
const appJson = require('./app.json');

module.exports = () => {
  // Base plugins that are always needed
  const basePlugins = [
    "expo-router",
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff"
      }
    ],
    [
      "expo-image-picker",
      {
        "photosPermission": "Allow VarsityHub to access your photos to attach images to posts.",
        "cameraPermission": "Allow VarsityHub to use the camera for capturing photos and videos.",
        "microphonePermission": "Allow VarsityHub to access the microphone for recording videos."
      }
    ],
    "expo-video",
    "expo-web-browser",
    "expo-secure-store",
    "expo-font",
    "expo-audio"
  ];

  // Development-only plugins (expo-dev-client includes expo-dev-launcher and expo-dev-menu)
  const devPlugins = IS_DEV ? ["expo-dev-client"] : [];

  return {
    ...appJson.expo,
    plugins: [
      ...basePlugins,
      ...devPlugins
    ]
  };
};
