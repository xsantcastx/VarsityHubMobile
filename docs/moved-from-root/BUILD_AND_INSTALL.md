# Build and Install App on Android Device

## Current Issue

There's a Gradle build error that prevents local building. The error is:

```
Error resolving plugin [id: 'com.facebook.react.settings'] > 25.0.1
```

## Solution: Use EAS Build (Recommended)

EAS Build handles all the build complexity in the cloud. Here's how:

### Step 1: Build APK with EAS

```bash
npx eas build --platform android --profile preview
```

This will:

- Build the APK in the cloud
- Download it when complete
- Handle all Gradle configuration automatically

### Step 2: Install on Device

Once the build completes, you'll get an APK file. Then:

```bash
# Find your device
adb devices

# Install the APK
adb install path/to/your-app.apk
```

## Alternative: Quick Manual Steps

Since you can't see the terminal, here's what to do:

1. **Open a regular terminal** (not in Cursor)
2. **Navigate to project:**

   ```bash
   cd /Users/varsityhub/VarsityHubMobile
   ```

3. **Build with EAS:**

   ```bash
   npx eas build --platform android --profile preview
   ```

4. **Wait for build to complete** (takes 10-15 minutes)

5. **Download the APK** from the EAS dashboard or link provided

6. **Install on device:**
   ```bash
   adb install ~/Downloads/your-app.apk
   ```

## Quick Alternative: Use Expo Go (Fastest)

If you just want to test the app quickly:

1. **Install Expo Go** on your Android device from Play Store
2. **Start dev server:**
   ```bash
   npm start
   ```
3. **Scan QR code** with Expo Go app

This is the fastest way to test, but requires Expo Go app.

## Fix Gradle Issue (For Future)

The Gradle error needs investigation. It might be:

- Gradle version incompatibility
- React Native Gradle plugin version issue
- Version catalog resolution problem

To fix later, you may need to:

- Update Gradle version
- Update React Native
- Check `android/gradle/libs.versions.toml` if it exists
