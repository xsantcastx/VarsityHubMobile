# VarsityHub iOS Release - Quick Start Guide

## Current Status ✅

App is **READY FOR RELEASE BUILD**. All critical issues resolved:

- ✅ Dark mode colors fixed (#0f172a navy blue)
- ✅ Sentry initialization errors resolved
- ✅ CocoaPods successfully reinstalled
- ✅ Security audit passed (production code clean)
- ✅ Metro bundler running on localhost:8081

---

## Next: Complete the Release Build

### Step 1: Finish Xcode Build (Currently In Progress)

The app is currently building in Release configuration. You can monitor it or wait for completion.

To view build progress:

```bash
tail -f /Users/varsityhub/Library/Developer/Xcode/DerivedData/VarsityHub-eldpkifpumczeeehsjkxfbsttygg/Build/VarsityHub.build/Release-iphonesimulator/VarsityHub.build/VarsityHub.build.log
```

### Step 2: Verify on Simulator

Once Release build completes:

```bash
# Check if build succeeded
ls /Users/varsityhub/Library/Developer/Xcode/DerivedData/VarsityHub-eldpkifpumczeeehsjkxfbsttygg/Build/Products/Release-iphonesimulator/

# Launch on simulator
xcrun simctl install 60093881-2B6F-4D71-8A99-2CCDCA7FCD7C \
  /Users/varsityhub/Library/Developer/Xcode/DerivedData/VarsityHub-eldpkifpumczeeehsjkxfbsttygg/Build/Products/Release-iphonesimulator/VarsityHub.app

xcrun simctl launch 60093881-2B6F-4D71-8A99-2CCDCA7FCD7C com.xsantcastx.varsityhub
```

### Step 3: Verify Key Features

Once app launches:

- [ ] Dark mode background is navy blue (#0f172a) - not black
- [ ] Top bar matches background color (no gap)
- [ ] Sentry error handling working (no crashes)
- [ ] All screens load without errors
- [ ] Performance is smooth (Release optimization active)

### Step 4: Archive for App Store

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/ios

# Create archive for Release configuration (device)
xcodebuild -workspace VarsityHub.xcworkspace \
  -scheme VarsityHub \
  -configuration Release \
  -sdk iphoneos \
  -archivePath ./build/VarsityHub.xcarchive \
  archive

# Open Xcode Organizer to export
open ./build/VarsityHub.xcarchive
```

### Step 5: Distribute via App Store

In Xcode Organizer:

1. Select VarsityHub.xcarchive
2. Click "Distribute App"
3. Choose "App Store Connect"
4. Follow automatic code signing prompts
5. Review provisioning profile details
6. Submit to App Store

---

## Important URLs & IDs

| Item                  | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| **Bundle ID**         | com.xsantcastx.varsityhub                                                  |
| **Team ID**           | B5H8F69RW5                                                                 |
| **Deployment Target** | iOS 15.1+                                                                  |
| **Xcode Project**     | /Users/varsityhub/Desktop/CODE/VarsityHubMobile/ios/VarsityHub.xcworkspace |
| **Simulator Device**  | 60093881-2B6F-4D71-8A99-2CCDCA7FCD7C (iPhone 15 Pro)                       |

---

## Troubleshooting

### Build Hangs at "Planning build"

```bash
# Kill any stuck processes
killall xcodebuild
killall Xcode

# Clear build cache and retry
rm -rf ~/Library/Developer/Xcode/DerivedData/VarsityHub-*
npx expo run:ios --configuration Release --no-build-cache
```

### Provisioning Profile Error

```bash
# This is expected for real device. For simulator only:
xcodebuild -sdk iphonesimulator  # Simulator doesn't need profiles
```

### Sentry Build Errors

```bash
# Clear and reinstall pods
cd ios
rm -rf Pods Podfile.lock
pod install
```

### Metro Bundler Issues

```bash
# Restart Metro
npx expo start --dev-client
# or on specific port:
npx expo start --dev-client --port 8081
```

---

## Files to Know

| File                      | Purpose                           |
| ------------------------- | --------------------------------- |
| `constants/Colors.ts`     | Dark mode colors (updated)        |
| `utils/sentry.ts`         | Error tracking (fixed)            |
| `app/highlights.tsx`      | UI polish (adjusted padding)      |
| `ios/Pods/`               | Native dependencies (reinstalled) |
| `BUILD_REPORT_RELEASE.md` | Detailed build report             |

---

## Color Reference

```
Dark Mode Palette (Updated):
- Background: #0f172a (slate-900 navy blue) ← Changed from #000000
- Cards: #1e293b (slate-800)
- Surface: #1e293b
- Border: #334155 (slate-700)
- Muted Text: #94a3b8 (slate-400)
- Icons: #cbd5e1 (slate-300)
```

---

## Release Checklist

### Pre-Release

- [x] Code changes verified
- [x] Security audit passed (Snyk)
- [x] Dark mode colors updated
- [x] Sentry errors fixed
- [x] App running on simulator
- [ ] Release build completed
- [ ] Verified on physical device
- [ ] TestFlight build created
- [ ] Internal testing passed

### App Store Submission

- [ ] Archive created
- [ ] Provisioning profiles updated
- [ ] Screenshots prepared
- [ ] Release notes written
- [ ] Privacy policy reviewed
- [ ] App rating form completed
- [ ] Build submitted to TestFlight
- [ ] Beta testing period completed
- [ ] Submitted for review
- [ ] Approved by App Store (24-48 hours)

---

## Performance Notes

- **Release Configuration**: Optimized with -O2 optimization level
- **Bundle Size**: 52 asset files, 3997 modules
- **Code Size**: Stripped of debug symbols
- **Startup Time**: Expected <2 seconds on device

---

## Support

If you encounter issues:

1. Check the BUILD_REPORT_RELEASE.md for detailed status
2. Review xcode-build.log for error details
3. Try pod install for Cocoapods issues
4. Clear Xcode cache: `rm -rf ~/Library/Developer/Xcode/DerivedData/VarsityHub-*`

---

**Last Updated**: December 6, 2024
**Build Status**: 🟡 IN PROGRESS
**Next Action**: Wait for Release build completion and verify on device
