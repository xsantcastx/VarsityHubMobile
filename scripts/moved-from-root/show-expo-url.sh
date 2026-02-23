#!/bin/bash
# This script will try to get Expo URL after starting
echo "Starting Expo in background..."
cd /Users/varsityhub/VarsityHubMobile
npx expo start --dev-client --tunnel > /tmp/expo.log 2>&1 &
EXPO_PID=$!
sleep 12
echo ""
echo "=== EXPO OUTPUT (last 50 lines) ==="
tail -50 /tmp/expo.log 2>/dev/null || echo "Log not found"
echo ""
echo "=== Check your terminal for QR code ==="
echo "Or run: npx expo start --dev-client --tunnel"
