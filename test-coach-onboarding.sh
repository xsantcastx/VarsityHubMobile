#!/bin/bash

# Coach Onboarding End-to-End Test Script
# This script helps verify that coach onboarding works correctly

echo "=========================================="
echo "Coach Onboarding Test Script"
echo "=========================================="
echo ""
echo "This script will help you test the coach onboarding flow."
echo "Make sure the app is running in the simulator first."
echo ""
echo "Steps to test:"
echo "1. Sign up with a new email (or use an account with onboarding_completed not set)"
echo "2. Verify email"
echo "3. Follow the onboarding flow:"
echo "   - Step 1: Select 'Coach / Organizer'"
echo "   - Step 2: Enter basic info (username, DOB, zip)"
echo "   - Step 3: Select plan (Rookie/Veteran/Legend)"
echo "   - Step 4: Create organization"
echo "   - Step 6: Add authorized users (or skip)"
echo "   - Step 7: Create profile"
echo "   - Step 8: Select interests"
echo "   - Step 9: Configure features"
echo "   - Step 10: Complete onboarding"
echo ""
echo "Checking for common issues..."
echo ""

# Check if Metro is running
if ! curl -s http://localhost:8081/status > /dev/null 2>&1; then
    echo "⚠️  Metro bundler doesn't appear to be running on port 8081"
    echo "   Start it with: npm start"
    echo ""
fi

# Check TypeScript errors in onboarding files
echo "Checking TypeScript errors in onboarding files..."
npx tsc --noEmit --skipLibCheck app/onboarding/*.tsx 2>&1 | grep -E "(error|warning)" | head -20

echo ""
echo "=========================================="
echo "Test Checklist:"
echo "=========================================="
echo ""
echo "□ Step 1: Can select 'Coach / Organizer' and continue"
echo "□ Step 2: Can enter username, DOB, zip and continue"
echo "□ Step 3: Can select a plan and continue"
echo "□ Step 4: Can create organization and continue"
echo "□ Step 6: Can add users (or skip) and continue"
echo "□ Step 7: Can create profile and continue"
echo "□ Step 8: Can select interests and continue"
echo "□ Step 9: Can configure features and continue"
echo "□ Step 10: Can complete onboarding and reach main app"
echo ""
echo "Common Issues to Check:"
echo "□ No redirects to main app before completing all steps"
echo "□ Progress persists when going back and forward"
echo "□ All data saves correctly to server"
echo "□ No crashes or errors in console"
echo ""
echo "To check logs, run:"
echo "  npx react-native log-ios  # for iOS"
echo "  npx react-native log-android  # for Android"
echo ""
echo "=========================================="
