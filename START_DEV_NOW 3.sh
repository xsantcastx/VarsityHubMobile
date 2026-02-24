#!/bin/bash
# 🚀 START DEV SERVER FOR REAL-TIME EDITING
# This starts Expo with dev-client and tunnel mode for your physical device

cd /Users/varsityhub/VarsityHubMobile

echo "🚀 Starting Expo Development Server..."
echo "📱 Tunnel mode enabled - works on any network!"
echo ""
echo "⏳ Starting in 3 seconds..."
sleep 3

# Start Expo with dev-client and tunnel
npx expo start --dev-client --tunnel --clear
