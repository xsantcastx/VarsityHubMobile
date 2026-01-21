#!/bin/bash
set -e

echo "🔍 VERIFYING FAST REFRESH SETUP"
echo "================================="
echo ""

echo "1️⃣  Checking Metro is running..."
if lsof -i :8081 > /dev/null 2>&1; then
    echo "✅ Metro is running on port 8081"
else
    echo "❌ Metro is NOT running on port 8081"
    echo "   Start Metro: npx expo start --dev-client"
fi

echo ""
echo "2️⃣  Checking critical configs..."
echo ""

# Check EXPO_PUBLIC_NODE_ENV
NODE_ENV=$(grep -A 1 "EXPO_PUBLIC_NODE_ENV" app.json | grep -o '"[^"]*"' | head -1 | tr -d '"')
if [ "$NODE_ENV" = "development" ]; then
    echo "✅ EXPO_PUBLIC_NODE_ENV is 'development'"
else
    echo "❌ EXPO_PUBLIC_NODE_ENV is '$NODE_ENV' (should be 'development')"
fi

# Check newArchEnabled
NEW_ARCH=$(grep "newArchEnabled" app.json | grep -o 'true\|false')
if [ "$NEW_ARCH" = "false" ]; then
    echo "✅ newArchEnabled is false"
else
    echo "❌ newArchEnabled is $NEW_ARCH (should be false)"
fi

# Check Babel config
if grep -q "react-native-reanimated/plugin" babel.config.js; then
    echo "❌ react-native-reanimated/plugin found in babel.config.js (should be removed)"
else
    echo "✅ react-native-reanimated/plugin NOT in babel.config.js (correct)"
fi

# Check entry point
MAIN=$(grep '"main"' package.json | grep -o '"[^"]*"' | head -1 | tr -d '"')
if [ "$MAIN" = "expo-router/entry" ]; then
    echo "✅ Entry point is 'expo-router/entry'"
else
    echo "❌ Entry point is '$MAIN' (should be 'expo-router/entry')"
fi

echo ""
echo "3️⃣  Fast Refresh Test Instructions:"
echo ""
echo "📱 In Simulator:"
echo "   1. Press Cmd+D to open dev menu"
echo "   2. Verify 'Enable Fast Refresh' is ON"
echo "   3. Navigate to Profile page"
echo "   4. Look for gray text 'FAST_REFRESH_TEST_v2'"
echo ""
echo "📝 Then edit app/profile.tsx line 111:"
echo "   Change: const fastRefreshTest = 'FAST_REFRESH_TEST_v2';"
echo "   To:     const fastRefreshTest = 'FAST_REFRESH_TEST_v3_WORKING!';"
echo "   Save the file"
echo ""
echo "👀 Watch simulator - text should update automatically within 1-2 seconds"
echo ""
echo "⚠️  If text doesn't update:"
echo "   - Check Metro terminal for errors"
echo "   - Try Cmd+Shift+R in simulator (hard reload)"
echo "   - Verify Fast Refresh is enabled in dev menu"
echo ""
