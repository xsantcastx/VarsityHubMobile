# Xcode Setup Instructions

## Quick Start

1. **Open Xcode manually:**
   - Open Xcode application
   - File > Open
   - Navigate to: `/Users/varsityhub/VarsityHubMobile/ios/VarsityHub.xcworkspace`
   - **IMPORTANT:** Open the `.xcworkspace` file, NOT the `.xcodeproj` file

2. **Select a Simulator:**
   - In Xcode's toolbar, click the device selector (next to the Play button)
   - Choose an iPhone simulator (e.g., iPhone 15, iPhone 15 Pro)

3. **Build and Run:**
   - Press `Cmd+R` or click the Play button
   - Xcode will build the app and launch it in the simulator

## If You Get Build Errors

### CocoaPods Not Installed

```bash
cd ios
pod install
```

### Signing Issues

1. In Xcode, select the `VarsityHub` project in the navigator
2. Select the `VarsityHub` target
3. Go to "Signing & Capabilities" tab
4. Check "Automatically manage signing"
5. Select your development team

### Clean Build

- Product > Clean Build Folder (Shift+Cmd+K)
- Then build again (Cmd+R)

## Alternative: Use Expo CLI

If Xcode gives you trouble, you can also build and run using:

```bash
npm run ios
```

This will:

- Build the native iOS app
- Install dependencies
- Launch the simulator
- Run your app

## Project Structure

- **Workspace:** `ios/VarsityHub.xcworkspace` ← Use this in Xcode
- **Project:** `ios/VarsityHub.xcodeproj` ← Don't use this directly
- **Pods:** `ios/Pods/` ← CocoaPods dependencies

## Troubleshooting

### "No such module" errors

Run: `cd ios && pod install`

### Simulator won't launch

- Check Xcode > Settings > Platforms
- Make sure iOS simulators are installed
- Try: `xcrun simctl list devices`

### Build fails with signing errors

- Make sure you have a valid Apple Developer account
- Set your development team in Signing & Capabilities
- For simulator builds, you can use "Personal Team" (free)
