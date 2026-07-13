# iOS & Android Submit/Build Fixes (Permanent)

## Android: ExtraTranslation / lintVitalRelease

**Cause:** Expo’s `withLocales` plugin writes `locales/en.json` into `android/.../values-b+en/strings.xml`. Lint then reports ExtraTranslation because `name` and `displayName` were only in that file, not in the default `values/strings.xml`.

**Fixes applied:**

1. **`locales/en.json`**  
   Removed `name` and `displayName` so Expo no longer puts them in `values-b+en/strings.xml`. File is now `{}`.

2. **Config plugin `withAndroidLintExtraTranslationFix`**
   - Runs after prebuild.
   - If `values-b+en/strings.xml` still exists and contains `name` or `displayName`, the plugin deletes that file (and the directory if empty).
   - Ensures `values/strings.xml` has `name` and `displayName` with `translatable="false"` if missing.

**Result:** No ExtraTranslation from `name`/`displayName`, and lintVitalRelease no longer fails for this.

---

## iOS: TestFlight “No suitable application records”

**Error:**  
`No suitable application records were found. Verify your bundle identifier "com.varsityhubmobile.app" is correct and that you are signed in with an Apple ID that has access to the app in App Store Connect. (-19000)`

**Cause:** The IPA’s bundle ID did not match the app record in App Store Connect (e.g. ASC app 6754257357 was created with a different bundle ID).

**Fix applied:**

- **Single bundle ID:** iOS is set to **`com.varsithub.varsityhub`** everywhere:
  - `app.json` → `ios.bundleIdentifier`: `com.varsithub.varsityhub`
  - `ios/VarsityHub.xcodeproj/project.pbxproj` already had `PRODUCT_BUNDLE_IDENTIFIER = com.varsithub.varsityhub`

**What you must do:**

1. In [App Store Connect](https://appstoreconnect.apple.com) → Your App (e.g. 6754257357) → App Information, check **Bundle ID**.
2. It must be exactly **`com.varsithub.varsityhub`** (same as Android).
3. If it was created as `com.varsityhubmobile.app` (or anything else), either:
   - Create a **new** app in ASC with bundle ID **`com.varsithub.varsityhub`** and use that app’s ASC App ID in `eas.json` → `submit.production.ios.ascAppId`, or
   - Change the project back to that other bundle ID (e.g. `com.varsityhubmobile.app`) in `app.json` and in the Xcode project, then run prebuild/rebuild and submit again.

After the bundle ID in the IPA and in App Store Connect match, TestFlight submit should succeed.
