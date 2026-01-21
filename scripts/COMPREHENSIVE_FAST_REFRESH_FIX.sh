#!/bin/bash
set -e

echo "🔧 COMPREHENSIVE FAST REFRESH FIX FOR SDK 54"
echo "============================================"
echo ""

# Kill all processes
echo "1️⃣  Killing all Metro/Expo/Node processes..."
pkill -9 expo || true
pkill -9 node || true
pkill -9 metro || true
sleep 2

# Clear ALL caches
echo ""
echo "2️⃣  Clearing ALL caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
rm -rf $TMPDIR/react-*
watchman watch-del-all 2>/dev/null || true

# Clear iOS build cache
echo "Clearing iOS build cache..."
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/Podfile.lock

# Clear Watchman
echo "Clearing Watchman..."
watchman shutdown-server 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true

# Ensure Fast Refresh settings
echo ""
echo "3️⃣  Configuring Fast Refresh settings..."
mkdir -p .expo
cat > .expo/settings.json <<EOF
{
  "hostType": "lan",
  "lanType": "ip",
  "dev": true,
  "minify": false,
  "urlRandomness": null,
  "https": false
}
EOF

# Verify critical configurations
echo ""
echo "4️⃣  Verifying critical configurations..."
echo ""
echo "✅ EXPO_PUBLIC_NODE_ENV should be 'development':"
grep -A 1 "EXPO_PUBLIC_NODE_ENV" app.json || echo "❌ NOT FOUND"

echo ""
echo "✅ newArchEnabled should be false:"
grep "newArchEnabled" app.json || echo "❌ NOT FOUND"

echo ""
echo "✅ react-native-reanimated/plugin should NOT be in babel.config.js:"
if grep -q "react-native-reanimated/plugin" babel.config.js; then
  echo "❌ FOUND - This should be removed!"
else
  echo "✅ Not found (correct)"
fi

echo ""
echo "5️⃣  Verification complete!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "📱 1. REBUILD THE DEV CLIENT (REQUIRED):"
echo "    npx expo run:ios"
echo ""
echo "📱 2. Once build completes, start Metro:"
echo "    npx expo start --dev-client --clear"
echo ""
echo "📱 3. In simulator dev menu (Cmd+D):"
echo "    - Verify 'Enable Fast Refresh' is ON"
echo "    - If it's off, toggle it ON"
echo ""
echo "📱 4. Test Fast Refresh:"
echo "    - Navigate to Profile page"
echo "    - Edit app/profile.tsx (change fastRefreshTest value)"
echo "    - Save file"
echo "    - Watch simulator - should update automatically"
echo ""
echo "💡 NOTE: SDK 54 has known Fast Refresh issues that may cause"
echo "   full app remounts. If you see the app reset to home screen"
echo "   instead of updating in place, this is a known SDK 54 bug."
echo ""
