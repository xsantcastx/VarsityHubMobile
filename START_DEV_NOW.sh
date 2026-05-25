#!/bin/bash
# 🚀 START DEV SERVER FOR REAL-TIME EDITING
# This starts Expo with dev-client and tunnel mode for your physical device

# Use the repo root relative to this script, not a hardcoded path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting VarsityHub Development Server..."
echo "📱 Tunnel mode enabled - works on any network!"
echo ""
echo "⏳ Starting in 3 seconds..."
sleep 3

# Start Expo with dev-client and tunnel
npx expo start --dev-client --tunnel --clear
