# Fix Google OAuth redirect_uri_mismatch Error

## Problem

When testing Google Sign-In on `http://localhost:8081`, you get:

```
Error 400: redirect_uri_mismatch
```

## Root Cause

Google Cloud Console doesn't have `http://localhost:8081` authorized as a valid redirect URI for the Web OAuth Client.

## Solution: Add Redirect URI to Google Cloud Console

### Step-by-Step (5 minutes)

1. **Go to Google Cloud Console**

   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. **Find the Web OAuth Client ID**
   - Look for: `814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com`
   - Client name should be: "VarsityHub Mobile Web" or similar

3. **Click on the Web Client ID to edit it**

4. **Scroll down to "Authorized redirect URIs"**

5. **Add these two URIs:**
   - `http://localhost:8081`
   - `http://127.0.0.1:8081`

6. **Click "Save"**

7. **Wait 1-2 minutes** for changes to propagate (Google's cache)

8. **Reload Chrome and try Google Sign-In again**

---

## Temporary Workaround: Use Email/Password Sign-In

While you're fixing Google OAuth, you can test the app with email/password:

1. On the sign-in screen, click **"Sign Up"**
2. Create a test account:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. Verify email (use code from logs or skip if dev mode)
4. You're now signed in!

---

## Permanent Fix for Production

Once the iOS/Android builds are deployed, Google will need:

- iOS Redirect: `varsityhubmobile://oauthredirect`
- Android Redirect: `varsityhubmobile://oauthredirect`
- Web Redirect: `https://varsityhub.app/auth/google/callback`

These are **already configured** in the code at `.env`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com
```

---

## Verification

After adding the redirect URI, you'll see in Chrome DevTools:

```
[google-auth] Redirect URI: http://localhost:8081
[auth] Received ID token from Google
[auth] User logged in successfully
```
