# Installing Development Build for Fast Refresh

## Problem

Error: "No development build (com.varsithub.varsityhub) for this project is installed"

## Solution

You need to build and install the development build on your simulator first.

### Step 1: Build and Install Development Build

```bash
# This will build the native app and install it on the simulator
npx expo run:ios
```

This command will:

1. Build the iOS app with all native dependencies
2. Install it on the iOS simulator
3. Start Metro bundler automatically
4. Launch the app

**Note:** The first build takes 5-10 minutes. Subsequent builds are faster.

### Step 2: After Build Completes

Once the build is installed, you can use Fast Refresh:

```bash
# Start Metro (if not already running)
npx expo start --dev-client --clear
```

Then press `i` to open the iOS simulator (the app should already be installed).

## Alternative: Use Expo Go (Limited)

If you don't need custom native code, you can use Expo Go:

```bash
npx expo start
# Then press 'i' for iOS
```

**Warning:** Expo Go doesn't support all native modules, so some features may not work.

## Troubleshooting

### Build Fails

1. **Clean build:**

   ```bash
   npx expo run:ios --no-build-cache
   ```

2. **Reinstall pods:**
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   npx expo run:ios
   ```

### Simulator Not Opening

1. **Open simulator manually:**

   ```bash
   open -a Simulator
   ```

2. **List available simulators:**

   ```bash
   xcrun simctl list devices
   ```

3. **Specify device:**
   ```bash
   npx expo run:ios --device "iPhone 15 Pro"
   ```

### Fast Refresh Still Not Working

After installing the dev build, make sure to:

1. Restart Metro with `--clear` flag
2. Test Fast Refresh by making a small change to a component
3. Check that the Babel config uses `react-native-worklets/plugin` (already fixed)

## Quick Reference

```bash
# First time setup (build dev client)
npx expo run:ios

# Daily development (after dev client is installed)
npx expo start --dev-client --clear
# Press 'i' for iOS simulator
```
