# Quick Start Steps - Small Tasks

## Step 1: Fix Port Conflict ⚡

**Option A (Easiest):** Just use port 8082
- In your terminal, press `Y` when asked "Use port 8082 instead?"
- Metro will start on port 8082

**Option B:** Kill existing process manually
```bash
kill 19194
# Then run: npm run dev
```

---

## Step 2: Start Metro Bundler 🚀

Once port is free, run:
```bash
npm run dev
```

Wait for Metro to start. You'll see:
```
› Metro waiting on exp://...
```

---

## Step 3: Launch iOS Simulator 📱

In the Metro terminal, press:
```
i
```

Or manually:
```bash
npx expo run:ios
```

Wait for the app to build and launch in simulator.

---

## Step 4: Test Fast Refresh ⚡

1. Open any component file (e.g., `app/sign-up.tsx`)
2. Change some text (e.g., "Sign Up" → "Fast Refresh Test!")
3. Save the file (`Cmd+S`)
4. **Watch simulator** - should update instantly ✨

If text changes immediately without app restart → Fast Refresh works!

---

## Step 5: Test Google Maps 🗺️

1. Navigate to "Nearby Games" screen in the app
2. Map should load without errors
3. You should see Google Maps (not Apple Maps)
4. No "AirGoogleMaps" error message

---

## Troubleshooting

**If Fast Refresh doesn't work:**
- Press `r` in Metro terminal for manual reload
- Check for syntax errors in your code
- Restart Metro: `Ctrl+C` then `npm run dev`

**If Map still shows error:**
- Make sure you rebuilt after pod install: `npx expo run:ios`
- Check `ios/VarsityHub/Info.plist` has `GMSApiKey`

---

## Current Status ✅

- ✅ Pods installed (react-native-maps ready)
- ✅ GMSApiKey in Info.plist
- ✅ Fast Refresh configured
- ⏳ Just need to start Metro and test!
