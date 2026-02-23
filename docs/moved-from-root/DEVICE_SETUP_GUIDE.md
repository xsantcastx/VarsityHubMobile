# 📱 Getting VarsityHub on Your Phone - Live Development Setup

This guide will get the app running on your phone with **real-time code changes** (hot reload).

---

## Quick Start (Choose Your Method)

### Option 1: If You Already Have a Development Build ⚡ (Fastest)

If you've previously built and installed a dev client on your phone:

```bash
# Start the development server with tunnel (works from anywhere)
npx expo start --dev-client --tunnel

# Scan the QR code with your phone camera (iOS) or Expo Go app
# The app should reload automatically
```

---

### Option 2: Build Development Client First (First Time Setup)

Since this app uses custom native modules, you need a **development build** (not Expo Go).

#### Step 1: Install Expo CLI & EAS CLI

```bash
npm install -g expo-cli eas-cli
```

#### Step 2: Build Development Client

**For iOS (requires Apple Developer account):**
```bash
# Build development client
eas build --profile development --platform ios

# This will create a build you can install via TestFlight or directly
# Wait ~15-20 minutes for build to complete
```

**For Android:**
```bash
# Build development client
eas build --profile development --platform android

# Download APK and install on your phone
# Or use: eas build --profile development --platform android --local
```

#### Step 3: Install on Your Phone

**iOS:**
- Check your email for TestFlight invite, or
- Download from EAS Build dashboard: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds

**Android:**
- Download APK from build dashboard and install

#### Step 4: Start Development Server

```bash
# Start with tunnel (recommended - works on any network)
npx expo start --dev-client --tunnel

# OR use LAN (only works if phone and computer on same WiFi)
npx expo start --dev-client --lan
```

#### Step 5: Connect Your Phone

**In the development build app on your phone:**
1. Tap "Enter URL manually" or scan QR code
2. Enter the tunnel URL shown in terminal (e.g., `exp://abc-123.tunnel.exp.direct:80`)
3. App will load and connect

---

## Real-Time Editing Workflow ✨

Once connected, you can now:

1. **Edit code** in your editor (VS Code, Cursor, etc.)
2. **Save the file**
3. **See changes instantly** on your phone! 🔥

**Hot reload works for:**
- ✅ JavaScript/TypeScript code
- ✅ React components
- ✅ Styles and layouts
- ✅ API calls and logic

**Requires app restart for:**
- ⚠️ Native module changes
- ⚠️ App configuration (app.json)
- ⚠️ New dependencies

---

## Troubleshooting

### "Cannot connect to development server"

**Solution 1: Use Tunnel Mode**
```bash
npx expo start --dev-client --tunnel
```

**Solution 2: Check Network**
```bash
# Make sure phone and computer are on same network (for LAN mode)
# OR use tunnel mode (works on any network)
```

### "No development build found"

**Solution:** You need to build and install a development client first (see Option 2 above).

### "Expo Go doesn't work"

**This is expected!** This app uses custom native modules, so it requires a development build, not Expo Go.

### App Not Updating After Code Changes

```bash
# Restart Metro bundler with cache cleared
npx expo start --dev-client --clear --tunnel

# Shake phone → "Reload" from dev menu
```

---

## Current Configuration

- **API URL**: `https://api-production-8ac3.up.railway.app` (already configured)
- **Project ID**: `64489ed7-a8c0-41de-91ec-5846ea79a27f`
- **Platforms**: iOS & Android

---

## Commands Reference

```bash
# Start development server (tunnel - works anywhere)
npx expo start --dev-client --tunnel

# Start development server (LAN - same WiFi only)
npx expo start --dev-client --lan

# Clear cache and restart
npx expo start --dev-client --clear --tunnel

# Check if Metro is running
lsof -i :8081

# View logs
npx expo start --dev-client --tunnel | tee metro.log
```

---

## Next Steps

1. **If you have a dev build**: Just run `npx expo start --dev-client --tunnel`
2. **If you don't**: Build one with `eas build --profile development --platform ios` (or android)

Once connected, we can make real-time edits! 🚀
