# Google Maps Status & Configuration

## Current Status

✅ **API Key Configured** in `app.json`:
- iOS: `AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY`
- Android: `AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY`

✅ **Plugin Created** to inject API key into Info.plist

## Error Message

The error "react-native-maps: AirGoogleMaps dir mus..." suggests:
- Google Maps SDK might not be finding the API key
- The API key might not be injected into Info.plist properly
- There might be a path/configuration issue

## Fix Applied

1. **Created Custom Plugin** (`plugins/withGoogleMaps.js`)
   - Ensures `GMSApiKey` is added to `Info.plist`
   - This is required for react-native-maps to work on iOS

2. **Updated app.json**
   - Added `./plugins/withGoogleMaps` to plugins array

## Next Steps

After the build completes, you need to:

1. **Rebuild the app** (the plugin needs to run during build):
   ```bash
   npx expo run:ios
   ```

2. **Verify the API key is in Info.plist**:
   After rebuild, check:
   ```bash
   cat ios/VarsityHub/Info.plist | grep GMSApiKey
   ```
   Should show: `<key>GMSApiKey</key><string>AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY</string>`

3. **Test the map**:
   - Navigate to "Nearby Games" screen
   - Map should load with Google Maps (not Apple Maps)
   - No error messages about AirGoogleMaps

## If Still Not Working

1. **Check API key restrictions**:
   - Go to Google Cloud Console
   - Verify the API key has "Maps SDK for iOS" enabled
   - Check if restrictions are blocking the simulator

2. **Verify API key is valid**:
   ```bash
   # Test the API key (replace with your key)
   curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY"
   ```

3. **Check simulator/device**:
   - Google Maps works on both simulator and real devices
   - Make sure you have internet connection

## Current Configuration

- **Provider Selection**: Uses `getMapProvider()` which returns `PROVIDER_GOOGLE` for dev-client builds
- **API Key Location**: `app.json` → `ios.config.googleMapsApiKey`
- **Plugin**: Automatically injects into `Info.plist` as `GMSApiKey`
