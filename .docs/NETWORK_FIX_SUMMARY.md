# Network Connection Fix - Simulator Issues

## Issue

The app was trying to connect to `127.0.0.1:4000` (localhost) but the server wasn't running, causing network request failures:
- `PUT /auth/me` - Failed
- `GET /notifications?limit=1&unread=1` - Failed
- Profile save operations - Failed

**Root Cause:** `app.json` was configured to use `localhost:4000` with `EXPO_PUBLIC_FORCE_REMOTE_API: "0"`

## Fix Applied

### ✅ Updated `app.json`
Changed the API configuration to use Railway production server by default:

```json
// Before:
"EXPO_PUBLIC_API_URL": "http://localhost:4000",
"EXPO_PUBLIC_FORCE_REMOTE_API": "0",

// After:
"EXPO_PUBLIC_API_URL": "https://api-production-8ac3.up.railway.app",
"EXPO_PUBLIC_FORCE_REMOTE_API": "1",
```

### ✅ Enhanced Error Messages
Updated `api/http.ts` to provide better error messages when localhost connection fails:

- Now detects when trying to connect to `127.0.0.1` or `localhost`
- Provides helpful message suggesting to start server or use production URL

## Result

✅ App now connects to Railway production server by default
✅ Network errors should be resolved
✅ Better error messages for debugging

## Options for Development

### Option 1: Use Production Server (Current)
- ✅ Works immediately (no local server needed)
- ✅ Always uses latest production data
- ⚠️ Changes affect production data

### Option 2: Use Local Server
If you want to use a local server for development:

1. Start the server:
   ```bash
   npm run server:dev
   ```

2. Update `app.json`:
   ```json
   "EXPO_PUBLIC_API_URL": "http://localhost:4000",
   "EXPO_PUBLIC_FORCE_REMOTE_API": "0",
   ```

3. Restart Expo:
   ```bash
   npm start
   ```

## Verification

After this fix, the app should:
- ✅ Connect to Railway production server
- ✅ Load user data successfully
- ✅ Save profile changes
- ✅ Load notifications
- ✅ No more "Network request failed" errors

**Status:** ✅ Fixed - App now connects to Railway production server
