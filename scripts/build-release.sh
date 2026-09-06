#!/bin/bash
# Build and deploy VarsityHub Release to iPhone
# Usage: ./scripts/build-release.sh

set -euo pipefail

DEVICE_ID="00008120-000A19E81A33401E"
WORKSPACE="ios/VarsityHub.xcworkspace"
SCHEME="VarsityHub"
BUILD_DIR="$HOME/Library/Developer/Xcode/DerivedData/VarsityHub-ahadxeeozucajnechlgbifmnwahe/Build/Products/Release-iphoneos"

echo "Building VarsityHub Release..."

cd "$(dirname "$0")/.."

# Build release
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "id=$DEVICE_ID" \
  -allowProvisioningUpdates \
  build 2>&1 | grep -E "(Compiling|Linking|error:|BUILD SUCCEEDED|BUILD FAILED)" | tail -20

echo ""
echo "Installing to iPhone..."
xcrun devicectl device install app --device "$DEVICE_ID" "$BUILD_DIR/VarsityHub.app"

echo ""
echo "Launching app..."
xcrun devicectl device process launch --device "$DEVICE_ID" com.varsithub.varsityhub

# Save a copy
mkdir -p builds
cp -R "$BUILD_DIR/VarsityHub.app" "builds/VarsityHub-Release-$(date +%Y%m%d-%H%M%S).app"

echo ""
echo "Done! App is running on your iPhone."
echo "Build saved to: builds/VarsityHub-Release-$(date +%Y%m%d-%H%M%S).app"
