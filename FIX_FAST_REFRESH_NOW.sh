#!/bin/bash
# IMMEDIATE FIX FOR FAST REFRESH - RUN THIS NOW

cd /Users/varsityhub/VarsityHubMobile

echo "🚨 FIXING FAST REFRESH RIGHT NOW..."
echo ""

# Kill everything
pkill -9 -f "expo|metro|node.*8081" 2>/dev/null || true
sleep 2

# Clear ALL caches
rm -rf .expo node_modules/.cache 2>/dev/null || true

# Start Metro in foreground so you can see it
export LANG=en_US.UTF-8
echo "✅ Starting Metro bundler with Fast Refresh..."
echo "📱 After Metro starts, in the simulator:"
echo "   1. Press Cmd + R to reload"
echo "   2. Press Cmd + D → Enable Fast Refresh"
echo "   3. Save a file and watch it update!"
echo ""
npx expo start --dev-client --clear
