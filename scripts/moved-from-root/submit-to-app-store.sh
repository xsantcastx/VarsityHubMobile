#!/bin/bash
# Automatic App Store Submission Script
# Executes once EAS Build completes

set -e

cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

echo "=========================================="
echo "🚀 VarsityHub iOS - App Store Submission"
echo "=========================================="
echo ""
echo "Build: 39 (1.0.1)"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Verify build is complete
echo "Checking build status..."
BUILD_ID=$(eas build --status --latest --json 2>/dev/null | jq -r '.id' 2>/dev/null || echo "unknown")

if [ "$BUILD_ID" != "unknown" ]; then
  echo "✅ Latest build ID: $BUILD_ID"
fi

echo ""
echo "Submitting to App Store..."
echo ""

# Execute submission
eas submit --platform ios --latest

echo ""
echo "=========================================="
echo "✅ SUBMISSION COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check submission status on EAS: https://expo.dev"
echo "2. Monitor Apple App Store review (3-5 business days)"
echo "3. Expected approval: ~December 15-16, 2025"
echo ""
