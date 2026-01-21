#!/bin/bash
set -e

echo "🔄 RESTARTING METRO WITH FAST REFRESH FIX..."

# Kill all Metro/Expo processes
echo "Killing existing processes..."
pkill -9 expo || true
pkill -9 node || true
pkill -9 metro || true
sleep 2

# Clear ALL caches
echo "Clearing caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
watchman watch-del-all 2>/dev/null || true

# Ensure Fast Refresh settings
echo "Configuring Fast Refresh..."
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

# Start Metro with Fast Refresh
echo ""
echo "✅ Starting Metro with Fast Refresh enabled..."
echo "📱 Press 'i' to open iOS simulator"
echo "💡 Make sure Fast Refresh is enabled in simulator dev menu (Cmd+D → Enable Fast Refresh)"
echo ""
npx expo start --dev-client --clear
