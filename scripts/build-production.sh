#!/bin/bash
# Production Build Script for VarsityHub
# This script builds the app for both iOS and Android
# CRITICAL: Runs verification before build to prevent wasted credits

echo "🚀 VarsityHub Production Build Script"
echo "======================================"
echo ""

# Run comprehensive build verification FIRST
echo "🔍 Running pre-build verification..."
if ! bash scripts/verify-build-ready.sh; then
    echo ""
    echo "❌ BUILD BLOCKED: Verification failed!"
    echo "Fix the errors above before building to avoid wasting EAS credits."
    exit 1
fi

echo ""
echo "✅ Verification passed - proceeding with build..."
echo ""

# Skip interactive work in CI environments
if [ -n "$CI" ]; then
    echo "CI environment detected. Skipping EAS build steps (run locally when ready to ship)."
    exit 0
fi

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
echo "  Bundle ID: com.varsityhub.varsityhub"
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
