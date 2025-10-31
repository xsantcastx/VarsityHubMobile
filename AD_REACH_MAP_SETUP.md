# 🗺️ Ad Reach Map Preview - Setup Guide

## Overview

**Purpose**: Build advertiser trust and transparency by showing them exactly where their ad will appear.

**Feature**: When advertisers create or edit ads, they see a Google Maps visualization showing:
- Their target ZIP code as a center point
- A circular radius (15km / ~10 miles) showing the reach area
- Visual proof of where users will see their ad

**Result**: Advertisers feel confident and trust that their money is well-spent.

---

## ✅ What's Been Implemented

### 1. **ReachMapPreview Component** (`components/ReachMapPreview.tsx`)
- Reusable map component that displays reach area
- Uses `react-native-maps` with Google Maps provider
- Features:
  - ✅ Automatic ZIP code geocoding (converts ZIP → lat/lng)
  - ✅ Circle overlay showing 15km radius
  - ✅ Custom marker at center point
  - ✅ Legend explaining what colors mean
  - ✅ Loading states while geocoding
  - ✅ Error handling for invalid ZIPs
  - ✅ Debounced API calls (500ms after typing stops)
  - ✅ Uses free OpenStreetMap Nominatim API for geocoding

### 2. **Integration Points**
- ✅ **submit-ad.tsx**: Map preview appears below ZIP code input when creating new ads
- ✅ **edit-ad.tsx**: Map preview appears below ZIP code input when editing existing ads

### 3. **User Experience**
- User enters ZIP code → Map automatically loads after 500ms
- Shows loading spinner while geocoding
- Displays error message if ZIP is invalid
- Shows placeholder text if no ZIP entered
- Interactive map with pinch-to-zoom
- Green circle clearly shows reach area

---

## 🔧 Setup Required

### **Google Maps API Key** (Required for Production)

The app is currently using **OpenStreetMap Nominatim** for geocoding (free, no key required), but for the map display itself, you'll need Google Maps API keys.

#### Step 1: Get Google Maps API Keys

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable these APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
4. Create API credentials:
   - Navigate to **APIs & Services → Credentials**
   - Click **Create Credentials → API Key**
   - Create **two separate keys**:
     - One for Android (with Android app restriction)
     - One for iOS (with iOS app restriction)

#### Step 2: Add Keys to app.json

Open `app.json` and add your API keys:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_IOS_API_KEY_HERE"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_API_KEY_HERE"
        }
      }
    }
  }
}
```

#### Step 3: Rebuild the App

After adding API keys, rebuild the native apps:

```bash
# For iOS
npx expo prebuild --clean
npx expo run:ios

# For Android
npx expo prebuild --clean
npx expo run:android
```

---

## 🎨 How It Works

### User Journey:

1. **Advertiser navigates to Submit Ad or Edit Ad**
2. **Enters business details and ZIP code**
3. **Map appears automatically below ZIP code field**
   - Shows "Locating ZIP code..." while loading
   - Displays map with green circle overlay
   - Center marker shows "Your ad targeting center"
4. **Advertiser sees visual proof** of their 10-mile reach area
5. **Builds trust** → They can see exactly where their ad appears

### Technical Flow:

```
User Types ZIP Code
        ↓
500ms Debounce
        ↓
Geocode ZIP → lat/lng (Nominatim API)
        ↓
Render Map with Google Maps
        ↓
Add Circle Overlay (15km radius)
        ↓
Add Center Marker
        ↓
Show Legend
```

---

## 📊 Current Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Radius | 15km (~10 miles) | Can be adjusted via `radiusKm` prop |
| Geocoding API | OpenStreetMap Nominatim | Free, no key required |
| Map Provider | Google Maps | Requires API key for production |
| Debounce Delay | 500ms | Prevents excessive API calls |
| Countries Supported | US & Canada | Can add more via `countrycodes` param |

---

## 🔄 Optional Enhancements (Future)

### 1. **Switch to Google Geocoding API**
Currently using free Nominatim API. For production at scale, consider Google Geocoding API:

```typescript
// In ReachMapPreview.tsx, replace geocoding with:
const response = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&key=YOUR_GEOCODING_KEY`
);
```

**Benefits**: More accurate, faster, better rate limits
**Cost**: ~$5 per 1,000 requests (first $200/month free)

