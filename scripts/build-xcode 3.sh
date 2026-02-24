#!/bin/bash
# Build and run iOS app in Xcode simulator

cd "$(dirname "$0")/.."

echo "📱 Building iOS app for simulator..."
echo ""

# Check if workspace exists
if [ ! -d "ios/VarsityHub.xcworkspace" ]; then
    echo "❌ Error: Workspace not found at ios/VarsityHub.xcworkspace"
    echo "   Run: cd ios && pod install"
    exit 1
fi

# List available simulators
echo "Available simulators:"
xcrun simctl list devices available | grep -i "iphone" | head -5
echo ""

# Try to build
echo "🔨 Building project..."
cd ios

# Get first available iPhone simulator
SIMULATOR=$(xcrun simctl list devices available | grep -i "iphone" | head -1 | sed 's/.*(\(.*\))/\1/' | tr -d ' ')

if [ -z "$SIMULATOR" ]; then
    echo "⚠️  No simulator found, using default"
    SIMULATOR="iPhone 15"
fi

echo "📱 Using simulator: $SIMULATOR"
echo ""

# Build the project
xcodebuild \
    -workspace VarsityHub.xcworkspace \
    -scheme VarsityHub \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "platform=iOS Simulator,name=$SIMULATOR" \
    build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "To run in Xcode:"
    echo "1. Open: ios/VarsityHub.xcworkspace"
    echo "2. Select simulator: $SIMULATOR"
    echo "3. Press Cmd+R"
else
    echo ""
    echo "❌ Build failed. Check errors above."
    echo ""
    echo "Common fixes:"
    echo "- Run: cd ios && pod install"
    echo "- Clean build: Product > Clean Build Folder in Xcode"
    exit 1
fi
