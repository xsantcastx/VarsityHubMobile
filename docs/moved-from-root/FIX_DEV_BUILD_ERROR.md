# Fix: "No development build installed" Error

## The Problem

You're seeing:

```
CommandError: No development build (com.varsithub.varsityhub) for this project is installed.
```

**Why:** This app uses custom native modules, so you **cannot** use Expo Go. You need a **development build**.

---

## Solution: Build a Development Client

### For iOS (iPhone/iPad):

**Step 1: Build development client**

```bash
eas build --profile development --platform ios
```

**Step 2: Install on device**

- Wait for build to complete (~15-20 minutes)
- Check email for TestFlight invite, OR
- Download from: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds
- Install via TestFlight or direct download

**Step 3: Start dev server**

```bash
npx expo start --dev-client --tunnel
```

**Step 4: Connect**

- Open the development build app on your phone
- Scan QR code or enter URL manually
- Now you can edit code in real-time! 🔥

---

### For Android:

**Step 1: Build development client**

```bash
eas build --profile development --platform android
```

**Step 2: Install APK**

- Wait for build (~15-20 minutes)
- Download APK from EAS dashboard
- Enable "Install from unknown sources" on Android
- Install the APK file

**Step 3: Start dev server**

```bash
npx expo start --dev-client --tunnel
```

**Step 4: Connect**

- Open the development build app
- Scan QR code or enter URL
- Start editing!

---

## Alternative: Use Simulator/Emulator

If you don't want to build for a physical device right now:

### iOS Simulator (macOS only):

```bash
npx expo run:ios
```

This builds and installs directly to the simulator.

### Android Emulator:

```bash
npx expo run:android
```

This builds and installs directly to the emulator.

---

## Why You Need This

Your app has these custom native modules:

- `expo-notifications` - Push notifications
- `expo-apple-authentication` - Apple Sign-In
- `expo-location` - Location services
- And more...

**Expo Go doesn't include these**, so you need a custom development build.

---

## Quick Commands Reference

```bash
# Build dev client for your device
eas build --profile development --platform ios     # iPhone
eas build --profile development --platform android # Android

# Or run on simulator/emulator (no build needed)
npx expo run:ios      # iOS Simulator
npx expo run:android  # Android Emulator

# Start dev server (after build is installed)
npx expo start --dev-client --tunnel
```

---

## Timeline

- **Development build:** 15-20 minutes (one-time setup)
- **After that:** Instant hot reload every time! ⚡

---

**Next Step:** Choose your platform and run the build command above.
