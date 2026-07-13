# Build Troubleshooting Guide - Release Build Archive Failure

## Status

- **DEBUG Build**: ✅ Succeeds (verified in `.cache/expo/.expo/xcodebuild.log`)
- **RELEASE Build (fastlane)**: ❌ Archive Failed (ARCHIVE FAILED with no detailed error)

## Root Cause Analysis

The fastlane output you shared ended at:

```
▸ ** ARCHIVE FAILED **
▸ The following build commands failed:
▸ 	Archiving workspace VarsityHub with scheme VarsityHub
▸ (1 failure)
```

**The actual compiler/linker/codesign error is NOT included in the summary output.** This happens because fastlane's output was truncated or suppressed.

## How to Capture the Real Error

### Option 1: Re-run with Verbose Output (Recommended)

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
eas build --local --platform ios --profile production --verbose 2>&1 | tee eas-build-verbose.log
```

Then search for first error:

```bash
grep -n "error:" eas-build-verbose.log | head -1
# Then read ~50 lines around that line number
sed -n '$(LINE-50),$(LINE+50)p' eas-build-verbose.log
```

### Option 2: Use xcodebuild Directly

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/ios
xcodebuild -workspace VarsityHub.xcworkspace \
  -scheme VarsityHub \
  -configuration Release \
  -destination generic/platform=iOS \
  archive \
  -archivePath /tmp/VarsityHub.xcarchive 2>&1 | tee xcodebuild-release.log
```

### Option 3: Use Xcode GUI

1. Open `/Users/varsityhub/Desktop/CODE/VarsityHubMobile/ios/VarsityHub.xcworkspace` in Xcode
2. Select: Product → Archive
3. Watch the build output panel in real-time
4. When it fails, the error will appear in the build log

## Common Release Build Failures

### 1. Code Signing Issues

**Error**: "Code Sign error: No signing identity found"

- Check provisioning profiles in Xcode settings
- Verify certificate is installed: `security find-identity -v -p codesigning`

### 2. Swift Compilation Errors (Hidden in Release)

**Error**: Swift files that compile in Debug fail in Release

- Usually optimization-related or unused code issues
- Check for `@available` attributes or platform-specific code

### 3. Linker Errors

**Error**: "Undefined symbol" or "ld: symbol(s) not found"

- Missing frameworks or pod dependencies
- Run: `pod install` then retry

### 4. Asset Bundling

**Error**: "Missing required info" or "Failed to copy resource"

- Check Assets.xcassets integrity
- Verify bundle identifiers match

## Recommended Next Steps

1. **Capture Full Log** using Option 1 or 2 above
2. **Search for "error:"** in the log
3. **Share the error section** (error line + 40 lines context)
4. **I'll provide specific fix**

## Files to Check

- `ios/Podfile` - Pod dependencies
- `ios/VarsityHub.xcodeproj/project.pbxproj` - Build settings
- `ios/VarsityHub/Info.plist` - App configuration
- `app.json` - Expo configuration
- `eas.json` - EAS build configuration

## After Getting Full Error Log

Once you capture the actual error message, please share:

1. The line with "error:"
2. 20 lines BEFORE the error
3. 30 lines AFTER the error

This will allow me to identify:

- Whether it's a code issue (Swift/TypeScript)
- Whether it's a configuration issue (signing, Info.plist)
- Whether it's a dependency issue (pods, frameworks)
- Whether it's an environment issue (Xcode version, SDK)

---

**Save this file and come back after capturing the build log with one of the options above.**
