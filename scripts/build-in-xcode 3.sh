#!/bin/bash
# Build iOS app using Xcode command line tools

cd "$(dirname "$0")/.."

echo "📱 Building VarsityHub in Xcode..."
echo ""

cd ios

# List available simulators
echo "Available simulators:"
xcrun simctl list devices available | grep -i "iphone" | head -5
echo ""

# Get first available iPhone simulator
SIMULATOR=$(xcrun simctl list devices available | grep -i "iphone" | head -1 | sed 's/.*(\(.*\))/\1/' | tr -d ' ')

if [ -z "$SIMULATOR" ]; then
    echo "⚠️  No simulator found, using default"
    SIMULATOR="iPhone 15"
fi

echo "📱 Building for simulator: $SIMULATOR"
echo ""

# Build the project
xcodebuild \
    -workspace VarsityHub.xcworkspace \
    -scheme VarsityHub \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "platform=iOS Simulator,name=$SIMULATOR" \
    clean build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "To run the app:"
    echo "1. Open Xcode: ios/VarsityHub.xcworkspace"
    echo "2. Select simulator: $SIMULATOR"
    echo "3. Press Cmd+R"
    echo ""
    echo "Or install and run:"
    echo "xcrun simctl install booted /Users/varsityhub/Library/Developer/Xcode/DerivedData/VarsityHub-*/Build/Products/Debug-iphonesimulator/VarsityHub.app"
    echo "xcrun simctl launch booted com.varsithub.varsityhub"
else
    echo ""
    echo "❌ Build failed. Check errors above."
    exit 1
fi
