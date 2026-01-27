# 🔧 Fix Codegen Build Errors

## The Problem
Xcode is trying to compile codegen files before they're generated, causing:
- `ComponentDescriptors.cpp` not found
- `RCTAppDependencyProvider.mm` not found

## ✅ Files Actually Exist
The files ARE being generated during `pod install`, but Xcode can't find them during build.

## 🔧 Solution: Clean Build

Run this sequence:

```bash
# 1. Clean everything
rm -rf ios/build ios/Pods ios/Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/VarsityHub-*

# 2. Reinstall pods (generates codegen files)
cd ios
export LANG=en_US.UTF-8
pod install
cd ..

# 3. Build with clean cache
export LANG=en_US.UTF-8
npx expo run:ios --no-build-cache
```

## Alternative: Build in Xcode

1. Open `ios/VarsityHub.xcworkspace` in Xcode
2. Product → Clean Build Folder (Shift+Cmd+K)
3. Product → Build (Cmd+B)
4. If it fails, check Build Phases order:
   - Codegen script phase should run BEFORE compilation
   - Check "Run Script" phases are in correct order

## Why This Happens

React Native's new architecture generates codegen files during pod install, but Xcode's build system sometimes tries to compile them before they're ready. A clean build fixes the ordering.

---

**Current Status**: Build running in background with `--no-build-cache` flag
