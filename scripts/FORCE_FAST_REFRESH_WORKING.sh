#!/bin/bash
set -e

echo "🔧 FORCING FAST REFRESH TO WORK - SDK 54 WORKAROUND"
echo "===================================================="
echo ""

# Kill all processes
echo "1️⃣  Killing all Metro/Expo/Node processes..."
pkill -9 expo || true
pkill -9 node || true
pkill -9 metro || true
sleep 2

# Check for version mismatches
echo ""
echo "2️⃣  Checking for version mismatches..."
npx expo-doctor 2>&1 | grep -i "warning\|error\|mismatch" || echo "✅ No obvious version mismatches"

# Install/check dependencies
echo ""
echo "3️⃣  Ensuring react-native-worklets is installed..."
npx expo install react-native-worklets --check 2>&1 | tail -3

# Clear ALL caches aggressively
echo ""
echo "4️⃣  Clearing ALL caches (aggressive)..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/@expo*
watchman watch-del-all 2>/dev/null || true
watchman shutdown-server 2>/dev/null || true

# Clear iOS build cache
echo "Clearing iOS build cache..."
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/Podfile.lock

# Ensure Fast Refresh settings
echo ""
echo "5️⃣  Configuring Fast Refresh settings..."
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

echo ""
echo "✅ Setup complete!"
echo ""
echo "📱 NEXT STEPS:"
echo ""
echo "1. Rebuild dev client (REQUIRED after config changes):"
echo "   npx expo run:ios"
echo ""
echo "2. Start Metro with aggressive cache clearing:"
echo "   npx expo start --dev-client --clear"
echo ""
echo "3. In simulator dev menu (Cmd+D):"
echo "   - Toggle 'Enable Fast Refresh' OFF then ON"
echo "   - This forces React Refresh runtime to reinitialize"
echo ""
echo "4. Test Fast Refresh:"
echo "   - Navigate to Profile page"
echo "   - Edit app/profile.tsx line 111"
echo "   - Change fastRefreshTest value and save"
echo "   - Watch for automatic update"
echo ""
echo "💡 If still not working, this is likely the SDK 54 bug."
echo "   Use Cmd+R for manual reload as workaround."
echo ""
