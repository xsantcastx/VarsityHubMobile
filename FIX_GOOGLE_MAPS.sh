#!/bin/bash

# Fix Google Maps iOS Configuration
# This script ensures Google Maps is properly configured for iOS

set -e

echo "🔧 Fixing Google Maps iOS Configuration..."

# Step 1: Verify API key is in app.json
echo "✅ Checking app.json configuration..."
if grep -q "googleMapsApiKey" app.json; then
  echo "   ✓ Google Maps API key found in app.json"
else
  echo "   ✗ ERROR: Google Maps API key not found in app.json"
  exit 1
fi

# Step 2: Clean and regenerate native projects
echo ""
echo "🧹 Cleaning iOS build artifacts..."
cd ios
rm -rf Pods Podfile.lock build
cd ..

# Step 3: Run prebuild to regenerate native code with plugins
echo ""
echo "🔨 Running expo prebuild to regenerate native code..."
npx expo prebuild --platform ios --clean

# Step 4: Install pods
echo ""
echo "📦 Installing CocoaPods dependencies..."
cd ios
pod install
cd ..

echo ""
echo "✅ Google Maps configuration complete!"
echo ""
echo "Next steps:"
echo "1. Run: npx expo run:ios"
echo "2. The map should now work with Google Maps provider"
echo ""
echo "Note: If you still see the error, try:"
echo "   - Restart Metro: npx expo start --dev-client --clear"
echo "   - Rebuild: npx expo run:ios"
