# 🚨 CRITICAL: Google Maps Fix - You Have the WRONG APIs Enabled!

## ❌ THE PROBLEM

You have these enabled (WRONG):
- ❌ Maps 3D SDK for Android
- ❌ Maps 3D SDK for iOS  
- ❌ Maps Datasets API

You need these (CORRECT):
- ✅ **Maps SDK for Android** (NOT 3D!)
- ✅ **Maps SDK for iOS** (NOT 3D!)
- ✅ Geocoding API (for address lookup)

## 🔧 STEP-BY-STEP FIX

### Step 1: Enable the CORRECT APIs in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/library
2. Search for **"Maps SDK for Android"** (NOT 3D!)
   - Click it
   - Click **"ENABLE"**
3. Search for **"Maps SDK for iOS"** (NOT 3D!)
   - Click it
   - Click **"ENABLE"**
4. Search for **"Geocoding API"**
   - Click it
   - Click **"ENABLE"**

### Step 2: Verify Your API Key

Your API key in `app.json` is: `AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY`

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key: `AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY`
3. Click on it to edit
4. Under "API restrictions":
   - Select "Restrict key"
   - Check these boxes:
     - ✅ Maps SDK for Android
     - ✅ Maps SDK for iOS
     - ✅ Geocoding API
   - Click "SAVE"

### Step 3: Check API Key Restrictions (Bundle IDs)

1. Still in the API key settings
2. Under "Application restrictions":
   - For iOS: Add bundle ID: `com.varsithub.varsityhub`
   - For Android: Add package name: `com.varsithub.varsityhub`
   - OR select "None" for testing (less secure)

### Step 4: REBUILD THE APP (CRITICAL!)

After enabling the correct APIs, you MUST rebuild:

```bash
# Stop Metro bundler (Ctrl+C)

# Clean build
cd ios && pod install && cd ..
rm -rf ios/build

# Rebuild
npx expo run:ios
```

## 🔍 VERIFICATION CHECKLIST

After rebuilding, check:

- [ ] Maps SDK for Android is ENABLED (not 3D)
- [ ] Maps SDK for iOS is ENABLED (not 3D)
- [ ] Geocoding API is ENABLED
- [ ] API key has all 3 APIs in restrictions
- [ ] Bundle IDs are correct in API key restrictions
- [ ] App was rebuilt after changes
- [ ] Map shows Google Maps (not Apple Maps)

## 🐛 IF STILL NOT WORKING

### Check Console Logs

In Xcode:
1. Open Xcode
2. Run app
3. Check console for errors like:
   - "API key not valid"
   - "This API key is not authorized"
   - "Bundle ID mismatch"

### Test API Key Directly

Test if your API key works:
```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=New+York&key=AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY"
```

If you get an error, the API key or restrictions are wrong.

### Common Issues

1. **"API key not valid"**
   - Check you copied the key correctly
   - Verify it's enabled in Google Cloud Console

2. **"This API key is not authorized"**
   - Enable Maps SDK for iOS/Android (NOT 3D!)
   - Wait 5 minutes for changes to propagate

3. **"Bundle ID mismatch"**
   - Check bundle ID in app.json matches API key restrictions
   - iOS: `com.varsithub.varsityhub`
   - Android: `com.varsithub.varsityhub`

4. **Map shows but is blank**
   - Check billing is enabled in Google Cloud Console
   - Google Maps requires a billing account (but has free tier)

## 📝 QUICK REFERENCE

**Your API Key**: `AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY`

**Required APIs**:
- Maps SDK for Android ✅
- Maps SDK for iOS ✅
- Geocoding API ✅

**Bundle IDs**:
- iOS: `com.varsithub.varsityhub`
- Android: `com.varsithub.varsityhub`

**After changes**: ALWAYS rebuild the app!
