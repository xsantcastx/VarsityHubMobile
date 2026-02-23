# Google OAuth Setup for VarsityHub

## Current Configuration

**App Scheme (from `.env`):**
```
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
```

**Google OAuth Client IDs:**
- iOS Client ID: `814866365020-d7dk3k9gf49jodhnbraps8p7l9jrfs10.apps.googleusercontent.com`
- Android Client ID: `814866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0.apps.googleusercontent.com`
- Web Client ID: `814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com`

**App Bundle ID:**
```
com.xsantcastx.varsityhub
```

## Redirect URIs Being Used

### Development (Dev Simulator)
When `EXPO_PUBLIC_GOOGLE_FORCE_PROXY=0` (current):
```
varsityhubmobile://oauthredirect
```

### Production (Standalone Build)
```
https://varsityhub.app/auth/google/callback
```

## What Needs to Be Done in Google Cloud Console

1. **Go to Google Cloud Console → APIs & Services → Credentials**

2. **Click on the iOS OAuth Client ID:**
   - Client ID: `814866365020-d7dk3k9gf49jodhnbraps8p7l9jrfs10.apps.googleusercontent.com`

3. **Scroll down to "Authorized redirect URIs" section**

4. **Add BOTH of these URIs:**
   - `varsityhubmobile://oauthredirect` (for dev simulator)
   - `https://varsityhub.app/auth/google/callback` (for production)

5. **Click SAVE** after adding each URI

6. **Verify Android & Web clients have the same URIs:**
   - Android Client: `314866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0.apps.googleusercontent.com`
   - Web Client: `814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com`
   - Both should have `https://varsityhub.app/auth/google/callback` at minimum

## Backend Configuration (Railway)

Verify these env vars are set:
```
GOOGLE_OAUTH_CLIENT_IDS=814866365020-d7dk3k9gf49jodhnbraps8p7l9jrfs10.apps.googleusercontent.com,814866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0.apps.googleusercontent.com,814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com
```

The server validates that the token's `aud` claim matches one of these client IDs.

## Testing

After adding the redirect URIs to Google Cloud Console:

1. Restart Metro: `npx expo start --dev-client`
2. Trigger Google Sign-In in the app
3. You should see the Google login sheet
4. After authentication, the custom scheme `varsityhubmobile://oauthredirect` will be called with the auth code
5. Expo converts it to an idToken and returns it to the app
6. App sends idToken to `/auth/google` endpoint
7. Success!

## Troubleshooting

**Error: "Google sign-in failed" with 401 from `/me` endpoint**
- Check that the redirect URI is in Google Console
- Check that GOOGLE_OAUTH_CLIENT_IDS on backend includes the iOS client ID

**Error: redirect_uri_mismatch in Google's response**
- The redirect URI being generated doesn't match what's in Google Console
- Current redirect being used: `varsityhubmobile://oauthredirect`
- Make sure this exact URI is in the "Authorized redirect URIs" list

**Error: Network error before reaching /auth/google endpoint**
- The custom scheme redirect worked, but the idToken is invalid
- Check that the iOS client ID in `.env` matches what's in Google Cloud
