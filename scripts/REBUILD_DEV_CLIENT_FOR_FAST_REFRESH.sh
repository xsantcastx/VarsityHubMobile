#!/bin/bash
set -e

echo "🔨 REBUILDING DEV CLIENT FOR FAST REFRESH (SDK 54 FIX)..."
echo ""
echo "⚠️  IMPORTANT: SDK 54 has known Fast Refresh issues."
echo "    After config changes, you MUST rebuild the dev client!"
echo ""

# Kill all processes
echo "Killing existing processes..."
pkill -9 expo || true
pkill -9 node || true
pkill -9 metro || true
sleep 2

# Clear ALL caches
echo "Clearing all caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
watchman watch-del-all 2>/dev/null || true

# Clear iOS build
echo "Clearing iOS build..."
rm -rf ios/build

echo ""
echo "✅ Caches cleared!"
echo ""
echo "📱 NOW REBUILD THE DEV CLIENT:"
echo "   npx expo run:ios"
echo ""
echo "💡 This rebuild is REQUIRED for Fast Refresh to work with SDK 54"
echo "   after configuration changes (babel.config.js, metro.config.js, app.json)"
echo ""
echo "⏳ After rebuild completes, start Metro with:"
echo "   npx expo start --dev-client --clear"
echo ""
