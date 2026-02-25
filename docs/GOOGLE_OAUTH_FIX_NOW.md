# Fix Google OAuth "deleted_client" Error

**Error:** `Access blocked: Authorization Error - The OAuth client was deleted (401: deleted_client)`

Your Google OAuth credentials were deleted from Google Cloud Console. You need to create new ones and update the app.

---

## Step 1: Create OAuth Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your **VarsityHub** project (or create one)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. If prompted, configure the **OAuth consent screen** first:
   - User type: **External** (for public app) or **Internal** (testing only)
   - App name: **VarsityHub**
   - Support email: your email
   - Add your domain: `varsityhub.app`

### Create These OAuth Clients

| Type | Use | Notes |
|------|-----|-------|
| **iOS** | Native iOS app | Bundle ID: `com.varsithub.varsityhub-ios` |
| **Android** | Native Android app | Package: `com.varsityhub.varsityhub`, add SHA-1 from keystore |
| **Web application** | Web + Expo proxy | Add redirect URIs (see below) |

### Web Client Redirect URIs

Add these to the Web OAuth client:

- `https://auth.expo.io/@varsity-hub/varsityhub` (Expo proxy)
- `https://varsityhub.app` (production web)
- `http://localhost:8081` (local dev, optional)

---

## Step 2: Update app.json

In `app.json` → `expo.extra`, replace the old client IDs with your new ones:

```json
"EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "YOUR_NEW_ANDROID_CLIENT_ID.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "YOUR_NEW_IOS_CLIENT_ID.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "YOUR_NEW_WEB_CLIENT_ID.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID": "YOUR_NEW_WEB_CLIENT_ID.apps.googleusercontent.com"
```

> **Note:** Expo client ID usually uses the same Web client ID.

---

## Step 3: Update Backend (Railway)

Set these env vars in your Railway project:

```
GOOGLE_OAUTH_CLIENT_IDS=YOUR_IOS_CLIENT_ID,YOUR_ANDROID_CLIENT_ID,YOUR_WEB_CLIENT_ID
```

Or use a single audience if you prefer:

```
GOOGLE_OAUTH_AUDIENCE=YOUR_IOS_CLIENT_ID
```

Comma-separate all client IDs that can issue valid tokens.

---

## Step 4: Regenerate Native Projects

After updating client IDs, regenerate the iOS project so the URL scheme is correct:

```bash
npx expo prebuild --clean
cd ios && pod install && cd ..
```

Or if you use a managed workflow with custom native code:

```bash
npx expo run:ios
```

---

## Step 5: Test

1. Rebuild the app: `npx expo run:ios`
2. Start Metro: `npm run dev:expo`
3. Tap "Continue with Google" on the sign-in screen
4. Complete the OAuth flow

---

## Quick Reference: Where Client IDs Are Used

| Location | Purpose |
|---------|---------|
| `app.json` extra | Mobile app OAuth flow (expo-auth-session) |
| `ios/Info.plist` CFBundleURLTypes | iOS redirect scheme (auto-injected by plugin) |
| Server `GOOGLE_OAUTH_CLIENT_IDS` | Validates token audience on backend |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Still "deleted_client" | Double-check client IDs in app.json; ensure no typos |
| **"400: invalid_request"** | See [Fix 400 invalid_request](#fix-400-invalid_request) below |
| "Redirect URI mismatch" | Add the exact redirect URI from the error to your Web client |
| Backend rejects token | Add the client ID that issued the token to `GOOGLE_OAUTH_CLIENT_IDS` |

### Fix 400 invalid_request

Google blocks custom scheme redirects with Web client type. For **simulator/dev builds**, use the Expo proxy so the redirect is HTTPS:

1. In `app.json` → `expo.extra`, set:
   ```json
   "EXPO_PUBLIC_GOOGLE_FORCE_PROXY": "1"
   ```

2. In Google Cloud Console → your **Web** OAuth client → **Authorized redirect URIs**, add:
   ```
   https://auth.expo.io/@varsity-hub/varsityhub
   ```

3. Rebuild and test. For production (standalone app), set `EXPO_PUBLIC_GOOGLE_FORCE_PROXY` back to `"0"` and ensure your **iOS** OAuth client has Bundle ID `com.varsithub.varsityhub-ios`.

---

## Other Production Gaps to Address

| Gap | Location | Action |
|-----|----------|--------|
| **Sentry DSN empty** | `app.json` extra | Add `EXPO_PUBLIC_SENTRY_DSN` for error monitoring |
| **Stripe key empty** | `app.json` extra | Add `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` if using payments |
| **Backend GOOGLE_OAUTH_CLIENT_IDS** | Railway env | Must match new client IDs after OAuth fix |
