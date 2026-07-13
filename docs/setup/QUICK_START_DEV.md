# 🚀 QUICK START - Real-Time Development

## ⚡ FASTEST WAY TO GET RUNNING (30 seconds)

### Step 1: Start the Dev Server

Run this in your terminal:

```bash
cd /Users/varsityhub/VarsityHubMobile
./START_DEV_NOW.sh
```

**OR manually:**

```bash
npx expo start --dev-client --tunnel --clear
```

### Step 2: Wait for QR Code

- Wait 10-15 seconds
- You'll see a **QR code** in your terminal
- You'll also see a URL like: `exp://u.expo.dev/...`

### Step 3: Connect Your Device

#### Option A: Scan QR Code (Easiest)

1. Open your **Expo Go** app (or dev build) on your phone
2. Scan the QR code from terminal
3. App loads automatically! ✅

#### Option B: Enter URL Manually

1. Open Expo Go app
2. Tap "Enter URL manually"
3. Paste the `exp://...` URL from terminal
4. Tap "Connect"

### Step 4: Start Editing!

- Edit any file in `app/` or `components/`
- Save the file
- **Changes appear instantly on your device!** 🔥

---

## 📱 What You Need

### For Physical Device:

- **Expo Go app** (from App Store/Play Store)
  - OR a **development build** you've installed

### For Simulator/Emulator:

- iOS Simulator (Mac only)
- Android Emulator

---

## 🔥 Real-Time Features

✅ **Hot Reload** - Changes appear instantly  
✅ **Fast Refresh** - Preserves component state  
✅ **Tunnel Mode** - Works on any network (WiFi, cellular, etc.)  
✅ **Error Overlay** - See errors directly on device

---

## 🛠️ Troubleshooting

### "No development build installed"

You need a dev build. Run:

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

### "Can't connect to server"

- Make sure you're using `--tunnel` flag
- Check your internet connection
- Try restarting: `Ctrl+C` then run again

### QR Code not showing

- Wait 15-20 seconds
- Check terminal for errors
- Try: `npx expo start --dev-client --tunnel --clear`

---

## 🎯 Pro Tips

1. **Keep terminal open** - Don't close it while developing
2. **Shake device** - Opens dev menu (or Cmd+D on simulator)
3. **Reload manually** - Shake device → "Reload"
4. **Clear cache** - Add `--clear` flag if things get weird

---

## 📝 Current Setup

- **App Version**: 1.0.1
- **Runtime Version**: 1.0.1
- **Dev Client**: Enabled ✅
- **Tunnel Mode**: Enabled ✅

---

**Ready? Run `./START_DEV_NOW.sh` now!** 🚀
