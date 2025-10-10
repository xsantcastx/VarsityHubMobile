# Android SHA-1 Fingerprints for VarsityHub Mobile

## Package Information
- **Package Name:** `com.xsantcastx.varsityhub`
- **Bundle ID (iOS):** `com.xsantcastx.varsityhub`

---

## Debug Keystore (For Development)

### SHA-1 Fingerprint
```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

### SHA-256 Fingerprint
```
FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```

### Keystore Details
- **Location:** `android/app/debug.keystore`
- **Alias:** `androiddebugkey`
- **Password:** `android` (default)
- **Valid Until:** May 1, 2052

### Command to Get SHA-1 (Debug)
```bash
keytool -keystore android/app/debug.keystore -list -v -storepass android -keypass android
```

---

## Google OAuth Console Setup

### Step 1: Create Android OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create "VarsityHub Mobile")
3. Navigate to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth client ID"**
5. Select **Application type:** Android

### Step 2: Fill in the Form

| Field | Value |
|-------|-------|
| **Name** | VarsityHub Mobile Android (Debug) |
| **Package name** | `com.xsantcastx.varsityhub` |
| **SHA-1 certificate fingerprint** | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

6. Click **"Create"**
7. **Copy the Client ID** that appears (format: `xxxxx-xxxxx.apps.googleusercontent.com`)

### Step 3: Add to Environment Variables

Add to your `.env` file:

```bash
# Google OAuth - Android
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID_HERE.apps.googleusercontent.com
```

---

## Production Keystore (For App Store Release)

⚠️ **You'll need to create a production keystore before releasing to Google Play Store.**

### Create Production Keystore

```bash
keytool -genkeypair -v -keystore release.keystore -alias varsityhub-release -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted to enter:
- **Keystore password:** (choose a strong password)
- **First and last name:** Your name or company name
- **Organizational unit:** (e.g., "Development")
- **Organization:** (e.g., "VarsityHub")
- **City:** Your city
- **State:** Your state
- **Country code:** (e.g., "US")

### Get Production SHA-1

After creating the production keystore:

```bash
keytool -keystore release.keystore -list -v
```

Then create a **second** Android OAuth Client ID in Google Console with:
- **Name:** VarsityHub Mobile Android (Production)
- **Package name:** `com.xsantcastx.varsityhub`
- **SHA-1:** (from production keystore)

---

## iOS Setup (Separate OAuth Client)

For iOS, create an **iOS OAuth Client ID**:

1. **Application type:** iOS
2. **Name:** VarsityHub Mobile iOS
3. **Bundle ID:** `com.xsantcastx.varsityhub`

Add to `.env`:
```bash
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID_HERE.apps.googleusercontent.com
```

---

## Web Setup (For Expo Go / Development)

For web/Expo Go, create a **Web OAuth Client ID**:

1. **Application type:** Web application
2. **Name:** VarsityHub Mobile Web
3. **Authorized redirect URIs:**
   - `http://localhost:8081`
   - `https://auth.expo.io/@xsantcastx/VarsityHubMobile`

Add to `.env`:
```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com
```

---

## Complete .env Example

```bash
# VarsityHub Mobile - Environment Variables

# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
EXPO_PUBLIC_NODE_ENV=development

# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx-xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=yyyyy-yyyyy.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=zzzzz-zzzzz.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=zzzzz-zzzzz.apps.googleusercontent.com
```

---

## Verification Checklist

- [ ] Debug SHA-1 added to Google Console (Android Debug client)
- [ ] Android Debug Client ID copied
- [ ] iOS Client ID created and copied
- [ ] Web Client ID created and copied
- [ ] All Client IDs added to `.env` file
- [ ] Expo server restarted: `npx expo start --clear`
- [ ] Tested Google Sign-In on Android device/emulator
- [ ] Tested Google Sign-In on iOS device/simulator

---

## Troubleshooting

### "Sign in failed" or "Invalid client"
- Double-check package name matches exactly: `com.xsantcastx.varsityhub`
- Verify SHA-1 fingerprint is correct (no extra spaces or characters)
- Make sure you're using the **Debug** keystore for development
- Restart Metro bundler after adding client IDs

### "Google sign in unavailable"
- Check `.env` file exists in project root
- Verify environment variables are loaded
- Restart Expo: `npx expo start --clear`

---

## Security Notes

⚠️ **IMPORTANT:**
- **Never commit `.env` to git** (add to `.gitignore`)
- **Never share your production keystore** publicly
- **Store production keystore password securely** (use password manager)
- **Backup production keystore** (losing it means you can't update your app)

---

## Next Steps

1. ✅ SHA-1 fingerprint obtained: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
2. ⏳ Create Android OAuth Client ID in Google Console
3. ⏳ Create iOS OAuth Client ID in Google Console
4. ⏳ Create Web OAuth Client ID in Google Console
5. ⏳ Add all Client IDs to `.env` file
6. ⏳ Test Google Sign-In on device

**Estimated Time:** 15-20 minutes

---

**Generated:** October 10, 2025  
**For:** VarsityHub Mobile (Development)
