#!/bin/bash
# Fix Hot Reload / Fast Refresh for VarsityHub Mobile
# This ensures Metro is running and simulator is connected

cd /Users/varsityhub/VarsityHubMobile

echo "🔧 Fixing Hot Reload / Fast Refresh..."
echo ""

# 1. Kill any stale processes
echo "🧹 Killing stale Metro/Expo processes..."
pkill -9 -f "expo|metro|node.*8081" 2>/dev/null || true
sleep 2

# 2. Clear Metro cache
echo "🗑️  Clearing Metro cache..."
rm -rf .expo node_modules/.cache 2>/dev/null || true

# 3. Start Metro bundler
echo "🚀 Starting Metro bundler with Fast Refresh..."
export LANG=en_US.UTF-8
npx expo start --dev-client --clear &

# Wait for Metro to start
echo "⏳ Waiting for Metro to start..."
sleep 15

# 4. Check if Metro is running
if lsof -ti:8081 > /dev/null 2>&1; then
    echo "✅ Metro bundler is running on port 8081"
    echo ""
    echo "📱 Next steps:"
    echo "1. In the iOS Simulator, press Cmd + R to reload the app"
    echo "2. Or shake the device → Select 'Reload'"
    echo "3. Make sure Fast Refresh is enabled (should be by default)"
    echo "4. Now when you save files, changes should appear automatically!"
    echo ""
    echo "💡 If changes still don't appear:"
    echo "   - Check Metro terminal for errors"
    echo "   - Press Cmd + R in simulator to manually reload"
    echo "   - Check if simulator is connected to Metro (should show 'Connected' in Metro)"
else
    echo "❌ Metro failed to start. Check the output above for errors."
    exit 1
fi
