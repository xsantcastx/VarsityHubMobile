# 🚨 IMMEDIATE TEST - Coach Onboarding Debug

## Issue
Coach onboarding still not working - skipping steps 2-6.

## What I Just Did
1. ✅ Verified fix IS in place (clearOnboarding called)
2. ✅ Cleared all Metro/React Native caches
3. ✅ Added extensive debug logging

## CRITICAL: Test Steps (DO THIS NOW)

### Step 1: Restart Metro Bundler
```bash
# Kill any running Metro
pkill -f "expo start"
pkill -f "metro"

# Start fresh
npm run dev
```

### Step 2: Delete & Reinstall App
**IN THE SIMULATOR:**
1. Long press the VarsityHub app icon
2. Click the "X" to delete it
3. Confirm deletion

**THEN REINSTALL:**
- Press `i` in the Metro terminal, OR
- Run: `npx expo run:ios`

### Step 3: Test Coach Onboarding
1. Open the app
2. Sign in (use test account)
3. Click "Coach / Organizer" button
4. **WATCH THE METRO CONSOLE LOGS**

### Step 4: Check Console Output
You should see these logs in Metro:
```
[COACH ONBOARDING] 🔴 COACH SELECTED - CLEARING ALL STATE
[COACH ONBOARDING] ✅ State cleared
[COACH ONBOARDING] ✅ Role set to coach
[COACH ONBOARDING] ✅ Progress set to 1 (Step 2)
[COACH ONBOARDING] 🚀 Navigating to Step 2 (Basic Info)
[COACH ONBOARDING INDEX] 🔍 Coach detected, validating steps...
[COACH ONBOARDING INDEX] Current progress: 1
[COACH ONBOARDING INDEX] Current state: { "role": "coach" }
[COACH ONBOARDING INDEX] Step validation: {"hasStep2":false,"hasStep3":false,"hasStep4":false}
[COACH ONBOARDING INDEX] ⚠️ Missing Step 2 - redirecting
```

### Step 5: What Should Happen
✅ **EXPECTED**: You land on Step 2 (Basic Info page)
- You should see: Username, Date of Birth, Zip Code fields

❌ **IF YOU SEE**: Step 7 (Profile page) or any other step
- **SEND ME THE CONSOLE LOGS IMMEDIATELY**
- Something else is interfering

---

## If It STILL Skips Steps

### Nuclear Option - Clear Everything
```bash
# 1. Kill Metro
pkill -f "expo start"
pkill -f "metro"

# 2. Clear ALL caches
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/haste-map-*
watchman watch-del-all

# 3. Clear iOS build
cd ios
rm -rf build
rm -rf Pods
rm -rf ~/Library/Developer/Xcode/DerivedData
cd ..

# 4. Reinstall (if desperate)
npm install

# 5. Start fresh
npm run dev
```

Then delete app from simulator and reinstall.

---

## What the Logs Tell Us

### Scenario 1: No logs appear
**Problem**: Metro hasn't reloaded the new code
**Solution**: Restart Metro, delete app, reinstall

### Scenario 2: Logs show state with extra fields
```
Current state: { "role": "coach", "username": "olduser", "team_id": "123" }
```
**Problem**: clearOnboarding() not actually clearing
**Solution**: Check if there's an error in clearOnboarding function

### Scenario 3: Progress is > 1
```
Current progress: 5
```
**Problem**: Something is setting progress after we clear it
**Solution**: Check if server is sending back old progress

### Scenario 4: Logs show Step 2 redirect, but you see Step 7
**Problem**: React Navigation cache or routing issue
**Solution**: Check for multiple router.replace() calls conflicting

---

## Code Verification

The fix is confirmed in place:

**File: app/onboarding/step-1-role.tsx (lines 181-187)**
```typescript
if (role === 'coach') {
  console.log('[COACH ONBOARDING] 🔴 COACH SELECTED - CLEARING ALL STATE');
  await clearOnboarding();  // ← THIS CLEARS EVERYTHING
  console.log('[COACH ONBOARDING] ✅ State cleared');
  setOB({ role: 'coach' });  // ← ONLY SET ROLE
  console.log('[COACH ONBOARDING] ✅ Role set to coach');
  setProgress(1);  // ← FORCE TO STEP 2
  console.log('[COACH ONBOARDING] ✅ Progress set to 1 (Step 2)');
}
```

**File: app/onboarding/index.tsx (lines 44-87)**
- Validates coach state
- Redirects to first incomplete step
- Prevents skipping step 6

---

## Next Steps

1. **DO THE TEST** (steps above)
2. **COPY THE CONSOLE LOGS** from Metro terminal
3. **TELL ME**:
   - What step you landed on
   - What the console logs say
   - Whether the fix is working or not

The logs will tell us EXACTLY what's happening.

---

**Last Updated**: 2026-01-23
**Status**: ⏳ WAITING FOR TEST RESULTS
