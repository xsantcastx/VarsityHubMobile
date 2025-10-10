# Google OAuth Setup Guide

This guide explains how to configure Google Sign-In for VarsityHub Mobile.

## Current Status

✅ **Google OAuth UI is implemented**  
✅ **Graceful fallback when not configured**  
❌ **OAuth credentials not yet configured**

When Google OAuth is not configured, users will see:
> "Google sign in unavailable - Configure Google OAuth client IDs to enable one-tap login"

Users can still sign in using **email/password authentication**.

---

## Why Configure Google OAuth?

- ✅ **One-tap login** - Users sign in with existing Google accounts
- ✅ **Reduced friction** - No password to remember
- ✅ **Faster onboarding** - Auto-fill name and email
- ✅ **Verified emails** - Google accounts are already verified
- ✅ **Better conversion** - 30-40% higher signup rates

---

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: **VarsityHub Mobile**
4. Click "Create"

### 2. Enable Google+ API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click "Enable"

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click "Create"
4. Fill in required fields:
   - **App name:** VarsityHub Mobile
   - **User support email:** customerservice@varsityhub.app
   - **Developer contact:** customerservice@varsityhub.app
5. Click "Save and Continue"
6. **Scopes:** Click "Add or Remove Scopes"
   - Select: `userinfo.email`
   - Select: `userinfo.profile`
7. Click "Save and Continue"
8. **Test users:** Add your email for testing
9. Click "Save and Continue"

### 4. Create OAuth 2.0 Client IDs

#### A. Android Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Android**
4. Name: **VarsityHub Mobile Android**
5. **Package name:** Get from `app.json` → `expo.android.package`
   - Example: `com.varsityhub.mobile`
6. **SHA-1 certificate fingerprint:**
   - For development: Run `npx expo prebuild` then:
     ```bash
     # macOS/Linux
     keytool -keystore android/app/debug.keystore -list -v
     
     # Windows
     keytool -keystore android\app\debug.keystore -list -v
     
     # Default password: android
     ```
   - Copy the SHA-1 fingerprint
7. Click "Create"
8. **Copy the Client ID** (format: `xxxxx.apps.googleusercontent.com`)

#### B. iOS Client ID

1. Click "Create Credentials" → "OAuth client ID"
2. Application type: **iOS**
3. Name: **VarsityHub Mobile iOS**
4. **Bundle ID:** Get from `app.json` → `expo.ios.bundleIdentifier`
   - Example: `com.varsityhub.mobile`
5. Click "Create"
6. **Copy the Client ID**

#### C. Web Client ID

1. Click "Create Credentials" → "OAuth client ID"
2. Application type: **Web application**
3. Name: **VarsityHub Mobile Web**
4. **Authorized redirect URIs:**
   - `http://localhost:8081`
   - `https://auth.expo.io/@your-expo-username/varsityhubmobile`
5. Click "Create"
6. **Copy the Client ID**

#### D. Expo Client ID (Optional)

- This is typically the **Web Client ID**
- Use the same value as Web Client ID above

### 5. Add Client IDs to Environment Variables

1. Open your `.env` file (create if it doesn't exist)
2. Add the following lines with your actual client IDs:

```bash
# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

3. **Restart your development server:**
   ```bash
   npx expo start --clear
   ```

### 6. Update Backend

Your backend needs to verify Google ID tokens. Add this to your auth route:

```javascript
// server/src/routes/auth.ts
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_WEB_CLIENT_ID
);

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID,
      ],
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar_url: picture,
          google_id: googleId,
          email_verified: true, // Google emails are pre-verified
        },
      });
    }
    
    // Generate JWT
    const token = generateJWT(user.id);
    
    res.json({
      access_token: token,
      user,
      needs_onboarding: !user.onboarding_completed,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});
```

### 7. Install Backend Dependencies

```bash
cd server
npm install google-auth-library
```

### 8. Test Google Sign-In

1. Start your app: `npx expo start`
2. Open on device/emulator
3. Go to Sign In screen
4. Click "Continue with Google"
5. Select your Google account
6. Should redirect back to app and sign you in

---

## Verification Checklist

- [ ] Google Cloud project created
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] Android Client ID created
- [ ] iOS Client ID created
- [ ] Web Client ID created
- [ ] All Client IDs added to `.env`
- [ ] Development server restarted
- [ ] Backend route implemented
- [ ] `google-auth-library` installed on backend
- [ ] Tested on Android (or emulator)
- [ ] Tested on iOS (or simulator)
- [ ] Tested on web browser

---

## Troubleshooting

### "Google sign in unavailable" message
- Check that `.env` file exists and has client IDs
- Restart development server with `--clear` flag
- Verify environment variables are loaded: `console.log(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)`

### "Invalid client" error
- Verify package name/bundle ID matches Google Console
- Check SHA-1 fingerprint is correct (Android only)
- Ensure redirect URIs are configured (Web only)

### "Sign in cancelled" message
- User dismissed the Google sign-in popup (expected behavior)
- No action needed

### Backend token verification fails
- Ensure backend has `google-auth-library` installed
- Verify backend `GOOGLE_WEB_CLIENT_ID` matches frontend
- Check token expiration (tokens are short-lived)

---

## Production Setup

Before launching to production:

1. **Generate production keystore** (Android):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Get production SHA-1:**
   ```bash
   keytool -keystore release.keystore -list -v
   ```

3. **Add production SHA-1 to Google Console**

4. **Update authorized redirect URIs** for web (production domain)

5. **Submit app for OAuth verification** (if you have >100 users)

6. **Store production client IDs securely** (use EAS Secrets for Expo)

---

## Cost

✅ **Google OAuth is FREE** for unlimited users  
✅ No monthly fees  
✅ No per-authentication charges  

---

## Security Notes

- ✅ ID tokens are verified server-side (prevents tampering)
- ✅ Tokens expire after 1 hour (automatic refresh)
- ✅ SHA-1 fingerprints prevent impersonation (Android)
- ✅ Bundle ID validation prevents impersonation (iOS)
- ⚠️ Never commit `.env` file to git (use `.gitignore`)

---

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Expo Auth Session Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google Console](https://console.cloud.google.com/)

---

**Status:** ⏳ Pending Configuration  
**Priority:** Medium (email/password works, but Google improves UX)  
**Effort:** 30-60 minutes for initial setup
