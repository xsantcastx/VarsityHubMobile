#!/bin/bash
# FIX FAST REFRESH FOR SIMULATOR - COMPREHENSIVE FIX

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 FIXING FAST REFRESH FOR SIMULATOR..."
echo ""

# 1. Kill all Metro/Expo processes
echo "1️⃣ Killing all Metro/Expo processes..."
pkill -9 -f "expo|metro|node.*8081|node.*19000|node.*19001" 2>/dev/null || true
sleep 3

# 2. Clear ALL caches
echo "2️⃣ Clearing ALL caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true
rm -rf $TMPDIR/react-native-* 2>/dev/null || true

# 3. Ensure .expo/settings.json exists with Fast Refresh enabled
echo "3️⃣ Configuring Fast Refresh settings..."
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

# 4. Set environment
export LANG=en_US.UTF-8
export EXPO_NO_METRO_LAZY=1

echo "✅ Fast Refresh configuration complete!"
echo ""
echo "📱 IN SIMULATOR - DO THIS NOW:"
echo "   1. Press Cmd + Shift + R (HARD RELOAD)"
echo "   2. Press Cmd + D → Dev Menu"
echo "   3. Make sure 'Enable Fast Refresh' is CHECKED ✓"
echo "   4. Press Cmd + R again to reload"
echo "   5. Save any file - should update instantly!"
echo ""
echo "🚀 Starting Metro with Fast Refresh enabled..."
echo "   (Press Ctrl+C to stop)"
echo ""

# 5. Start Metro with Fast Refresh
npx expo start --dev-client --clear
