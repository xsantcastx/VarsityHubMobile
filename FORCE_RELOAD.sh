#!/bin/bash
# FORCE SIMULATOR TO RELOAD AND CONNECT TO METRO FOR FAST REFRESH
# This ensures your changes appear immediately

cd /Users/varsityhub/VarsityHubMobile

echo "🔥 FORCING FAST REFRESH TO WORK..."
echo ""

# 1. Make sure Metro is running
echo "🔍 Checking Metro..."
if ! lsof -ti:8081 > /dev/null 2>&1; then
    echo "⚠️  Metro not running! Starting it now..."
    export LANG=en_US.UTF-8
    npx expo start --dev-client --clear > /tmp/metro.log 2>&1 &
    sleep 5
    echo "✅ Metro started"
else
    echo "✅ Metro is already running"
fi

# 2. Force simulator to reload the app
echo ""
echo "📱 Forcing simulator reload..."
xcrun simctl launch booted com.xsantcastx.varsityhub 2>/dev/null || echo "App not installed, that's okay"

# 3. Open simulator if not open
echo "🖥️  Opening simulator..."
open -a Simulator 2>/dev/null

echo ""
echo "✅ DONE! Now follow these steps:"
echo ""
echo "1. In the iOS Simulator:"
echo "   - Press Cmd + R to reload"
echo "   - OR shake device → Select 'Reload'"
echo ""
echo "2. Enable Fast Refresh:"
echo "   - Press Cmd + D in simulator"
echo "   - Make sure 'Fast Refresh' is ENABLED"
echo ""
echo "3. Test it:"
echo "   - Save a file (like app/profile.tsx)"
echo "   - Watch it update automatically in 1-2 seconds!"
echo ""
echo "💡 If still not working:"
echo "   - Check Metro terminal for 'Fast Refresh' messages"
echo "   - Make sure simulator shows 'Connected to Metro'"
echo "   - Try Cmd + R again in simulator"
