#!/bin/bash
# Build Development Client - Run this script
cd /Users/varsityhub/VarsityHubMobile

echo "🔨 Building Development Client..."
echo ""
echo "Choose platform:"
echo "1) iOS (iPhone/iPad)"
echo "2) Android"
echo ""
read -p "Enter 1 or 2: " choice

if [ "$choice" = "1" ]; then
  echo "Building for iOS..."
  eas build --profile development --platform ios
elif [ "$choice" = "2" ]; then
  echo "Building for Android..."
  eas build --profile development --platform android
else
  echo "Invalid choice. Run script again."
  exit 1
fi
