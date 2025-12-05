# Android Polish - Testing & Validation Guide

**Status:** ✅ Implementation Complete  
**Date:** December 3, 2025  
**Platforms:** Android 8+

---

## Summary of Changes

Your VarsityHub app now has production-grade Android location precision handling across 5 key screens:

### What Was Added

#### 1. **Location Precision Tracking** (`hooks/useDeviceLocation.ts`)
- Exposes `accuracyMeters` (raw GPS accuracy)
- Exposes `isPrecise` (true if ≤200m, false otherwise)
- Exposes `needsPreciseAccuracy` (true if Android + permission granted + inaccurate)
- Exposes `openSettings()` (deep link to Android App Info)
- Maintains 10-minute caching (no excessive GPS requests)

#### 2. **Create Post Precision Banner** (`app/create-post.tsx`)
- Shows Android-only dismissible banner when location is approximate
- Explains why event suggestions may be off
- Links to Settings with `openSettings()` CTA
- Dismissal tracked in local state

#### 3. **Discover Map Guard** (`app/(tabs)/discover/mobile-community.tsx`)
- Blocks map toggle until both permission AND precision requirements met
- Shows alert if permission denied
- Shows alert + Settings CTA if permission granted but approximate
- Gracefully degrades to list view

#### 4. **Game Details Story Upload Resilience** (`app/game-details/GameDetailsScreen.tsx`)
- Re-prompts for location access before story upload
- Warns users that story pins will be imprecise without precise location
- Includes Settings CTA in banner
- Tracks banner dismissal

