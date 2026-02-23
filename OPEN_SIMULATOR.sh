#!/bin/bash
# Kill everything and open iOS Simulator - ONE COMMAND

cd /Users/varsityhub/VarsityHubMobile

echo "🧹 Killing all Expo/Metro processes..."
lsof -ti:8081,19000,19001 | xargs kill -9 2>/dev/null || true
pkill -9 -f "expo|metro|node.*8081" 2>/dev/null || true
sleep 1

echo "🚀 Opening iOS Simulator..."
npx expo run:ios
