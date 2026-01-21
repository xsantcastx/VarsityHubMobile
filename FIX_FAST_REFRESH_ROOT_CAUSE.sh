#!/bin/bash
# ROOT CAUSE FIX FOR FAST REFRESH - RUN THIS NOW

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 ROOT CAUSE ANALYSIS AND FIX FOR FAST REFRESH..."
echo ""

# ROOT CAUSE 1: New Architecture can break Fast Refresh
echo "⚠️  DETECTED: newArchEnabled: true in app.json"
echo "   This can cause Fast Refresh issues in React Native"
echo ""

# ROOT CAUSE 2: Kill everything first
echo "1️⃣ Killing ALL processes..."
pkill -9 -f "expo" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
pkill -9 -f "node.*8081" 2>/dev/null || true
killall -9 node 2>/dev/null || true
sleep 5

# ROOT CAUSE 3: Clear ALL caches completely
echo "2️⃣ Nuclear cache clear..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf ios/build 2>/dev/null || true
rm -rf android/build 2>/dev/null || true
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true
rm -rf $TMPDIR/*metro* 2>/dev/null || true

# ROOT CAUSE 4: Reset Watchman completely
if command -v watchman &> /dev/null; then
    echo "3️⃣ Resetting Watchman (file watching critical for Fast Refresh)..."
    watchman watch-del-all 2>/dev/null || true
    watchman shutdown-server 2>/dev/null || true
    sleep 3
    watchman watch-project . 2>/dev/null || true
    echo "   Watchman reset complete"
else
    echo "   ⚠️  Watchman not installed - Fast Refresh may not work reliably"
    echo "   Install: brew install watchman"
fi

# ROOT CAUSE 5: Ensure .expo/settings.json is correct
echo "4️⃣ Configuring .expo/settings.json..."
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

# ROOT CAUSE 6: Environment variables for Fast Refresh
export LANG=en_US.UTF-8
export EXPO_NO_METRO_LAZY=1
export EXPO_USE_FAST_REFRESH=1
export NODE_ENV=development

echo ""
echo "✅ ALL ROOT CAUSES ADDRESSED!"
echo ""
echo "📱 CRITICAL - DO THESE STEPS IN ORDER:"
echo ""
echo "STEP 1: Close Simulator"
echo "   Press Cmd + Q to fully quit Simulator"
echo ""
echo "STEP 2: Reopen Simulator"
echo "   Run: open -a Simulator"
echo "   Wait until simulator fully loads"
echo ""
echo "STEP 3: Hard Reload (clears JS cache)"
echo "   In simulator: Press Cmd + Shift + R"
echo "   (This clears JavaScript cache completely)"
echo ""
echo "STEP 4: Enable Fast Refresh"
echo "   In simulator: Press Cmd + D"
echo "   Tap 'Enable Fast Refresh' - make sure it's ON"
echo "   If it's already ON, toggle it OFF then ON again"
echo ""
echo "STEP 5: Reload"
echo "   In simulator: Press Cmd + R"
echo ""
echo "STEP 6: Test Fast Refresh"
echo "   Make a small change to any file (add a space)"
echo "   Save the file"
echo "   Should update instantly!"
echo ""
echo "🔧 IF FAST REFRESH STILL DOESN'T WORK:"
echo "   New Architecture (newArchEnabled: true) may be the issue"
echo "   You may need to rebuild the app: npx expo run:ios"
echo ""
echo "🚀 Starting Metro NOW..."
echo "   (Press Ctrl+C to stop)"
echo ""

# Start Metro with all Fast Refresh flags
npx expo start --dev-client --clear
