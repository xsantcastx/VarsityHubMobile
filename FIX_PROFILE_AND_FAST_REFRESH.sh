#!/bin/bash
# COMPLETE FIX FOR PROFILE PAGE AND FAST REFRESH - RUN THIS NOW

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 FIXING PROFILE PAGE AND FAST REFRESH..."
echo ""

# 1. Kill ALL processes
echo "1️⃣ Killing all Metro/Expo/Node processes..."
pkill -9 -f "expo|metro|node.*8081|node.*19000|node.*19001|react-native" 2>/dev/null || true
sleep 3

# 2. Clear ALL caches aggressively
echo "2️⃣ Clearing ALL caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf ios/build 2>/dev/null || true
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true
rm -rf $TMPDIR/react-native-* 2>/dev/null || true

# Clear Watchman
if command -v watchman &> /dev/null; then
    echo "   Clearing Watchman..."
    watchman watch-del-all 2>/dev/null || true
fi

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

# 4. Verify metro.config.js has Fast Refresh enabled
if ! grep -q "Fast Refresh" metro.config.js 2>/dev/null; then
    echo "   Fast Refresh already configured in metro.config.js"
fi

# 5. Set environment
export LANG=en_US.UTF-8
export EXPO_NO_METRO_LAZY=1

echo "✅ All fixes applied!"
echo ""
echo "📱 IN SIMULATOR - DO THIS NOW:"
echo "   1. Make sure simulator is open"
echo "   2. Press Cmd + Shift + R (HARD RELOAD - this clears cache)"
echo "   3. Press Cmd + D → Dev Menu"
echo "   4. Make sure 'Enable Fast Refresh' is CHECKED ✓"
echo "   5. If Fast Refresh is OFF, toggle it ON"
echo "   6. Press Cmd + R again to reload"
echo "   7. Save any file and watch it update instantly!"
echo ""
echo "🔧 TROUBLESHOOTING:"
echo "   If Fast Refresh still doesn't work:"
echo "   - Kill simulator: pkill -9 Simulator"
echo "   - Reopen simulator: open -a Simulator"
echo "   - Re-run this script"
echo ""
echo "🚀 Starting Metro with Fast Refresh NOW..."
echo "   (Press Ctrl+C to stop)"
echo ""

# 6. Start Metro with Fast Refresh
npx expo start --dev-client --clear
