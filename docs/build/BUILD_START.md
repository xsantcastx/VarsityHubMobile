# 🚀 QUICK START: Build Your iOS & Android Apps

## Prerequisites ✓

```bash
# 1. Install dependencies
npm install
yarn install  # or yarn if you use yarn

# 2. Login to EAS
eas login
# Follow prompts with your Expo account

# 3. Verify Java 17 is available
java -version
# Should show "17.x.x"

# 4. Verify all secrets are set in EAS dashboard
eas secret list
# Must include:
#   - SENTRY_AUTH_TOKEN
#   - GOOGLE_MAPS_API_KEY (optional but recommended)
```

## Build Commands

### 📱 iOS Builds

```bash
# Development (live reload, fastest)
eas build --platform ios --profile development

# Preview (internal testing)
eas build --platform ios --profile preview

# Production (app store submission)
eas build --platform ios --profile production
```

### 🤖 Android Builds

```bash
# Development (APK, fastest)
eas build --platform android --profile development

# Preview (APK, internal testing)
eas build --platform android --profile preview

# Production (AAB for Play Store)
eas build --platform android --profile production
```

### 🔄 Build Both Platforms Simultaneously

```bash
eas build --platform all --profile preview
```

## What Gets Built Where?

| Profile | iOS Output | Android Output | Use Case |
|---------|-----------|-----------------|----------|
| development | IPA (dev) | APK | Local testing with simulator |
| preview | IPA (adhoc) | APK | Internal testing |
| production | IPA (release) | AAB | App Store + Play Store |

## Monitoring Your Build

```bash
# Check build status
eas build:list

# View detailed build logs
eas build:view <BUILD_ID>

# View all recent builds
eas build:list --limit 10
```

## Submitting to App Stores

Once builds complete successfully:

```bash
# Submit iOS to App Store
eas submit --platform ios --profile production

# Submit Android to Play Store
eas submit --platform android --profile production
```

## Troubleshooting

### Build Fails with Java Version Error
```bash
# Verify Java 17 is set
/usr/libexec/java_home -v 17

# Update gradle.properties to point to Java 17
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

### Build Fails with "Sentry upload failed"
```bash
# Verify SENTRY_AUTH_TOKEN is set
eas secret list | grep SENTRY

# If missing, add it
eas secret push --name SENTRY_AUTH_TOKEN --value <your-token>
```

### Build Fails with "Cannot find Google Maps API key"
```bash
# Set it in EAS secrets
eas secret push --name GOOGLE_MAPS_API_KEY --value <your-key>
```

## Configuration Files (Don't Touch These)

These are already configured and tested:
- `app.json` - Bundle IDs, app metadata
- `app.config.js` - Environment variable injection
- `eas.json` - Build profiles and settings
- `android/build.gradle` - Android SDK versions
- `ios/Podfile.properties.json` - iOS deployment target

## Current Configuration Summary

✅ **iOS**: Bundle ID `com.varsithub.varsityhub` | Team ID `B5H8F69RW5` | Target 15.1
✅ **Android**: Package `com.varsithub.varsityhub` | Target SDK 36 | Java 17
✅ **Sentry**: `lime-productions` org, `varsityhub` project
✅ **Maps**: Configured to inject API key via environment
✅ **EAS**: All profiles configured (development, preview, production)

## Example: Complete Build & Test Flow

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Login to EAS (first time only)
eas login

# 3. Build preview for iOS
eas build --platform ios --profile preview

# 4. Build preview for Android
eas build --platform android --profile preview

# 5. Monitor builds
eas build:list

# 6. Download and test on devices/emulators
# iOS: Use TestFlight
# Android: Use internal distribution or direct APK

# 7. When ready for production
eas build --platform all --profile production

# 8. Submit to stores
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

**Need help?** Check `BUILD_REQUIREMENTS.md` for detailed configuration reference.
