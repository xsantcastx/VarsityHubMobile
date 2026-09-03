#!/bin/bash

# SwiftLint Quick Reference Script
# Run this to check Swift code quality in your iOS project

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$PROJECT_DIR/ios"

echo "🔍 Running SwiftLint on iOS project..."
echo "   Directory: $IOS_DIR"
echo ""

# Check if swiftlint is installed
if ! command -v swiftlint &> /dev/null; then
    echo "❌ SwiftLint not found. Install with: brew install swiftlint"
    exit 1
fi

echo "📋 SwiftLint Version: $(swiftlint version)"
echo ""

# Run lint with config
echo "Running lint check..."
swiftlint lint --config "$IOS_DIR/.swiftlint.yml" "$IOS_DIR"

echo ""
echo "✅ Lint check complete!"
echo ""
echo "📚 Common Commands:"
echo "   # Lint all files"
echo "   swiftlint lint $IOS_DIR/"
echo ""
echo "   # Auto-fix violations"
echo "   swiftlint lint --fix $IOS_DIR/"
echo ""
echo "   # Lint specific file"
echo "   swiftlint lint $IOS_DIR/VarsityHub/AppDelegate.swift"
echo ""
echo "   # Show rules"
echo "   swiftlint rules"
echo ""
