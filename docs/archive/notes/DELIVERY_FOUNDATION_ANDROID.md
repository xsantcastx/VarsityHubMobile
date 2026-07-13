# VarsityHub Android Delivery Foundation

**Status**: Infrastructure prepared, awaiting keystore + release run  
**Date**: December 6, 2025  
**Build Configuration**: Release (Android)

---

## ✅ Build & Compilation

- [ ] `./scripts/build-release-android.sh` completes without errors
- [ ] `bundleRelease` generates `app-release.aab`
- [ ] `assembleRelease` generates `app-release.apk`
- [ ] Hermes enabled (per `gradle.properties`)
- [ ] React Native new architecture enabled

## ✅ Configuration Checklist

| Item                           | Status                                       | Notes |
| ------------------------------ | -------------------------------------------- | ----- |
| Package name (`applicationId`) | ✅ `com.xsantcastx.varsityhub`               |
| Version code / name            | ⏳ ensure increment each release             |
| Google Maps API key            | ✅ defined in `app.json`                     |
| Permissions                    | ✅ Camera, Location, Storage                 |
| Edge-to-edge UI                | ✅ enabled                                   |
| Signing config                 | ⏳ configure via `MYAPP_UPLOAD_*` properties |
| Play Console metadata          | ⏳ add screenshots + text                    |

## 🔐 Security & Privacy

- [ ] Keystore stored securely (not in git)
- [ ] `snyk_code_scan` shows no high severity issues
- [ ] Debug-only endpoints disabled/guarded
- [ ] Crash/analytics SDKs documented in Data Safety form
- [ ] No `console.log` in server routes (use `debugLog`)

## 🧪 Validation Flow

```bash
./scripts/pre-submission-check-android.sh   # verifies config + keystore
./scripts/build-release-android.sh          # builds signed artifacts
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 📄 Required Docs

- `RELEASE_READY_ANDROID.md` – submission steps
- `ANDROID_KEYSTORE_SETUP.md` – signing guide
- `DELIVERY_INDEX.md` – navigation hub (Android section)

## 🛠 Remaining Tasks

1. Configure keystore & secrets (`ANDROID_KEYSTORE_SETUP.md`)
2. Run Android pre-check script
3. Generate signed AAB
4. Upload to Google Play Console
5. Complete store listing (screenshots, descriptions, content rating, data safety)
6. Publish to desired track

Once these boxes are checked, Android delivery reaches feature parity with iOS. 🚀
