#!/bin/bash
# FORCE RELOAD SIMULATOR WITH FAST REFRESH

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 FORCING SIMULATOR RELOAD WITH FAST REFRESH..."
echo ""

# Kill all Metro/Expo processes
echo "1️⃣ Killing Metro bundler..."
pkill -9 -f "expo|metro|node.*8081" 2>/dev/null || true
sleep 2

# Clear Metro cache
echo "2️⃣ Clearing Metro cache..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true

# Ensure .expo/settings.json exists
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

echo "3️⃣ Ensuring Fast Refresh is enabled..."
echo "✅ Configuration complete!"
echo ""
echo "📱 IN SIMULATOR:"
echo "   1. Press Cmd + R (or Cmd + Shift + R for hard reload)"
echo "   2. Press Cmd + D → Make sure 'Enable Fast Refresh' is checked"
echo "   3. Save any file and watch it update instantly!"
echo ""
echo "🚀 Starting Metro with Fast Refresh..."
echo ""

export LANG=en_US.UTF-8
npx expo start --dev-client --clear
