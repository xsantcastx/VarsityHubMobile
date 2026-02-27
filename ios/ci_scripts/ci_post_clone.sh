#!/bin/bash
set -e
echo "Running ci_post_clone.sh for VarsityHub (Expo)"

# ci_scripts lives in ios/; repo root is two levels up
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Fix CocoaPods UTF-8 encoding (required for Ruby 3.4+)
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Install Node.js and CocoaPods if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  brew install node
fi
if ! command -v pod &> /dev/null; then
  echo "Installing CocoaPods..."
  brew install cocoapods
fi

# Install npm dependencies
echo "Running npm install..."
npm ci || npm install

# Xcode Cloud sets CI=TRUE which breaks Expo's GetEnv - workaround
export CI="true"

# Install iOS pods
echo "Running pod install..."
cd ios
pod install
cd ..

echo "ci_post_clone.sh completed successfully"
