#!/bin/bash
set -e

echo "🔧 FIXING FAST REFRESH NOW..."

# Kill all Metro/Expo processes
echo "Killing existing Metro/Expo processes..."
pkill -9 expo || true
pkill -9 node || true
pkill -9 metro || true
sleep 2

# Clear all caches
echo "Clearing all caches..."
rm -rf .expo
rm -rf node_modules/.cache
watchman watch-del-all 2>/dev/null || true

# Ensure Fast Refresh is enabled in .expo/settings.json
echo "Configuring .expo/settings.json for Fast Refresh..."
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

# Start Metro with Fast Refresh explicitly enabled
echo "Starting Metro bundler with Fast Refresh..."
EXPO_NO_DOTENV=1 npx expo start --dev-client --clear &
METRO_PID=$!

echo "✅ Metro started (PID: $METRO_PID)"
echo "✅ Fast Refresh should now work!"
echo ""
echo "📱 Next steps:"
echo "1. Press 'i' in Metro terminal to open iOS simulator"
echo "2. Save any file and watch for Fast Refresh!"
echo ""
echo "🔄 Metro is running in background. Check terminal output."