#### 5. **Notification Channel Registration** (`app/_layout.tsx`)
- Creates `General` channel with:
  - High importance (MAX)
  - Vibration enabled
  - Light color (#2563EB)
  - Sound enabled
- Prevents Expo Notifications runtime warnings

#### 6. **Documentation** (`ANDROID_POLISH_STATUS.md`)
- Clear validation steps for each feature
- Explains what users see
- How to test each scenario

---

## Testing Guide

### Prerequisites
- Physical Android 8+ device (or emulator)
- App built and installed: `npx expo run:android`
- Location services enabled system-wide

### Test 1: Precision Banner on Create Post

**Setup:**
```bash
# On device, go to:
Settings > Apps > VarsityHub > Permissions > Location
# Set to "Approximate" only
```

**Steps:**
1. Open VarsityHub on Android
2. Navigate to "Create" → "Create Post"
3. **Expected:** Blue banner appears saying "Enable Precise Location"
   - Message: "To improve event suggestions, enable precise location access"
4. Tap "Open settings"
   - **Expected:** Redirects to VarsityHub App Info > Permissions > Location
5. Change to "Precise location"
   - **Expected:** App refetches location
   - Banner disappears once accuracy improves

**Validation Points:**
- ✅ Banner text is clear
- ✅ "Open settings" CTA deep-links correctly
- ✅ Banner auto-dismisses after permission change
- ✅ Dismiss button (X) works and suppresses banner

---

### Test 2: Map Toggle Guard on Discover

**Setup:**
```bash
# Revoke location permission entirely
Settings > Apps > VarsityHub > Permissions > Location > Don't allow
```

**Scenario A: Permission Denied**

1. Open Discover tab
2. Tap Map icon (toggle button)
3. **Expected:** Permission prompt appears
4. Tap "Don't Allow"
5. **Expected:** Alert shows "Location required for map view" with Settings CTA
6. Tap "Settings"
   - **Expected:** Opens VarsityHub App Info
7. Grant "Approximate location"
8. Return to app
9. Tap Map icon again
10. **Expected:** Another alert appears (because approximate, not precise)
    - Message should explain "Precise location recommended for map"

**Scenario B: Permission Granted but Approximate**

1. Grant "Approximate location" (from system settings)
2. Return to app
3. Tap Map icon
4. **Expected:** Alert + Settings CTA (skip asking, go straight to precision warning)
5. Tap "Open settings"
6. Change to "Precise location"
7. Return to app
8. Tap Map icon
9. **Expected:** Map view opens successfully

**Validation Points:**
- ✅ Permission prompt appears only on first deny
- ✅ Precision alert shows on approximate access
- ✅ Map only opens with both permission + precise access
- ✅ Deep links to correct settings screens

---

### Test 3: Story Upload Location Prompt

**Setup:**
```bash
# Set location to "Approximate" again
Settings > Apps > VarsityHub > Permissions > Location > Approximate
```

**Steps:**
1. Navigate to a Game Detail screen
2. Tap "Add Story" / camera button
3. **Expected:** Banner appears: "Precise location recommended for story pins"
4. Select/take a photo
5. **Expected:** Upload proceeds even with approximate location
6. Check banner after upload
7. Tap "Open settings"
   - **Expected:** Opens location permission screen
8. Change to "Precise location"
9. Return to app
10. **Expected:** Banner auto-dismisses

**Validation Points:**
- ✅ Story upload doesn't block on approximate location (graceful degradation)
- ✅ Banner explains why precise is helpful
- ✅ Settings CTA works
- ✅ Banner re-appears/disappears on permission change

---

### Test 4: Notification Channel (Android 8+)

**Steps:**
1. Open Settings > Apps > VarsityHub > Notifications
2. **Expected:** "General" channel exists with:
   - Name: "General"
   - Importance: "Important" (MAX)
   - Sound: Enabled
   - Vibration: Enabled
   - Light color: Blue (custom color visible)

**Optional: Push Notification Test**
```bash
# Once backend sends test notification:
curl -X POST https://api.example.com/test-push \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID"}'
```

3. **Expected:** Notification arrives in "General" channel
4. Tap notification
   - **Expected:** Opens correct app screen (if deep link configured)

**Validation Points:**
- ✅ Channel exists in system Settings
- ✅ Correct importance level
- ✅ Notifications don't throw runtime warnings
- ✅ Custom color visible

---

## Smoke Test Checklist

Run through these quick checks on a real Android device:

- [ ] Precision banner appears on Create Post (approximate location)
- [ ] "Open settings" CTA deep-links correctly
- [ ] Banner dismisses after permission change
- [ ] Map toggle blocks on missing permission
- [ ] Map toggle blocks on approximate permission
- [ ] Map toggle allows with precise permission
- [ ] Story upload allows approximate location (graceful)
- [ ] Story upload banner shows Settings CTA
- [ ] Notification channel visible in Settings app
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No ESLint errors: `npm run lint` (if configured)

---

## Regression Testing

Make sure existing behavior still works:

### iOS (Should Be Unaffected)
- [ ] Create post flow works end-to-end
- [ ] Discover map toggle works
- [ ] Story upload works
- [ ] No new banners appear on iOS
- [ ] Notifications still work

### Android (Existing Flows)
- [ ] App launches without crashes
- [ ] Location prompt (if no permission) shows
- [ ] Auto-suggest games works (with or without location)
- [ ] Search results display
- [ ] Team profiles load
- [ ] Feed scrolls smoothly

---

## Known Limitations

### Current Scope
- Precision tracking only affects Android (iOS always has precise location)
- Banners dismiss on user action or permission change (re-appears on app restart if permission still approximate)
- `openSettings()` uses `Linking.openSettings()` (generic app settings; can't directly open permission in older Android)

### Future Enhancements
- Telemetry: Track how many users dismiss vs. enable precise location
- A/B test banner messaging
- Automatic location refresh timer (users staying in app longer)
- Offline fallback (cached location from previous sessions)

---

## Deployment Checklist

Before production release:

- [ ] Test on Android 8 (minimum)
- [ ] Test on Android 12+ (precision access added in 12)
- [ ] Test on tablet (permission behavior may differ)
- [ ] Verify no new console warnings: `npx expo start` and check Expo CLI logs
- [ ] Check TypeScript: `npx tsc --noEmit` ✅
- [ ] Review ESLint: `npm run lint` (if enabled)
- [ ] Get QA sign-off from Android tester
- [ ] Update app version (Android polish bump)
- [ ] Test on TestFlight (if applicable)
- [ ] Deploy to Play Store beta track first

---

## Support & Debugging

### User Reports "Banner won't go away"
- Check: `accuracyMeters` still > 200m? (takes time for GPS lock)
- Check: User actually changed permission in Settings?
- Solution: Suggest closing/reopening app (forces location refresh)

### "Settings CTA doesn't work"
- Older Android may not support `Linking.openSettings()`
- Fallback: Manual navigation ("Settings > Apps > VarsityHub > Permissions")

### "Map toggle always fails"
- Check: Permission granted?
- Check: Location service turned on system-wide?
- Check: Sufficient GPS signal for precise lock?
- Solution: Test indoors first, then outdoors for GPS lock

### Notifications not arriving
- Check: Channel created? (run `npx expo run:android` once)
- Check: INTERNET permission granted? (should be auto in Expo)
- Check: Backend sending to correct push token?

---

## Next Steps

1. **Immediate:** Smoke-test on Android 12+ device
2. **Short-term:** Get QA sign-off
3. **Medium-term:** Monitor Play Store reviews for location feedback
4. **Long-term:** Add telemetry to track precision adoption
5. **Future:** Consider "request precise once in app" flow (if needed)

---

**Contact:** For questions about Android polish, refer to `ANDROID_POLISH_STATUS.md` and this guide.

Good luck with testing! 🚀
