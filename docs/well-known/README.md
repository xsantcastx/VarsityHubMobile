# Universal Links Configuration

These files enable **universal links** (iOS) and **App Links** (Android) so that shared web URLs like `https://varsityhub.app/posts/123` open directly in the VarsityHub app instead of the browser.

## Deployment

Place these files on your web server so they are accessible at:

| File | URL |
|------|-----|
| iOS | `https://varsityhub.app/.well-known/apple-app-site-association` |
| Android | `https://varsityhub.app/.well-known/assetlinks.json` |

**Important:**
- The `apple-app-site-association` file must be served **without** a `.json` extension
- Both files must be served with `Content-Type: application/json`
- Both must be served over **HTTPS**
- No redirects—serve directly from the canonical URL

## iOS: apple-app-site-association

- **Bundle ID:** `com.varsithub.varsityhub-ios`
- **Team ID:** `B5H8F69RW5`
- **App ID format:** `{TeamID}.{BundleID}` → `B5H8F69RW5.com.varsithub.varsityhub-ios`

Paths configured for deep linking:
- `/posts/*` — Post detail
- `/games/*` — Game detail
- `/teams/*` — Team profile
- `/users/*` — User profile
- `/events/*` — Event detail
- `/join/*` — Org/team invite links
- `/share` — Share endpoint (query params: type, id)

## Android: assetlinks.json

- **Package name:** `com.varsityhub.varsityhub`

**You must replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`** with your app’s SHA256 certificate fingerprint.

### Get your SHA256 fingerprint

**For release builds (Play Store / EAS):**
```bash
# If using a local keystore
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias

# If using EAS Build, get it from:
# eas credentials -p android
# Or from Google Play Console → Your app → Setup → App signing
```

**For debug builds:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Copy the **SHA256** value (format: `AA:BB:CC:DD:...`) and paste it into `assetlinks.json`, replacing the placeholder. You can use either colon-separated or no-colon format.

### Multiple certificates

If you have debug and release (or multiple signing keys), add all fingerprints:

```json
"sha256_cert_fingerprints": [
  "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
  "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF"
]
```

## App configuration

Ensure your app is configured for associated domains:

**iOS** (`app.json` / `app.config.js`):
- Add `associatedDomains: ["applinks:varsityhub.app", "applinks:www.varsityhub.app"]` if not already present via Expo config.

**Android** (`app.json`):
- Expo/React Native typically adds the intent filter for `assetlinks.json` when you configure the domain. Verify your `AndroidManifest.xml` includes the correct `android:autoVerify="true"` for the intent filter.

## Verification

**iOS:** Use [Apple’s AASA Validator](https://search.developer.apple.com/appsearch-validation-tool/) with `https://varsityhub.app`

**Android:** Use [Google’s Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator) or:
```bash
# Test that the file is reachable
curl -I https://varsityhub.app/.well-known/assetlinks.json
```
