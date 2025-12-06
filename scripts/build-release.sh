#!/bin/bash

# VarsityHub iOS Release Builder
# Automates the process of creating a production-ready archive for App Store submission

set -e

PROJECT_ROOT="/Users/varsityhub/Desktop/CODE/VarsityHubMobile"
BUILD_DIR="$PROJECT_ROOT/build"
ARCHIVE_PATH="$BUILD_DIR/VarsityHub.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
IOS_DIR="$PROJECT_ROOT/ios"

echo "🚀 VarsityHub iOS Release Builder"
echo "=================================="
echo ""

# Step 1: Clean
echo "📦 Step 1: Cleaning build environment..."
rm -rf ~/Library/Developer/Xcode/DerivedData/VarsityHub-*
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
echo "✅ Build environment cleaned"
echo ""

# Step 2: Fresh prebuild
echo "📦 Step 2: Preparing fresh build..."
cd "$PROJECT_ROOT"
npx expo prebuild --clean --platform ios 2>&1 | tail -5
echo "✅ Prebuild complete"
echo ""

# Step 3: CocoaPods install
echo "📦 Step 3: Installing CocoaPods dependencies..."
cd "$IOS_DIR"
pod install --repo-update 2>&1 | tail -10
echo "✅ CocoaPods installed"
echo ""

# Step 4: Build archive for device (iphoneos, not simulator)
echo "📦 Step 4: Creating release archive for device..."
xcodebuild \
  -workspace VarsityHub.xcworkspace \
  -scheme VarsityHub \
  -configuration Release \
  -sdk iphoneos \
  -archivePath "$ARCHIVE_PATH" \
  archive 2>&1 | tail -30

if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "❌ Archive creation failed!"
  exit 1
fi
echo "✅ Release archive created"
echo ""

# Step 5: Verify archive integrity
echo "📦 Step 5: Verifying archive integrity..."
EXPECTED_APP="$ARCHIVE_PATH/Products/Applications/VarsityHub.app"
if [ -d "$EXPECTED_APP" ]; then
  APP_SIZE=$(du -h "$EXPECTED_APP" | cut -f1)
  echo "✅ Archive verified - App size: $APP_SIZE"
else
  echo "❌ Archive validation failed!"
  exit 1
fi
echo ""

# Step 6: Export for App Store
echo "📦 Step 6: Exporting for App Store..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$IOS_DIR/ExportOptions.plist" 2>&1 | tail -20

if [ -f "$EXPORT_PATH/VarsityHub.ipa" ]; then
  IPA_SIZE=$(du -h "$EXPORT_PATH/VarsityHub.ipa" | cut -f1)
  echo "✅ Export successful - IPA size: $IPA_SIZE"
else
  echo "❌ Export failed!"
  exit 1
fi
echo ""

# Final Summary
echo "=================================="
echo "✅ BUILD COMPLETE & READY"
echo "=================================="
echo ""
echo "📊 Build Artifacts:"
echo "  Archive: $ARCHIVE_PATH"
echo "  IPA:     $EXPORT_PATH/VarsityHub.ipa"
echo ""
echo "📝 Next Steps:"
echo "  1. Open Xcode Organizer: Window → Organizer"
echo "  2. Select 'VarsityHub' archive"
echo "  3. Click 'Distribute App'"
echo "  4. Choose 'App Store Connect'"
echo "  5. Follow prompts to upload"
echo ""
echo "Or use xcrun to upload directly:"
echo "  xcrun altool --upload-app -f '$EXPORT_PATH/VarsityHub.ipa' -t ios"
echo ""
echo "🎉 Ready for App Store submission!"
