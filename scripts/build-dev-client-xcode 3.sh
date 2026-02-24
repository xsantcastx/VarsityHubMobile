#!/bin/bash

# Build Development Client for Xcode
# This script builds a development client that can be run from Xcode
# After building, you can open the project in Xcode and run it there

set -e

echo "🔨 Building Development Client for iOS..."
echo ""
echo "This will:"
echo "  1. Generate native iOS project files"
echo "  2. Install CocoaPods dependencies"
echo "  3. Build the development client"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Prebuild to generate native files
echo "📦 Prebuilding iOS project..."
npx expo prebuild --platform ios --clean

# Install CocoaPods
echo ""
echo "📦 Installing CocoaPods dependencies..."
cd ios
pod install
cd ..

echo ""
echo "✅ Development client is ready!"
echo ""
echo "Next steps:"
echo "  1. Open Xcode: open ios/VarsityHub.xcworkspace"
echo "  2. Select your target device/simulator"
echo "  3. Build and run (⌘R)"
echo "  4. In another terminal, run: npm run dev:server"
echo ""
echo "The app will automatically connect to the Metro bundler for fast refresh!"
