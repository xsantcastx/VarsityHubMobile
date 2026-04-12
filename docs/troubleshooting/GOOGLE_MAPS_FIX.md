# Google Maps Fix Guide

## ✅ What Was Fixed

1. **Removed Duplicate "i" Icon**
   - Removed the duplicate information icon in the "No Games with Locations Yet" card
   - Combined the two hints into one clear message

2. **Fixed Google Maps Provider**
   - Changed `utils/maps.ts` to always use `PROVIDER_GOOGLE` instead of falling back to Apple Maps
   - Google Maps API key is configured in `app.json` for both iOS and Android

## 🔧 Google Maps Configuration

### Current Setup

**iOS** (`app.json`):
```json
"ios": {
  "config": {
    "googleMapsApiKey": "<REDACTED_GOOGLE_MAPS_KEY>"
  }
}
```

**Android** (`app.json`):
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "<REDACTED_GOOGLE_MAPS_KEY>"
    }
  }
}
```

### If Maps Still Don't Load

1. **Rebuild the app** (required after config changes):
   ```bash
   # For iOS
   npx expo run:ios
   
   # For Android
   npx expo run:android
   ```

2. **Verify API Key**:
   - Check Google Cloud Console: https://console.cloud.google.com/
   - Ensure the API key has these APIs enabled:
     - Maps SDK for iOS
     - Maps SDK for Android
     - Geocoding API (for location search)

3. **Check API Key Restrictions**:
   - If restrictions are set, ensure your bundle ID is allowed:
     - iOS: `com.varsithub.varsityhub`
     - Android: `com.varsithub.varsityhub`

4. **Clear Build Cache**:
   ```bash
   # iOS
   cd ios && pod install && cd ..
   rm -rf ios/build
   
   # Android
   cd android && ./gradlew clean && cd ..
   ```

5. **Check Console Logs**:
   - Look for Google Maps errors in Xcode console (iOS) or Logcat (Android)
   - Common errors:
     - "API key not valid" → Check API key in app.json
     - "This API key is not authorized" → Enable Maps SDK in Google Cloud Console
     - "Bundle ID mismatch" → Check API key restrictions

## 🧪 Testing

After rebuilding:
1. Open the "Nearby Games" screen
2. You should see Google Maps (not Apple Maps)
3. The map should load with your current location
4. The duplicate "i" icon should be gone

## 📝 Notes

- The map provider is now hardcoded to Google Maps in `utils/maps.ts`
- API keys are configured in `app.json` (not environment variables)
- Changes to `app.json` require a native rebuild (not just Metro restart)
