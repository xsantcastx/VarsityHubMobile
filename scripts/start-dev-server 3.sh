#!/bin/bash

# Development Server Startup Script
# This script starts the Metro bundler for local development with fast refresh
# Use this when you want to run the app from Xcode with real-time updates

set -e

echo "🚀 Starting VarsityHub Development Server..."
echo ""

# Get the local IP address for network debugging
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
echo "📍 Local IP: $LOCAL_IP"
echo ""

# Check if port 8081 is already in use
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8081 is already in use. Attempting to kill existing process..."
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Clear Metro cache for fresh start
echo "🧹 Clearing Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true

echo ""
echo "✅ Starting Metro bundler with dev client support..."
echo "📱 Your app in Xcode will connect to this server automatically"
echo "🔄 Fast Refresh is enabled - changes will appear instantly!"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start Metro with dev client, localhost, and fast refresh
exec npx expo start --dev-client --scheme varsityhubmobile --host localhost --port 8081 --clear
