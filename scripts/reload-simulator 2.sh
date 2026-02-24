#!/bin/bash
# Reload/Refresh iOS Simulator
# This script helps reload the app in the simulator

echo "🔄 Reloading Simulator..."
echo ""

# Method 1: Send reload command to Metro (if running)
echo "1️⃣  Attempting to reload via Metro..."
if command -v curl &> /dev/null; then
    # Try to send reload command to Metro bundler
    curl -s http://localhost:8081/reload 2>/dev/null && echo "   ✅ Reload command sent to Metro" || echo "   ⚠️  Metro not responding (might not be running)"
else
    echo "   ⚠️  curl not available, skipping Metro reload"
fi

echo ""
echo "2️⃣  Manual Reload Options:"
echo ""
echo "   Option A: In Simulator"
echo "   - Press Cmd+R to reload"
echo "   - Or: Device → Shake → Reload"
echo ""
echo "   Option B: Restart Dev Server"
echo "   - Run: npm run dev"
echo "   - Or: npx expo start --dev-client --clear"
echo ""
echo "   Option C: Full Rebuild"
echo "   - Run: npm run ios"
echo "   - Or: npx expo run:ios"
echo ""

echo "✅ Reload instructions shown above"