### 2. **Cache Geocoding Results**
Store ZIP → lat/lng mappings in AsyncStorage to avoid repeated API calls:

```typescript
const cachedLocation = await AsyncStorage.getItem(`zip_${zipCode}`);
if (cachedLocation) {
  setLocation(JSON.parse(cachedLocation));
  return;
}
// ... fetch from API, then cache
```

### 3. **Adjustable Radius**
Add UI slider to let advertisers choose their reach area:

```typescript
<ReachMapPreview zipCode={zip} radiusKm={selectedRadius} />
```

### 4. **Heatmap Overlay**
Show user density heatmap within the reach area (requires backend support).

---

## 🧪 Testing Checklist

- [ ] **Test with valid US ZIP**: e.g., "90210" (Beverly Hills, CA)
- [ ] **Test with valid Canadian postal code**: e.g., "M5H 2N2" (Toronto)
- [ ] **Test with invalid ZIP**: e.g., "00000" → Should show error
- [ ] **Test with empty ZIP**: Map should not render
- [ ] **Test typing rapidly**: Debounce should prevent multiple API calls
- [ ] **Test on iOS device**: Verify map renders and is interactive
- [ ] **Test on Android device**: Verify map renders and is interactive
- [ ] **Test in submit-ad flow**: Navigate to Submit Ad, enter ZIP, see map
- [ ] **Test in edit-ad flow**: Navigate to Edit Ad, see map with existing ZIP

---

## 🚀 Deployment Notes

### Before Deploying:

1. ✅ Add Google Maps API keys to `app.json`
2. ✅ Run `npx expo prebuild --clean` to regenerate native folders
3. ✅ Test on physical devices (iOS + Android)
4. ✅ Verify geocoding works for your target regions
5. ✅ Check API usage limits for Nominatim or Google Geocoding
6. ✅ Consider adding error tracking (Sentry) for geocoding failures

### Rate Limits:

**Nominatim (Current)**:
- Max 1 request per second
- Must include User-Agent header (already configured)
- Free for light usage

**Google Geocoding (Optional)**:
- 50 requests per second
- First $200/month free (~40,000 requests)
- Better for production scale

---

## 🎯 Business Impact

### Trust Metrics to Track:
- **Ad Submission Completion Rate**: Does the map increase conversions?
- **Advertiser Retention**: Do advertisers with map preview renew more?
- **Support Tickets**: Reduction in "Where will my ad show?" questions

### Key Value Proposition:
> "See exactly where your ad appears before you pay"

This builds immediate trust and reduces advertiser anxiety about spending money on the platform.

---

## 📝 Files Modified

1. **`components/ReachMapPreview.tsx`** (New)
   - Complete map component with geocoding and reach visualization

2. **`app/submit-ad.tsx`**
   - Added `<ReachMapPreview zipCode={zip} radiusKm={15} />`
   - Positioned below ZIP code input

3. **`app/edit-ad.tsx`**
   - Added `<ReachMapPreview zipCode={zip} radiusKm={15} />`
   - Positioned below ZIP code input

4. **`app.json`**
   - Already has Google Maps API key placeholders
   - Ready for production keys

---

## 💡 Next Steps

1. **Add Google Maps API keys** to `app.json`
2. **Rebuild and test** on physical devices
3. **Monitor geocoding API usage** (Nominatim rate limits)
4. **Gather feedback** from first advertisers
5. **Consider upgrading** to Google Geocoding API if needed
6. **Track conversion metrics** to measure trust impact

---

## 🆘 Troubleshooting

### Map not showing:
- ✅ Check Google Maps API key is added to `app.json`
- ✅ Verify you ran `npx expo prebuild --clean` after adding keys
- ✅ Check device has internet connection
- ✅ Look for errors in console (geocoding failures)

### Invalid ZIP code errors:
- ✅ Nominatim only supports certain countries (currently US/CA)
- ✅ Postal codes must be formatted correctly
- ✅ Consider adding ZIP validation before geocoding

### Geocoding too slow:
- ✅ Increase debounce delay (currently 500ms)
- ✅ Add caching with AsyncStorage
- ✅ Switch to Google Geocoding API

---

**Questions?** Check the component code in `components/ReachMapPreview.tsx` for inline documentation.
