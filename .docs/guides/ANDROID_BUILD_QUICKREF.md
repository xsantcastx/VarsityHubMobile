# Android Build Quick Reference Guide

**Quick Navigation for Android Build Operations**  
**Last Updated:** December 25, 2025

---

## 🚀 Quick Commands

### Build Operations

```bash
# ============ DEVELOPMENT ============
# Debug build (fast, unoptimized)
eas build --platform android --profile development

# Local debug build
cd android && ./gradlew assembleDebug

# ============ TESTING ============
# Preview build (internal distribution, beta-like)
eas build --platform android --profile preview

# Simulator/emulator build
eas build --platform android --profile simulator

# ============ PRODUCTION ============
# Production release (Google Play Store)
eas build --platform android --profile production

# ============ MAINTENANCE ============
# Clean build (remove cache)
cd android && ./gradlew clean assembleRelease

# Check Gradle version
./gradlew --version

# Show dependency tree
./gradlew dependencies

# Check for dependency conflicts
./gradlew dependencies --configuration releaseRuntimeClasspath
```

---

## 📊 Build Profiles

| Profile | Use Case | Distribution | Resource Class | Time |
|---------|----------|--------------|-----------------|------|
| **development** | Feature testing, hot reload | Internal | medium | 3-5 min |
| **simulator** | Emulator testing | Internal | medium | 3-5 min |
| **preview** | Beta testing, QA | Internal (QR code) | medium | 3-5 min |
| **production** | Google Play Store release | Store | large | 8-12 min |
| **internal** | Internal release track | Internal (Play Console) | large | 8-12 min |

---

## 🔑 Signing & Credentials

### Environment Variables (for CI/CD)
```bash
# EAS Build automatically uses these
export ANDROID_KEYSTORE_FILE="path/to/keystore.jks"
export ANDROID_KEYSTORE_PASSWORD="xxx"
export ANDROID_KEY_ALIAS="varsity-hub-key"
export ANDROID_KEY_PASSWORD="xxx"

# EAS Build will handle signing automatically
eas build --platform android --profile production
```

### Local Development
```bash
# Create keystore.properties
cat > android/keystore.properties << EOF
storeFile=/path/to/@varsity-hub__varsityhub-ios.jks
storePassword=<password>
keyAlias=varsity-hub-key
keyPassword=<password>
EOF

# Never commit this file!
echo "android/keystore.properties" >> .gitignore
```

---

## 📦 Build Outputs

### APK Locations

```
Debug:
  android/app/build/outputs/apk/debug/
    └── app-debug.apk (~80-100 MB)

Release:
  android/app/build/outputs/apk/release/
    └── app-release.apk (~45-50 MB)

App Bundle (for Play Store):
  android/app/build/outputs/bundle/release/
    └── app-release.aab (~40-45 MB)
```

### Installation

```bash
# Install APK to connected device
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Install release APK
adb install android/app/build/outputs/apk/release/app-release.apk

# Uninstall app
adb uninstall app.varsity
```

---

## 🎯 Configuration Summary

| Setting | Value | Notes |
|---------|-------|-------|
| **Package Name** | `app.varsity` | Unique identifier in Play Store |
| **Min SDK** | 24 (Android 7.0) | Covers 99%+ of devices |
| **Target SDK** | 34 (Android 14) | Play Store requirement |
| **Build Tools** | 34.0.0 | Latest stable |
| **Gradle** | 8.5.2 | Locked in gradle-wrapper.properties |
| **Kotlin** | 1.9.25 | Latest stable for Gradle 8.5.2 |
| **Hermes Engine** | Enabled | 50% faster startup |
| **R8/ProGuard** | Enabled (release) | 40% code size reduction |
| **Resource Shrinking** | Enabled (release) | 15% resource size reduction |

---

## 🔐 Security Checklist

- [ ] `android:usesCleartextTraffic="false"` (HTTPS only)
- [ ] `android:allowBackup="false"` (no device backups)
- [ ] `android:debuggable="false"` (release build only)
- [ ] `minifyEnabled=true` (R8 obfuscation, release only)
- [ ] ProGuard rules configured (keep critical libraries)
- [ ] Certificate pinning (Axios interceptors)
- [ ] Permissions request at runtime (not just manifest)
- [ ] Biometric auth for sensitive features
- [ ] Sentry crash reporting enabled
- [ ] `npm audit` results clean

---

## 📋 Pre-Release Checklist

