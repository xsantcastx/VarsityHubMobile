# VarsityHub Mobile - Google OAuth Setup Instructions

## ⚠️ Important: You Have the Wrong Client Type

The file you downloaded (`client_secret_...json`) is for **"Installed applications"** (desktop apps).

For **mobile apps** (React Native/Expo), you need to create:
1. ✅ **Android OAuth Client ID** (for Android devices)
2. ✅ **iOS OAuth Client ID** (for iOS devices)  
3. ✅ **Web OAuth Client ID** (for Expo Go/web testing)

---

## 🔧 How to Create Mobile OAuth Clients

### Step 1: Go to Google Cloud Console

1. Open: https://console.cloud.google.com/apis/credentials
2. Select your project: **varsityhub-474715**

---

### Step 2: Create Android OAuth Client ID

1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. **Application type:** Select `Android`
3. Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `VarsityHub Mobile Android` |
| **Package name** | `com.xsantcastx.varsityhub` |
| **SHA-1 certificate fingerprint** | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

4. Click **"CREATE"**
5. **Copy the Client ID** that appears (it will look like: `xxxxx-xxxxx.apps.googleusercontent.com`)

---

### Step 3: Create iOS OAuth Client ID

1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. **Application type:** Select `iOS`
3. Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `VarsityHub Mobile iOS` |
| **Bundle ID** | `com.xsantcastx.varsityhub` |

4. Click **"CREATE"**
5. **Copy the Client ID**

---

### Step 4: Create Web OAuth Client ID

1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. **Application type:** Select `Web application`
3. Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `VarsityHub Mobile Web` |
| **Authorized redirect URIs** | Add these two URLs: |
| | `http://localhost:8081` |
| | `https://auth.expo.io/@xsantcastx/VarsityHubMobile` |

4. Click **"CREATE"**
5. **Copy the Client ID**

---

### Step 5: Create/Update Your `.env` File

In your project root (`VarsityHubMobile/`), create a file called `.env` with:

```bash
# VarsityHub Mobile - Environment Variables

# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
EXPO_PUBLIC_NODE_ENV=development

# Google OAuth Configuration
# Replace with your actual Client IDs from Google Console
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID_HERE.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID_HERE.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com
```

**Example with fake IDs:**
```bash
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=234567-ghijkl.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=345678-mnopqr.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=345678-mnopqr.apps.googleusercontent.com
```

---

### Step 6: Restart Expo

After updating `.env`, restart your development server:

```bash
npx expo start --clear
```

---

## 📋 Quick Reference Card

### Your Project Details

| Property | Value |
|----------|-------|
| **Google Project ID** | `varsityhub-474715` |
| **Package Name (Android)** | `com.xsantcastx.varsityhub` |
| **Bundle ID (iOS)** | `com.xsantcastx.varsityhub` |
| **SHA-1 Fingerprint (Debug)** | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

---

## ✅ Checklist

After completing the setup:

- [ ] Created Android OAuth Client ID
- [ ] Created iOS OAuth Client ID
- [ ] Created Web OAuth Client ID
- [ ] Copied all 3 Client IDs
- [ ] Created `.env` file in project root
- [ ] Added all Client IDs to `.env`
- [ ] Restarted Expo with `--clear` flag
- [ ] Tested on Android device/emulator
- [ ] Tested on iOS device/simulator

---

## 🧪 Testing Google Sign-In

1. **Open your app** (on device or emulator)
2. **Navigate to Sign In screen**
3. **Look for the Google button** - it should now say:
   - ✅ **"Continue with Google"** (if configured correctly)
   - ❌ **"Google sign in unavailable"** (if `.env` not loaded)
4. **Click "Continue with Google"**
5. **Select your Google account**
6. **Grant permissions**
7. **You should be signed in!** 🎉

---

## 🔍 Troubleshooting

### "Google sign in unavailable" still showing

**Cause:** Environment variables not loaded

**Fix:**
1. Make sure `.env` file is in the **root** of your project (same folder as `package.json`)
2. Check file name is exactly `.env` (not `.env.txt` or `.env.local`)
3. Restart Expo: `npx expo start --clear`
4. Check environment variables are loaded:
   ```javascript
   console.log(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
   ```

### "Sign in failed" or "Invalid client"

**Cause:** Client ID doesn't match package name or SHA-1

**Fix:**
1. Double-check package name in Google Console: `com.xsantcastx.varsityhub`
2. Verify SHA-1 fingerprint: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
3. Make sure you're using the **Android** client ID for Android (not the "Installed" one)

### "12501: User cancelled the flow"

**Cause:** User closed the Google sign-in popup

**Fix:** This is normal - user just needs to try again

---

## 📚 Additional Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Expo Auth Session Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)

---

## 🔒 Security Reminder

⚠️ **NEVER commit your `.env` file to Git!**

Make sure `.env` is in your `.gitignore`:

```
# .gitignore
.env
.env.local
.env.production
```

---

**Project:** VarsityHub Mobile  
**Google Project:** varsityhub-474715  
**Setup Time:** ~15 minutes  
**Last Updated:** October 10, 2025
