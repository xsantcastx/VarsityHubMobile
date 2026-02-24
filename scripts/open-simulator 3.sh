#!/bin/bash
# Quick script to open iOS Simulator and connect to Metro

echo "🚀 Opening iOS Simulator..."

# Try to open Simulator app
if [ -d "/Applications/Xcode.app" ]; then
    open -a "Xcode" --args -AppleLanguages en
    sleep 2
    # Open Simulator via xcode-select
    xcrun simctl boot "iPhone 15 Pro" 2>/dev/null || xcrun simctl boot "iPhone 15" 2>/dev/null || true
    open -a Simulator 2>/dev/null || echo "Please open Simulator manually from Xcode > Open Developer Tool > Simulator"
else
    echo "⚠️  Xcode not found. Please open Simulator manually."
    echo "   Xcode > Open Developer Tool > Simulator"
fi

echo ""
echo "📱 Once Simulator is open:"
echo "   1. Make sure Metro is running (npm run dev)"
echo "   2. In the Metro terminal, press 'i' to launch app"
echo "   3. Or build and run: npx expo run:ios"
echo ""
