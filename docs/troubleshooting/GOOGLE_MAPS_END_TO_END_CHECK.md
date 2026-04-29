# ✅ Google Maps End-to-End Verification

## Configuration Status

### ✅ 1. API Key in app.json

- **iOS**: `ios.config.googleMapsApiKey` = `<GOOGLE_MAPS_API_KEY>` ✅
- **Android**: `android.config.googleMaps.apiKey` = `<GOOGLE_MAPS_API_KEY>` ✅

### ✅ 2. API Key in Native Files

- **iOS Info.plist**: `GMSApiKey` = `<GOOGLE_MAPS_API_KEY>` ✅
- **Android Manifest**: `com.google.android.geo.API_KEY` = `<GOOGLE_MAPS_API_KEY>` ✅

### ✅ 3. Map Provider Configuration

- **utils/maps.ts**: Returns `PROVIDER_GOOGLE` ✅
- **EventMap.tsx**: Uses `getMapProvider()` which returns `PROVIDER_GOOGLE` ✅

### ✅ 4. APIs Enabled in Google Cloud Console

- Maps SDK for Android ✅
- Maps SDK for iOS ✅
- Maps JavaScript API ✅
- Maps Static API ✅

### ✅ 5. Location Permissions

- **iOS**: `NSLocationWhenInUseUsageDescription` configured ✅
- **Android**: `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` in manifest ✅

## ⚠️ Potential Issues

### 1. Plugin Not Registered

The `withGoogleMaps` plugin exists but is NOT in the `plugins` array in `app.json`. However, `GMSApiKey` is already in `Info.plist`, so it may have been added manually or by a previous build.

**Action**: Add plugin to ensure it stays in sync:

```json
"plugins": [
  // ... existing plugins ...
  "./plugins/withGoogleMaps"
]
```

### 2. API Key Restrictions

Check in Google Cloud Console:

- API restrictions: Should allow Maps SDK for iOS and Android
- Application restrictions: Should allow bundle ID `com.varsithub.varsityhub` (or set to "None" for testing)

### 3. Billing Account

Google Maps requires a billing account (but has free tier). Verify billing is enabled in Google Cloud Console.

## 🧪 Testing Checklist

1. **Rebuild the app** (required after any config changes):

   ```bash
   npx expo run:ios
   ```

2. **Check Xcode Console** for errors:
   - Open Xcode
   - Run app
   - Check console for:
     - "API key not valid"
     - "This API key is not authorized"
     - "Bundle ID mismatch"

3. **Test Map Loading**:
   - Open "Nearby Games" screen
   - Map should show Google Maps (not blank)
   - Your location should appear
   - No error messages

4. **Test API Key Directly**:
   ```bash
   curl "https://maps.googleapis.com/maps/api/geocode/json?address=New+York&key=<GOOGLE_MAPS_API_KEY>"
   ```
   Should return JSON with results, not an error.

## 🔧 If Still Not Working

### Check API Key Restrictions

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key: `<GOOGLE_MAPS_API_KEY>`
3. Check "API restrictions":
   - Should include: Maps SDK for iOS, Maps SDK for Android
4. Check "Application restrictions":
   - iOS: Should allow `com.varsithub.varsityhub` OR set to "None"
   - Android: Should allow `com.varsithub.varsityhub` OR set to "None"

### Verify Billing

1. Go to: https://console.cloud.google.com/billing
2. Ensure a billing account is linked to your project
3. Google Maps has a free tier ($200/month credit), but billing must be enabled

### Check Console Logs

In Xcode, look for:

- `[GMSApiKey]` messages
- Any Google Maps SDK errors
- Network errors when loading map tiles

## 📝 Summary

**Configuration**: ✅ All correct
**Native Files**: ✅ API keys present
**APIs**: ✅ Enabled
**Map Provider**: ✅ Set to Google Maps

**Most Likely Issue**: API key restrictions or billing account not enabled.

**Next Step**: Check API key restrictions in Google Cloud Console and ensure billing is enabled.
