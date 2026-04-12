# 🚨 Google Maps Not Loading - Debug Guide

## Current Symptoms
- ✅ Map container shows (white/grey area)
- ✅ Location dot appears (blue dot)
- ✅ Google logo visible
- ❌ **Map tiles NOT loading** (blank map)

This indicates the API key is being read but **rejected by Google**.

## 🔍 Step-by-Step Debugging

### Step 1: Check API Key Restrictions (MOST COMMON ISSUE)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key: `<REDACTED_GOOGLE_MAPS_KEY>`
3. Check **"API restrictions"**:
   - Must include: **Maps SDK for iOS** ✅
   - Must include: **Maps SDK for Android** ✅
   - If missing, click "Restrict key" → Select APIs → Add them → Save

4. Check **"Application restrictions"**:
   - For testing: Set to **"None"** (least secure but works immediately)
   - OR add bundle ID: `com.varsithub.varsityhub` for iOS
   - OR add package name: `com.varsithub.varsityhub` for Android

### Step 2: Verify Billing Account

Google Maps **requires billing to be enabled** (even with free tier):

1. Go to: https://console.cloud.google.com/billing
2. Check if a billing account is linked to your project
3. If not, add a billing account (Google gives $200/month free credit)

### Step 3: Check Console Logs

In Xcode:
1. Open Xcode
2. Run your app
3. Check console for errors like:
   - `"This API key is not authorized"`
   - `"API key not valid"`
   - `"Bundle ID mismatch"`
   - `"Billing not enabled"`

### Step 4: Test API Key Directly

Run this command to test if your API key works:

```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=New+York&key=<REDACTED_GOOGLE_MAPS_KEY>"
```

**Expected**: JSON response with geocoding data
**If error**: API key is blocked/restricted

### Step 5: Verify Bundle ID Matches

Your bundle ID: `com.varsithub.varsityhub`

Check in Google Cloud Console:
- API key restrictions should allow this bundle ID
- OR set restrictions to "None" for testing

### Step 6: Rebuild After Changes

**CRITICAL**: After changing API key restrictions, you MUST rebuild:

```bash
# Stop Metro (Ctrl+C)
cd ios && pod install && cd ..
rm -rf ios/build
npx expo run:ios
```

## 🎯 Quick Fix (Try This First)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your API key
3. Under "Application restrictions" → Select **"None"**
4. Click **"SAVE"**
5. Wait 2-3 minutes
6. Rebuild: `npx expo run:ios`

This removes all restrictions temporarily to test if that's the issue.

## 🔧 Alternative: Create New API Key

If restrictions are too complex:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the new key
4. Update `app.json`:
   ```json
   "ios": {
     "config": {
       "googleMapsApiKey": "YOUR_NEW_KEY_HERE"
     }
   },
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "YOUR_NEW_KEY_HERE"
       }
     }
   }
   ```
5. Rebuild app

## 📱 Check Network/Firewall

If you're on a restricted network:
- Try on different WiFi
- Try on cellular data
- Check if firewall is blocking `maps.googleapis.com`

## ✅ Verification Checklist

- [ ] API key has "Maps SDK for iOS" enabled
- [ ] API key has "Maps SDK for Android" enabled  
- [ ] Application restrictions set to "None" OR bundle ID matches
- [ ] Billing account is enabled
- [ ] App was rebuilt after changes
- [ ] Console shows no API key errors
- [ ] API key test curl command works

## 🐛 Common Error Messages

| Error | Solution |
|-------|----------|
| "This API key is not authorized" | Enable Maps SDK for iOS/Android in API restrictions |
| "API key not valid" | Check you copied the key correctly |
| "Bundle ID mismatch" | Add bundle ID to restrictions or set to "None" |
| "Billing not enabled" | Enable billing account in Google Cloud Console |
| "Quota exceeded" | Check usage in Google Cloud Console |

## 🎯 Most Likely Fix

**90% of the time**, the issue is **Application restrictions** blocking your bundle ID.

**Quick fix**: Set Application restrictions to **"None"** in Google Cloud Console, wait 2-3 minutes, rebuild app.
