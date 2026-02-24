#!/bin/bash
# Install the latest saved release build to iPhone
# Usage: ./scripts/install-latest.sh

DEVICE_ID="00008120-000A19E81A33401E"
cd "$(dirname "$0")/.."

# Find the latest build
LATEST_BUILD_DIR=$(ls -td builds/*.app 2>/dev/null | head -1)

if [ -z "$LATEST_BUILD_DIR" ]; then
  echo "No saved builds found. Run ./scripts/build-release.sh first."
  exit 1
fi

echo "Installing: $LATEST_BUILD_DIR"
xcrun devicectl device install app --device "$DEVICE_ID" "$LATEST_BUILD_DIR"

echo "Launching app..."
xcrun devicectl device process launch --device "$DEVICE_ID" com.varsithub.varsityhub

echo "Done!"
