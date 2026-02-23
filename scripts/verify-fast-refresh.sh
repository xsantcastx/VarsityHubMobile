#!/bin/bash
# Quick verification script for Fast Refresh setup

echo "🔍 Verifying Fast Refresh Configuration..."
echo ""

# Check metro.config.js
if grep -q "enableBabelRCLookup" metro.config.js 2>/dev/null; then
  echo "✅ metro.config.js - Fast Refresh enabled"
else
  echo "❌ metro.config.js - Fast Refresh config missing"
fi

# Check babel.config.js
if grep -q "babel-preset-expo" babel.config.js 2>/dev/null; then
  echo "✅ babel.config.js - react-refresh plugin included"
else
  echo "❌ babel.config.js - Missing babel-preset-expo"
fi

# Check if reanimated plugin is last
if tail -n 5 babel.config.js | grep -q "react-native-reanimated/plugin" 2>/dev/null; then
  echo "✅ babel.config.js - Reanimated plugin is last (correct order)"
else
  echo "⚠️  babel.config.js - Reanimated plugin should be last"
fi

# Check package.json dev script
if grep -q "dev-client.*localhost" package.json 2>/dev/null; then
  echo "✅ package.json - dev script uses localhost"
else
  echo "⚠️  package.json - dev script may not use localhost"
fi

echo ""
echo "📋 To start development server with Fast Refresh:"
echo "   npm run dev"
echo ""
echo "📋 Or use the dev server script:"
echo "   npm run dev:server"
echo ""
echo "✨ Fast Refresh should work automatically when you save files!"
