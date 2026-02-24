#!/bin/bash
# Open Xcode workspace and prepare for building

cd "$(dirname "$0")/.."

echo "📱 Opening Xcode workspace..."
open ios/VarsityHub.xcworkspace

echo ""
echo "✅ Xcode should now be opening with your project."
echo ""
echo "To build and run:"
echo "1. Select a simulator (e.g., iPhone 15) from the device menu"
echo "2. Press Cmd+R or click the Play button"
echo ""
echo "If you see build errors:"
echo "- Make sure CocoaPods are installed: cd ios && pod install"
echo "- Clean build folder: Product > Clean Build Folder (Shift+Cmd+K)"
echo "- Check that your development team is set in Signing & Capabilities"
