# Google OAuth Redirect URI Setup

To fix `Error 400: redirect_uri_mismatch`, add the **exact** redirect URI your app sends to your Google Cloud Console OAuth client.

## Which OAuth client?

**Production iOS app (TestFlight/App Store)** uses the **Web application** OAuth client and this redirect URI:
- `https://varsityhub.app/auth/google/callback`

Add this to: **Web application** → Authorized redirect URIs (NOT the iOS client).

## Google Cloud Console Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Open your **Web application** OAuth 2.0 Client ID (the one with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`)
3. Under **Authorized redirect URIs**, add the URI(s) below
4. Click **Save**
5. Wait 1–2 minutes for propagation, then retry sign-in

## Required Redirect URIs (Web application client)

| Environment | URI |
|-------------|-----|
| **Production iOS (standalone)** | `https://varsityhub.app/auth/google/callback` |
| Expo Go / Proxy | `https://auth.expo.io/@varsity-hub/varsityhub` |
| Web localhost | `http://localhost:8081` |

## See the exact URI your app uses

When sign-in fails with redirect_uri_mismatch, the error message includes the exact URI. Add that exact string to your Web client's Authorized redirect URIs.

For dev: check the console log `[google-auth] Using redirect URI:` when starting sign-in.

## Other clients (iOS/Android native)

For native redirects (custom scheme), use the **iOS** or **Android** OAuth clients:
- iOS: `com.varsithub.varsityhub-ios:/oauthredirect`
- Android: `com.varsithub.varsityhub:/oauthredirect`

Production standalone iOS uses the **web** redirect, so the Web client must have `https://varsityhub.app/auth/google/callback`.

## Troubleshooting

- **Error persists:** The URI must match exactly (no trailing slash, correct scheme)
- **Wrong client:** Production iOS uses the **Web** client—ensure the URI is in the Web client, not only the iOS client
