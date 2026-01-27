#!/bin/bash
# Quick fix for codegen build errors

echo "🧹 Cleaning build artifacts..."
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/VarsityHub-*

echo "📦 Reinstalling pods..."
cd ios
export LANG=en_US.UTF-8
pod install
cd ..

echo "🚀 Building with clean cache..."
export LANG=en_US.UTF-8
npx expo run:ios --no-build-cache
