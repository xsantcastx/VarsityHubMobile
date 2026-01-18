# Run App on iOS Simulator (Quick Fix)

## The Problem

You're seeing:
```
CommandError: No development build (com.varsithub.varsityhub) for this project is installed.
```

This happens because `expo start` is running in dev-client mode, which expects a pre-built development client.

---

## Solution: Use `expo run:ios` Instead

**Step 1: Stop the current Expo server**
- Press `Ctrl+C` in your terminal to stop `expo start`

**Step 2: Run on simulator directly**
```bash
npx expo run:ios
```

This command will:
- ✅ Build the app automatically
- ✅ Install it on the iOS Simulator
- ✅ Start Metro bundler
- ✅ Launch the app

**No need for a separate development build!**

---

## What `expo run:ios` Does

1. Opens iOS Simulator (if not already open)
2. Builds the native app with all your custom modules
3. Installs it on the simulator
4. Starts Metro bundler
5. Launches the app

**Time:** ~5-10 minutes (first time), then faster on subsequent runs

---

## After It's Running

Once the app is on the simulator:
- ✅ You can edit code in real-time
- ✅ Changes hot-reload automatically
- ✅ No need to rebuild (unless you change native code)

---

## Alternative: If You Want to Use `expo start`

If you prefer using `expo start` with the simulator:

**Option 1: Build dev client first**
```bash
# Build development client for simulator
eas build --profile development --platform ios --local

# Then use expo start
npx expo start --dev-client
```

**Option 2: Use regular expo start (won't work with custom modules)**
```bash
# This won't work because you have custom native modules
npx expo start
# Then press 'i' for iOS
```

---

## Quick Command Reference

```bash
# Best option: Direct simulator build
npx expo run:ios

# Alternative: Start server then build
npx expo start
# Then in another terminal:
npx expo run:ios
```

---

## Troubleshooting

**"Simulator not found"**
```bash
# Open Simulator manually
open -a Simulator

# Then run again
npx expo run:ios
```

**"Build failed"**
```bash
# Clean and rebuild
cd ios && pod install && cd ..
npx expo run:ios --clean
```

**"Xcode not found"**
- Install Xcode from App Store
- Run: `xcode-select --install`

---

**Next Step:** Stop `expo start` (Ctrl+C) and run `npx expo run:ios`
