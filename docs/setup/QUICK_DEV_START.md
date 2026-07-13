# Quick Start: Xcode Development with Fast Refresh

## 🚀 Quick Setup (3 Steps)

### 1. Build Development Client

```bash
npm run dev:xcode
```

### 2. Start Metro Bundler (keep this running)

```bash
npm run dev:server
```

### 3. Open & Run in Xcode

```bash
open ios/VarsityHub.xcworkspace
```

Then press `⌘R` to build and run.

## ✨ That's It!

Now you can:

- Edit any `.tsx`, `.ts`, or `.js` file
- Save the file
- See changes instantly with Fast Refresh! 🎉

## 📝 Common Commands

```bash
# Start Metro bundler
npm run dev:server

# Rebuild development client (if you add native deps)
npm run dev:xcode

# Run on iOS simulator (alternative to Xcode)
npm run dev:ios

# Clear cache and restart
npm run dev
```

## 🔧 Troubleshooting

**Metro won't start?**

```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9
npm run dev:server
```

**App won't connect?**

- Make sure Metro is running (`npm run dev:server`)
- Check Xcode console for connection errors
- Ensure you're using the dev client (not Expo Go)

**Fast Refresh not working?**

- Check Metro logs for errors
- Try manual reload: Shake device → "Reload"
- Clear cache: `npm run dev` (uses --clear)

## 📚 Full Documentation

See `docs/XCODE_DEV_SETUP.md` for detailed setup and troubleshooting.
