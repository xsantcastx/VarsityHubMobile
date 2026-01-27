#!/bin/bash

# Quick script to build and install development build for Fast Refresh

echo "=========================================="
echo "Building Development Build for iOS"
echo "=========================================="
echo ""
echo "This will:"
echo "1. Build the iOS app with native dependencies"
echo "2. Install it on the iOS simulator"
echo "3. Start Metro bundler"
echo "4. Launch the app"
echo ""
echo "⏱️  First build takes 5-10 minutes. Please be patient..."
echo ""

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed or not in PATH"
    echo "   Please install Xcode from the App Store"
    exit 1
fi

# Check if simulator is available
if ! xcrun simctl list devices available | grep -q "iPhone"; then
    echo "❌ No iOS simulators found"
    echo "   Opening Simulator app..."
    open -a Simulator
    sleep 5
fi

echo "✅ Xcode found"
echo "✅ Simulators available"
echo ""
echo "Starting build..."
echo ""

# Build and install
npx expo run:ios

echo ""
echo "=========================================="
echo "Build Complete!"
echo "=========================================="
echo ""
echo "Now you can use Fast Refresh:"
echo "  npx expo start --dev-client --clear"
echo ""
echo "Then press 'i' to open iOS simulator"
echo ""
