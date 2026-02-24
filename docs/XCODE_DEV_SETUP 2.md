# Xcode Development Setup with Fast Refresh

This guide will help you set up a local development environment where you can:
- Build and run your app from Xcode
- Get real-time updates with Fast Refresh
- Make changes and see them instantly without rebuilding

## Prerequisites

- Xcode installed (latest version recommended)
- CocoaPods installed: `sudo gem install cocoapods`
- Node.js and npm installed
- Expo CLI: `npm install -g expo-cli` (optional, but helpful)

## Quick Start

### Option 1: Automated Setup (Recommended)

1. **Build the development client:**
   ```bash
   npm run dev:xcode
   ```
   This will:
   - Generate native iOS project files
   - Install CocoaPods dependencies
   - Prepare the project for Xcode

2. **Open in Xcode:**
   ```bash
   open ios/VarsityHub.xcworkspace
   ```
   ⚠️ **Important:** Always open the `.xcworkspace` file, NOT the `.xcodeproj` file!

3. **Start the Metro bundler (in a separate terminal):**
   ```bash
   npm run dev:server
   ```
   This starts the Metro bundler on `localhost:8081` with Fast Refresh enabled.

4. **Run from Xcode:**
   - Select your target device or simulator in Xcode
   - Press `⌘R` (or click the Run button)
   - The app will automatically connect to the Metro bundler

5. **Make changes:**
   - Edit any `.tsx`, `.ts`, or `.js` file
   - Save the file
   - Fast Refresh will automatically update the app! 🎉

### Option 2: Manual Setup

If you prefer to set things up manually:

1. **Prebuild the iOS project:**
   ```bash
   npx expo prebuild --platform ios --clean
   ```

2. **Install CocoaPods:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Start Metro bundler:**
   ```bash
   npx expo start --dev-client --scheme varsityhubmobile --host localhost --port 8081
   ```

4. **Open in Xcode and run:**
   ```bash
   open ios/VarsityHub.xcworkspace
   ```

## How It Works

1. **Development Client**: The app built in Xcode includes `expo-dev-client`, which allows it to connect to a Metro bundler.

2. **Metro Bundler**: Runs on `localhost:8081` and serves your JavaScript bundle with Fast Refresh support.

3. **Fast Refresh**: When you save a file, Metro detects the change and sends an update to the running app, which applies the change instantly without a full reload.

## Troubleshooting

### Metro bundler won't start

**Error:** Port 8081 already in use

**Solution:**
```bash
# Kill the process using port 8081
lsof -ti:8081 | xargs kill -9

# Or use the dev:server script which handles this automatically
npm run dev:server
```

### App won't connect to Metro

**Check:**
1. Metro bundler is running (`npm run dev:server`)
2. You're using the development client (not Expo Go)
3. The app is running in debug mode in Xcode
4. Your Mac's firewall isn't blocking port 8081

**Solution:**
- In Xcode, go to Product → Scheme → Edit Scheme
- Ensure "Build Configuration" is set to "Debug"
- Check that "Debug executable" is checked

### Fast Refresh not working

**Check:**
1. Metro config has Fast Refresh enabled (already configured in `metro.config.js`)
2. Babel config includes react-refresh plugin (already configured in `babel.config.js`)
3. You're not using class components (Fast Refresh works best with function components)

**Solution:**
- Clear Metro cache: `npm run dev` (uses `--clear` flag)
- Restart Metro bundler
- Rebuild the app in Xcode

### Changes not appearing

1. **Check Metro bundler logs** - You should see "Fast Refresh" messages when you save files
2. **Reload manually** - Shake device/simulator → "Reload" or press `⌘R` in Xcode
3. **Check for syntax errors** - Fast Refresh won't apply if there are errors

### "Unable to connect to Metro" error

**Solution:**
1. Ensure Metro is running: `npm run dev:server`
2. Check the Metro URL in Xcode console
3. If using a physical device, ensure your Mac and device are on the same network
4. For simulator, `localhost` should work automatically

## Development Workflow

### Typical Development Session

1. **Start Metro bundler:**
   ```bash
   npm run dev:server
   ```
   Keep this terminal open - it needs to stay running.

2. **Open Xcode:**
   ```bash
   open ios/VarsityHub.xcworkspace
   ```

3. **Build and run once:**
   - Select your target (simulator or device)
   - Press `⌘R` to build and run
   - Wait for the app to launch

4. **Make changes:**
   - Edit your code in your editor (VS Code, Cursor, etc.)
   - Save the file
   - Watch Fast Refresh update the app automatically!

5. **When you need to rebuild:**
   - Only rebuild in Xcode if you:
     - Add new native dependencies
     - Change native code
     - Modify `app.json` native config
     - Add new assets that need to be bundled

### Hot Reload vs Fast Refresh

- **Fast Refresh** (default): Preserves component state when possible. Best for React development.
- **Hot Reload**: Full reload, loses component state. Use if Fast Refresh isn't working.

To switch to Hot Reload:
- Shake device/simulator → "Enable Hot Reloading"

## Advanced Configuration

### Custom Metro Port

If port 8081 is unavailable, you can change it:

1. **Update Metro config** (`metro.config.js`):
   ```javascript
   // Add server config
   config.server = {
     port: 8082, // Your custom port
   };
   ```

2. **Update Xcode scheme** to use the new port (usually auto-detected)

### Network Debugging

If you need to debug on a physical device:

1. **Find your Mac's IP:**
   ```bash
   ipconfig getifaddr en0
   ```

2. **Start Metro with your IP:**
   ```bash
   EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 npx expo start --dev-client --host lan
   ```

3. **The app will connect automatically** (development client handles this)

## Tips

- ✅ Keep Metro bundler running in a separate terminal
- ✅ Use the `.xcworkspace` file, not `.xcodeproj`
- ✅ Fast Refresh works best with function components and hooks
- ✅ Some changes (like adding new files) may require a manual reload
- ✅ Check Metro logs for helpful error messages

## Next Steps

- Read about [Fast Refresh limitations](https://reactnative.dev/docs/fast-refresh)
- Learn about [Expo Dev Client](https://docs.expo.dev/clients/introduction/)
- Explore [Metro bundler configuration](https://docs.expo.dev/guides/customizing-metro/)

Happy coding! 🚀
