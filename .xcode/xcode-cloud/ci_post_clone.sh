#!/bin/sh

# Xcode Cloud post-clone script
set -e

echo "🚀 Starting Xcode Cloud post-clone setup..."

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm ci

# Install CocoaPods dependencies
echo "🍫 Installing CocoaPods..."
cd ios
pod install
cd ..

# Run prebuild to generate native files
echo "🔨 Running Expo prebuild..."
npx expo prebuild --platform ios --clean

echo "✅ Xcode Cloud setup complete!"
