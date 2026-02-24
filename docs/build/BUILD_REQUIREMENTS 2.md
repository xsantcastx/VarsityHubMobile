# Build Requirements & Configuration Checklist

## ✅ Complete Configuration Status

### 1. **Bundle Identifiers** (BOTH PLATFORMS MATCH)
- **iOS**: `com.varsithub.varsityhub` ✅
- **Android**: `com.varsithub.varsityhub` ✅
- **Source**: `app.json` (iOS) + `android/app/build.gradle` (Android)

### 2. **Apple Configuration**
- **Team ID**: `B5H8F69RW5` ✅
- **Location**: `app.json` → `ios.appleTeamId`
- **ASC App ID**: `6754257357` (in `eas.json` submit config)
- **Certificate**: Managed via EAS

### 3. **Android Configuration**
- **Package Name**: `com.varsithub.varsityhub` ✅
- **Min SDK**: 24 ✅
- **Target SDK**: 36 ✅
- **Compile SDK**: 36 ✅
- **Build Tools**: 36.0.0 ✅
- **NDK Version**: 27.1.12297006 ✅
- **Java**: JDK 17 ✅
- **Signing**: Via EAS environment variables (ANDROID_KEYSTORE_PATH, etc.)

### 4. **Sentry Configuration**
- **Organization**: `varsity-hub` ✅
- **Project**: `varsity-hub-mobile` ✅
- **DSN**: Set via `SENTRY_DSN` environment variable
- **Profiles**: Development, Preview, Production all configured
- **Properties Files**:
  - `android/sentry.properties` ✅
  - `ios/sentry.properties` ✅

### 5. **Expo & JavaScript**
- **Expo Version**: 54.0.32 ✅
- **React Native**: 0.81.5 ✅
- **Node.js**: 20.19.4 (EAS builds) ✅
- **Hermes**: Enabled ✅
- **New Architecture**: Enabled ✅

### 6. **EAS Build Configuration**
All build profiles properly configured in `eas.json`:

#### Development Profile
- Distribution: `internal`
- Development Client: `true`
- Build Type: 
  - iOS: Debug
  - Android: APK
- Sentry: Enabled ✅

#### Preview Profile
- Distribution: `internal`
- Build Type:
  - iOS: Release
  - Android: APK
- Sentry: Enabled ✅

#### Production Profile
- Distribution: `store`
- Auto-increment: `true`
- Build Type:
  - iOS: Release (IPA)
  - Android: Bundle (AAB)
- Sentry: Enabled ✅

### 7. **Google Maps API**
- **Key**: Set via `GOOGLE_MAPS_API_KEY` environment variable
- **iOS Config**: `ios.config.googleMapsApiKey` (in app.config.js)
- **Android Config**: `android.config.googleMaps.apiKey` (in app.config.js)
- **Extra Config**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for app access

### 8. **iOS Specific**
- **Deployment Target**: 15.1 ✅
- **Podfile**: Using Expo autolink ✅
- **Cocoapods**: Managed by Expo
- **Build Config**: Xcode schema handled by EAS

### 9. **Android Specific**
- **Gradle**: 8.14.3 ✅
- **Gradle Properties**:
  - Java Home: `/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home`
  - JVM Memory: `-Xmx2048m`
  - Parallel builds: `true`
- **Kotlin**: Latest version ✅
- **AGP**: Latest version ✅

### 10. **Environment Variables Required for EAS Builds**

Add to EAS Secrets Dashboard (`eas secret push --scope project`):

```bash
# Required for all builds
SENTRY_AUTH_TOKEN=<your-sentry-auth-token>
SENTRY_ORG=varsity-hub
SENTRY_PROJECT=varsity-hub-mobile

# Required for production (Android)
ANDROID_KEYSTORE_PATH=./android/varsityhub-release.keystore
ANDROID_KEYSTORE_PASSWORD=<keystore-password>
ANDROID_KEY_ALIAS=varsithub
ANDROID_KEY_PASSWORD=<key-password>

# Optional but recommended
GOOGLE_MAPS_API_KEY=<your-google-maps-key>
EXPO_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
```

## 🔧 Build Commands

```bash
# Development (for testing on internal hardware)
eas build --platform ios --profile development
eas build --platform android --profile development

# Preview (internal testing)
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production (for app stores)
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores (after building)
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## ✅ Pre-Build Checklist

Before running EAS build, verify:

- [ ] `SENTRY_AUTH_TOKEN` is set in EAS secrets
- [ ] `ANDROID_KEYSTORE_*` vars are set for Android production builds
- [ ] Bundle identifier matches in `app.json` and Android config
- [ ] All environment variables in `app.json` extra section are populated
- [ ] Sentry org/project are correct (`varsity-hub` / `varsity-hub-mobile`)
- [ ] `app.config.js` is not present in git (should only exist locally for development)
- [ ] EAS CLI is latest version: `npm install -g eas-cli@latest`

## 📋 Configuration Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `app.json` | Main Expo config | ✅ Complete |
| `app.config.js` | Dynamic config (env injection) | ✅ Complete |
| `eas.json` | EAS build profiles | ✅ Complete |
| `android/build.gradle` | Android root config | ✅ Complete |
| `android/app/build.gradle` | Android app config | ✅ Complete |
| `android/gradle.properties` | Gradle settings | ✅ Complete |
| `android/sentry.properties` | Sentry Android | ✅ Complete |
| `ios/Podfile` | CocoaPods config | ✅ Complete |
| `ios/Podfile.properties.json` | iOS build properties | ✅ Complete |
| `ios/sentry.properties` | Sentry iOS | ✅ Complete |

## 🚀 Known Working Configuration

This configuration has been tested with:
- Expo SDK 54
- EAS CLI v16.19.3+
- macOS 14+
- iOS 15.1+
- Android 6.0+ (API 24+)
- Sentry React Native v7.2.0