```bash
# 1. Update version
#    - Increment versionCode in eas.json
#    - Update versionName in app.json (e.g., "1.0.2")

# 2. Run quality checks
npm run lint:strict       # Linting + type checking
npm test                  # Unit tests
npm run test:smoke        # E2E tests (optional)

# 3. Security audit
npm audit
npm audit fix             # Auto-fix if possible

# 4. Build locally for testing
cd android && ./gradlew assembleDebug

# 5. Test on physical device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 6. Verify API endpoints
# - Check EXPO_PUBLIC_API_URL points to production
# - Verify all env vars in eas.json

# 7. Trigger production build
eas build --platform android --profile production

# 8. Monitor build in console
eas build:list

# 9. Once built, submit to Play Store
eas submit --platform android --profile production
```

---

## 📱 Testing & Debugging

### Device Testing

```bash
# List connected devices
adb devices

# Install and run app
adb shell am start -n app.varsity/.MainActivity

# View logs
adb logcat
adb logcat | grep "VARSITY"
adb logcat | grep "ERROR"

# Monitor app memory
adb shell dumpsys meminfo app.varsity

# Take screenshot
adb shell screencap /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# Simulate network issues
adb shell pm grant app.varsity android.permission.CHANGE_NETWORK_STATE
adb shell dumpsys connectivity | grep "mEnabled"
```

### Emulator Testing

```bash
# List Android Virtual Devices
emulator -list-avds

# Launch emulator
emulator -avd Pixel_4_API_30

# Install on emulator
adb -e install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🐛 Troubleshooting

### Build Failures

```bash
# Clear all caches
rm -rf ~/.gradle/caches
rm -rf .gradle/
rm -rf android/build/

# Rebuild
./gradlew clean assembleRelease --stacktrace

# Check Java version
java -version  # Should be 11 or later

# Upgrade Gradle
./gradlew wrapper --gradle-version=8.5.2
```

### Memory Issues

```bash
# Increase Gradle heap
export GRADLE_OPTS="-Xmx4096m"
./gradlew assembleRelease

# Or in gradle.properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

### Dependency Conflicts

```bash
# Show dependency tree with conflicts
./gradlew dependencies --configuration releaseRuntimeClasspath

# Force specific version
# In android/app/build.gradle:
dependencies {
    implementation('com.stripe:stripe-android') {
        version { prefer '20.40.0' }
    }
}
```

---

## 📈 Build Time Optimization

| Technique | Time Saved | Difficulty |
|-----------|-----------|-----------|
| Gradle parallel builds | 20-30% | Easy (enabled by default) |
| Gradle daemon | 30-50% | Easy (automatic) |
| Gradle build cache | 40-60% | Medium |
| Split APKs | Not for build, but for distribution | Medium |

```bash
# Enable all optimizations
cat >> android/gradle.properties << EOF
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
EOF
```

---

## 🎬 Release Process

### Step-by-Step

1. **Prepare**
   ```bash
   # Update versions
   # Run tests
   npm run lint:strict && npm test
   ```

2. **Build**
   ```bash
   eas build --platform android --profile production
   ```

3. **Monitor**
   ```bash
   eas build:list  # Check status
   ```

4. **Submit**
   ```bash
   eas submit --platform android --profile production
   ```

5. **Review**
   - Google Play Console → Internal testing → Release
   - Review app content, privacy policy, etc.
   - Set rollout percentage (e.g., 10%, 25%, 100%)

6. **Monitor**
   - Check Sentry for crashes
   - Monitor Play Store reviews
   - Check ANR (Application Not Responding) rates

### Rollback Plan

```bash
# If critical issues found, roll back to previous version
# In Google Play Console:
# 1. Stop rollout of current version
# 2. Increase rollout of previous version (if available)
# 3. Or create hotfix build with version code + 1
```

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `app.json` | Expo configuration, versions, metadata |
| `eas.json` | Build profiles and signing config |
| `android/build.gradle` | Top-level Gradle configuration |
| `android/app/build.gradle` | App-level Gradle, dependencies |
| `android/gradle.properties` | Build variables (JVM, architectures) |
| `android/app/proguard-rules.pro` | R8/ProGuard obfuscation rules |
| `android/app/src/main/AndroidManifest.xml` | Manifest (generated by Expo) |
| `package.json` | NPM dependencies |
| `package-lock.json` | Locked dependency versions |

---

## 🔗 Useful Links

- [Expo Build Documentation](https://docs.expo.dev/build/setup/)
- [Android Gradle Plugin Docs](https://developer.android.com/studio/build)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [ProGuard/R8 Rules](https://www.guardsquare.com/manual/configuration/usage)
- [React Native Android Docs](https://reactnative.dev/docs/android-setup)

---

## 📞 Support & Questions

For Android build issues:
1. Check `.docs/architecture/ANDROID_SYSTEM_ARCHITECTURE_AUDIT.md` (comprehensive)
2. Check `.docs/architecture/ANDROID_BUILD_CONFIGURATION_DEEPDIVE.md` (detailed config)
3. Check troubleshooting section above
4. Review build logs in EAS Build console
5. Check Sentry for runtime errors
