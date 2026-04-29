# Google Maps & Fast Refresh Fix - Complete

## ✅ What Was Fixed

### 1. Google Maps iOS Configuration

- **Created plugin** (`plugins/withGoogleMaps.js`) to inject `GMSApiKey` into `Info.plist`
- **Added plugin** to `app.json` plugins array
- **Fixed Metro config** to NOT shim `react-native-maps` on native platforms (only web)
- **Created fix script** (`FIX_GOOGLE_MAPS.sh`) for easy rebuilding

### 2. Fast Refresh Configuration

- ✅ Already properly configured in `babel.config.js` (using `react-native-worklets/plugin`)
- ✅ Already properly configured in `metro.config.js` (experimentalImportSupport: false)
- ✅ Fast Refresh should work on simulator

## 🚀 How to Apply the Fix

### Step 1: Run the Fix Script

```bash
./FIX_GOOGLE_MAPS.sh
```

This will:

1. Verify API key is in `app.json` ✅
2. Clean iOS build artifacts
3. Run `expo prebuild --clean` to regenerate native code with plugins
4. Install CocoaPods dependencies

### Step 2: Rebuild the App

```bash
npx expo run:ios
```

### Step 3: Start Metro with Fast Refresh

```bash
npx expo start --dev-client --clear
```

## ✅ Verification Checklist

### Google Maps

- [ ] Run `./FIX_GOOGLE_MAPS.sh`
- [ ] Rebuild: `npx expo run:ios`
- [ ] Navigate to "Nearby Games" screen
- [ ] Map should load without "AirGoogleMaps" error
- [ ] Map should show Google Maps (not Apple Maps)

### Fast Refresh

- [ ] Start Metro: `npx expo start --dev-client`
- [ ] Make a small change to any component (e.g., change text color)
- [ ] Save the file
- [ ] Change should appear in simulator within 1-2 seconds
- [ ] Component state should be preserved

## 🔍 Troubleshooting

### If Google Maps Still Shows Error:

1. **Check Info.plist** has `GMSApiKey`:

   ```bash
   cat ios/VarsityHub/Info.plist | grep GMSApiKey
   ```

   Should show: `<key>GMSApiKey</key><string><GOOGLE_MAPS_API_KEY></string>`

2. **Verify API key is valid**:
   - Go to Google Cloud Console
   - Check "Maps SDK for iOS" is enabled
   - Verify API key restrictions allow your bundle ID

3. **Try clean rebuild**:
   ```bash
   rm -rf ios android
   npx expo prebuild --clean
   npx expo run:ios
   ```

### If Fast Refresh Not Working:

1. **Check Metro is running** with `--dev-client` flag
2. **Verify babel.config.js** has `react-native-worklets/plugin` (last in plugins array)
3. **Check metro.config.js** has `experimentalImportSupport: false`
4. **Try manual reload**: Press `r` in Metro terminal or shake device → "Reload"

## 📝 Files Changed

1. `plugins/withGoogleMaps.js` - NEW: Plugin to inject API key
2. `app.json` - Added `./plugins/withGoogleMaps` to plugins array
3. `metro.config.js` - Fixed to not shim react-native-maps on native
4. `FIX_GOOGLE_MAPS.sh` - NEW: Fix script
5. `utils/maps.ts` - Improved provider detection logic

## 🎯 Expected Results

After running the fix:

- ✅ Google Maps loads without errors
- ✅ Map shows Google Maps provider (not Apple Maps)
- ✅ Fast Refresh works on simulator (changes appear instantly)
- ✅ Component state preserved during Fast Refresh
