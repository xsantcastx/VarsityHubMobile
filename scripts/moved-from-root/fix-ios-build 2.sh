#!/bin/bash
# Fix iOS build linker error - Missing RCTPackagerConnection
# This cleans and reinstalls CocoaPods dependencies

set -e

cd /Users/varsityhub/VarsityHubMobile

echo "🧹 Cleaning iOS build artifacts..."

# Clean pods
cd ios
rm -rf Pods
rm -f Podfile.lock

# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/VarsityHub-*

echo "📦 Reinstalling CocoaPods..."
pod install --repo-update

echo "✅ Pods reinstalled successfully!"
echo ""
echo "🔄 Now rebuilding with clean cache..."
cd ..

# Clean Expo cache and rebuild
npx expo run:ios --clean

echo ""
echo "✅ Build should now succeed!"