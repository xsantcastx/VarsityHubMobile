#!/bin/sh
# Xcode Cloud post-clone script for VarsityHub (Expo / React Native)
# Must live at: ios/ci_scripts/ci_post_clone.sh (sibling of .xcodeproj)
# See: .docs/XCODE_CLOUD_SETUP.md

set -e

echo "🚀 Xcode Cloud: Starting post-clone setup..."

# Xcode Cloud runs this script from ios/ci_scripts/; project root is two levels up
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "📁 Project root: $PROJECT_ROOT"

# Install Node.js and CocoaPods if not present (Xcode Cloud VM may have them)
if ! command -v node >/dev/null 2>&1 || ! command -v pod >/dev/null 2>&1; then
  echo "📦 Installing Node and CocoaPods..."
  brew install node cocoapods
fi

echo "📦 Installing Node.js dependencies..."
npm ci

# Xcode Cloud sets CI=TRUE (uppercase), which causes Expo GetEnv.NoBoolean error.
# Override to lowercase so expo prebuild succeeds.
echo "🔨 Running Expo prebuild (iOS)..."
CI="true" npx expo prebuild --platform ios --clean

echo "✅ Xcode Cloud post-clone complete!"
