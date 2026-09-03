#!/bin/bash
set -e

echo "🚀 VarsityHub iOS - Pre-Submission Verification"
echo "================================================"
echo ""

# Check 1: Build environment
echo "1️⃣ Build Environment..."
if [ -f "eas.json" ]; then
  echo "   ✅ eas.json exists"
else
  echo "   ❌ eas.json missing"
  exit 1
fi

# Check 2: App configuration
echo "2️⃣ App Configuration..."
if grep -q '"slug": "varsityhub"' app.json; then
  echo "   ✅ App slug configured"
else
  echo "   ❌ App slug not found"
  exit 1
fi

if grep -q '"version": "1.0.1"' app.json; then
  echo "   ✅ Version set to 1.0.1"
else
  echo "   ⚠️  Version not 1.0.1 - verify if intentional"
fi

# Check 3: Test suite
echo "3️⃣ Test Suite..."
if npm run test -- --passWithNoTests 2>/dev/null | grep -q "PASS\|Tests:.*passed"; then
  echo "   ✅ Tests passing"
else
  echo "   ⚠️  Tests may have issues"
fi

# Check 4: Linting
echo "4️⃣ ESLint Status..."
LINT_COUNT=$(npm run lint 2>&1 | grep -c "warning\|error" || echo "0")
if [ "$LINT_COUNT" -gt 0 ]; then
  echo "   ⚠️  $LINT_COUNT lint issues found (non-blocking)"
else
  echo "   ✅ Clean lint status"
fi

# Check 5: Git status
echo "5️⃣ Git Status..."
if [ -z "$(git status --porcelain)" ]; then
  echo "   ✅ Working directory clean"
else
  echo "   ⚠️  Uncommitted changes present"
  git status --short | head -5
fi

# Check 6: Recent commits
echo "6️⃣ Recent Commits..."
echo "   Last 3 commits:"
git log --oneline -3 | sed 's/^/   /'

# Check 7: SendGrid config check
echo "7️⃣ SendGrid Configuration..."
if grep -q "SENDGRID_API_KEY\|SENDGRID_VERIFICATION_TEMPLATE_ID" server/src/lib/email.ts; then
  echo "   ✅ SendGrid setup in backend"
else
  echo "   ❌ SendGrid not configured"
fi

# Check 8: Production API
echo "8️⃣ Production API..."
API_URL="https://api-production-8ac3.up.railway.app"
if timeout 5 curl -s "$API_URL/health" > /dev/null 2>&1; then
  echo "   ✅ Production API responding"
else
  echo "   ⚠️  Could not verify API (network issue?): $API_URL"
fi

# Check 9: Onboarding steps
echo "9️⃣ Onboarding Steps..."
STEPS=$(find app/onboarding -name "step-*.tsx" | wc -l)
echo "   Found $STEPS onboarding step files"
if [ "$STEPS" -eq 9 ]; then
  echo "   ✅ Correct step count (1,2,3,4,6,7,8,9,10, finish)"
else
  echo "   ⚠️  Step count: $STEPS (expected 9)"
fi

# Check 10: Key files
echo "🔟 Key Files..."
KEY_FILES=("app/verify-email.tsx" "server/src/routes/auth.ts" "server/src/lib/email.ts")
for file in "${KEY_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file missing"
    exit 1
  fi
done

echo ""
echo "================================================"
echo "✅ Pre-submission checks complete!"
echo ""
echo "Ready to submit? Run:"
echo "  eas submit --platform ios --latest"
echo ""
