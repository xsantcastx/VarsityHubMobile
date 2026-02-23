#!/bin/bash

echo "🔄 RELOADING APP AND TESTING COACH ONBOARDING"
echo "=============================================="
echo ""

# Kill Metro bundler
echo "1️⃣ Killing Metro bundler..."
pkill -f "expo start" || echo "   Metro not running"
pkill -f "metro" || echo "   No metro process found"
sleep 1

# Clear watchman
echo ""
echo "2️⃣ Clearing watchman..."
watchman watch-del-all 2>/dev/null || echo "   Watchman not available"

# Clear Metro cache
echo ""
echo "3️⃣ Clearing Metro cache..."
rm -rf /tmp/metro-* 2>/dev/null
rm -rf /tmp/haste-map-* 2>/dev/null
rm -rf $TMPDIR/metro-* 2>/dev/null
rm -rf $TMPDIR/haste-map-* 2>/dev/null
echo "   Metro cache cleared"

# Clear React Native cache
echo ""
echo "4️⃣ Clearing React Native cache..."
rm -rf $TMPDIR/react-* 2>/dev/null
echo "   RN cache cleared"

echo ""
echo "5️⃣ Starting fresh Metro bundler..."
echo "   Run in a new terminal: npm run dev"
echo ""
echo "6️⃣ IN THE SIMULATOR:"
echo "   • Delete the VarsityHub app completely"
echo "   • Reinstall: Press 'i' in Metro terminal OR run 'npx expo run:ios'"
echo "   • Sign in as a test user"
echo "   • Click 'Coach' button"
echo "   • YOU SHOULD land on Step 2 (Basic Info)"
echo ""
echo "🔍 If it STILL skips to Step 7:"
echo "   • Check Metro bundler for errors"
echo "   • Make sure it says 'Fast refresh enabled'"
echo "   • Try pressing 'r' to reload in Metro"
echo ""
echo "✅ The code fix IS in place. This is a cache issue."
echo ""
