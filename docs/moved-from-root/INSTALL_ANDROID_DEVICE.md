# Install App on Android Device

## Quick Steps

### Option 1: Using Expo Dev Server (Easiest)

1. **Start the Expo dev server:**

   ```bash
   npm start
   ```

2. **On your Android device:**
   - Install "Expo Go" app from Google Play Store (if not already installed)
   - Open Expo Go app
   - Scan the QR code shown in the terminal
   - The app will load on your device

### Option 2: Build and Install APK (For Development Build)

1. **Make sure your device is connected:**

   ```bash
   adb devices
   ```

   You should see your device listed.

2. **Enable USB Debugging on your device:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times to enable Developer Options
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

3. **Build and install:**

   ```bash
   npm run android
   ```

   Or if you need to select the device:

   ```bash
   npx expo run:android
   ```

   Then select your physical device from the list.

### Option 3: Manual APK Installation

1. **Build the APK:**

   ```bash
   cd android
   ./gradlew assembleDebug
   ```

2. **Find the APK:**
   The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Install on device:**
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

## Troubleshooting

### "Device not found"

- Make sure USB debugging is enabled
- Try different USB cable
- Try different USB port
- Run `adb kill-server && adb start-server`

### "Build failed"

- Make sure you have Android SDK installed
- Check `android/build.gradle` for version issues
- Try: `cd android && ./gradlew clean`

### "Permission denied"

- Make sure you authorized USB debugging on your device
- Check the popup on your device screen

## Current Issue

There's a Gradle build error with React Native plugin. To fix:

1. **Clean the build:**

   ```bash
   cd android
   ./gradlew clean
   ```

2. **Try building again:**
   ```bash
   cd ..
   npm run android
   ```

If the issue persists, you may need to update React Native or Gradle versions.
