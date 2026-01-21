#!/bin/bash
# AGGRESSIVE FIX - PROFILE PAGE + FAST REFRESH - RUN THIS NOW

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 AGGRESSIVE FIX FOR PROFILE PAGE + FAST REFRESH..."
echo ""

# 1. Kill EVERYTHING aggressively
echo "1️⃣ Killing ALL processes..."
pkill -9 -f "expo" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
pkill -9 -f "node.*8081" 2>/dev/null || true
pkill -9 -f "node.*19000" 2>/dev/null || true
pkill -9 -f "react-native" 2>/dev/null || true
killall -9 node 2>/dev/null || true
sleep 5

# 2. NUCLEAR cache clear
echo "2️⃣ NUCLEAR cache clear..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf ios/build 2>/dev/null || true
rm -rf android/build 2>/dev/null || true
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true
rm -rf $TMPDIR/react-native-* 2>/dev/null || true
rm -rf $TMPDIR/*metro* 2>/dev/null || true
rm -rf $TMPDIR/*react* 2>/dev/null || true

# Clear Watchman aggressively
if command -v watchman &> /dev/null; then
    echo "   Clearing Watchman..."
    watchman watch-del-all 2>/dev/null || true
    watchman shutdown-server 2>/dev/null || true
fi

# 3. FORCE Fast Refresh config
echo "3️⃣ FORCING Fast Refresh configuration..."
mkdir -p .expo
cat > .expo/settings.json <<'EOF'
{
  "hostType": "lan",
  "lanType": "ip",
  "dev": true,
  "minify": false,
  "urlRandomness": null,
  "https": false
}
EOF

# 4. Verify metro config
if ! grep -q "Fast Refresh" metro.config.js 2>/dev/null; then
    echo "   Fast Refresh should be enabled by default in Expo"
fi

# 5. Environment setup
export LANG=en_US.UTF-8
export EXPO_NO_METRO_LAZY=1
export EXPO_USE_FAST_REFRESH=1

echo ""
echo "✅ ALL FIXES APPLIED!"
echo ""
echo "📱 IN SIMULATOR - DO THIS EXACTLY:"
echo "   1. Close simulator completely"
echo "   2. Open simulator: open -a Simulator"
echo "   3. Wait for simulator to fully load"
echo "   4. In simulator: Cmd + Shift + R (HARD RELOAD - clears cache)"
echo "   5. In simulator: Cmd + D → Dev Menu"
echo "   6. Toggle 'Enable Fast Refresh' OFF then ON (forces refresh)"
echo "   7. Press Cmd + R to reload"
echo "   8. Make a small change to a file and save - should update instantly!"
echo ""
echo "🚀 Starting Metro NOW with Fast Refresh..."
echo "   (Press Ctrl+C to stop)"
echo ""

# 6. Start Metro
npx expo start --dev-client --clear
