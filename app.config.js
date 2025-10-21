// Import base config from app.json
const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  plugins: [
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
  ]
};
