#!/bin/bash
# Production Build Script for VarsityHub
# This script builds the app for both iOS and Android

echo "🚀 VarsityHub Production Build Script"
echo "======================================"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null
then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
fi

# Login to EAS (if not already logged in)
echo "📝 Checking EAS login status..."
eas whoami || eas login

echo ""
echo "🔍 Current configuration:"
echo "  App: VarsityHub"
echo "  Version: $(grep '"version"' app.json | head -1 | cut -d'"' -f4)"
echo "  Bundle ID: com.xsantcastx.varsityhub"
echo ""

# Ask which platform to build
echo "Select build platform:"
echo "  1) iOS only"
echo "  2) Android only"
echo "  3) Both iOS and Android"
read -p "Enter choice (1-3): " platform_choice

case $platform_choice in
    1)
        echo ""
        echo "📱 Building for iOS..."
        eas build --platform ios --profile production
        ;;
    2)
        echo ""
        echo "🤖 Building for Android..."
        eas build --platform android --profile production
        ;;
    3)
        echo ""
        echo "📱🤖 Building for both platforms..."
        eas build --platform all --profile production
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Build process completed!"
echo "📊 Check build status at: https://expo.dev/accounts/xsantcastx/projects/VarsityHubMobile/builds"
