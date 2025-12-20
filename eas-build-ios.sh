#!/usr/bin/env zsh
# EAS iOS Production Build Runbook
# Location: /Users/varsityhub/Desktop/CODE/VarsityHubMobile/eas-build-ios.sh
# Run this locally after setting Apple credentials

set -euo pipefail

REPO_ROOT="/Users/varsityhub/Desktop/CODE/VarsityHubMobile"
TEAM_ID="B5H8F69RW5"

echo "🍎 VarsityHub iOS Production Build"
echo "=================================="
echo ""

# Check prerequisites
if ! command -v eas >/dev/null 2>&1; then
  echo "❌ EAS CLI not found. Install: npm install -g eas-cli"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found"
  exit 1
fi

cd "$REPO_ROOT"

echo "✓ Repository: $REPO_ROOT"
echo "✓ Team ID: $TEAM_ID"
echo ""

# Verify Apple credentials are set
if [ -z "${EXPO_APPLE_ID:-}" ]; then
  echo "⚠️  EXPO_APPLE_ID not set"
  echo "   Set it: export EXPO_APPLE_ID='your-apple-id@email.com'"
  exit 1
fi

if [ -z "${EXPO_APPLE_PASSWORD:-}" ]; then
  echo "⚠️  EXPO_APPLE_PASSWORD not set"
  echo "   Set it: export EXPO_APPLE_PASSWORD='xxxx-xxxx-xxxx-xxxx'"
  exit 1
fi

echo "✓ Apple credentials detected"
echo ""

# Optional: run pre-build checks
echo "📋 Pre-build checks:"
echo ""

# TypeScript check
echo -n "  TypeScript... "
if npm run typecheck >/dev/null 2>&1; then
  echo "✓"
else
  echo "⚠️ (non-blocking)"
fi

# Git status
echo -n "  Git status... "
if git diff --quiet && git diff --cached --quiet; then
  echo "✓ (clean)"
else
  echo "⚠️ (uncommitted changes)"
fi

echo ""
echo "🚀 Starting EAS build..."
echo ""

# Run the build
eas build \
  --platform ios \
  --profile production \
  --non-interactive

echo ""
echo "✅ Build submitted to EAS!"
echo ""
echo "📱 Next steps:"
echo "  1. Monitor at: https://expo.dev/accounts/lime_prod/projects/varsityhub/builds"
echo "  2. Once complete, download IPA or submit to TestFlight via Expo dashboard"
echo "  3. Share build link for QA testing"
