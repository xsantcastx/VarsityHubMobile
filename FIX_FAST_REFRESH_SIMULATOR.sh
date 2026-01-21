#!/bin/bash
# COMPREHENSIVE FAST REFRESH FIX FOR SIMULATOR

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 FIXING FAST REFRESH FOR SIMULATOR..."
echo ""

# Kill all Metro/Expo processes
echo "1️⃣ Killing all Metro/Expo processes..."
pkill -9 -f "expo|metro|node.*8081|node.*19000|node.*19001" 2>/dev/null || true
sleep 2

# Clear all caches
echo "2️⃣ Clearing all caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/haste-map-*

# Ensure .expo/settings.json exists with correct settings
echo "3️⃣ Configuring Expo settings..."
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

echo "✅ Expo settings configured"
echo ""

# Set environment for UTF-8
export LANG=en_US.UTF-8

echo "4️⃣ Starting Metro bundler with Fast Refresh enabled..."
echo ""
echo "📱 IN SIMULATOR:"
echo "   1. Press Cmd + R to reload app"
echo "   2. Press Cmd + D → Toggle 'Enable Fast Refresh' (should be ON)"
echo "   3. Make a small change and save - should update instantly!"
echo ""
echo "🚀 Starting Metro now..."
echo ""

# Start Metro with clear cache and dev client
npx expo start --dev-client --clear
