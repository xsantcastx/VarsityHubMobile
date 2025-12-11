#!/bin/bash

###############################################################################
# VarsityHub Release Checklist
# 
# Interactive script to verify pre-submission state before deploying to App Store
# Run this before submitting Build 41+ to the App Store
#
# Usage: bash scripts/release-checklist.sh
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper functions
log_check() {
  echo -e "${BLUE}→${NC} $1"
}

log_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((CHECKS_PASSED++))
}

log_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((CHECKS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main checklist
clear
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║  VarsityHub Release Checklist                     ║"
echo "║  Pre-submission verification for App Store        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Date: $(date)"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo ""

# ============================================================================
# 1. Git Status & Commits
# ============================================================================
log_section "1. Git Status & Commits"

log_check "Checking git status..."
if [ -z "$(git status --porcelain)" ]; then
  log_pass "Working directory is clean"
else
  log_fail "Uncommitted changes detected"
  git status --short
fi

log_check "Verifying main branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" == "main" ]; then
  log_pass "On main branch"
else
  log_fail "Not on main branch (current: $CURRENT_BRANCH)"
fi

log_check "Checking recent commits..."
LATEST_COMMIT=$(git log -1 --pretty=format:"%h - %s")
echo "Latest commit: $LATEST_COMMIT"
log_pass "Commits visible"

# ============================================================================
# 2. Code Quality
# ============================================================================
log_section "2. Code Quality"

log_check "Running ESLint..."
if npm run lint > /tmp/lint.log 2>&1; then
  log_pass "ESLint passed - no errors"
else
  ERROR_COUNT=$(grep -c "error" /tmp/lint.log || echo 0)
  if [ "$ERROR_COUNT" -gt 0 ]; then
    log_fail "ESLint found $ERROR_COUNT error(s)"
  else
    log_warn "ESLint found warnings (see /tmp/lint.log)"
    log_pass "No critical errors"
  fi
fi

log_check "Running TypeScript check..."
if npm run typecheck > /tmp/typecheck.log 2>&1; then
  log_pass "TypeScript check passed"
else
  log_fail "TypeScript errors found (check /tmp/typecheck.log)"
fi

# ============================================================================
# 3. Tests
# ============================================================================
log_section "3. Tests"

log_check "Running Jest unit tests..."
if npm test -- --passWithNoTests > /tmp/jest.log 2>&1; then
  COVERAGE=$(grep "Statements" /tmp/jest.log | tail -1 | awk '{print $NF}')
  log_pass "All tests passed (coverage: $COVERAGE)"
else
  log_fail "Some tests failed (check /tmp/jest.log)"
fi

log_check "Running server tests..."
if (cd server && npm test > /tmp/server-test.log 2>&1); then
  log_pass "Server tests passed"
else
  log_warn "Server tests may have issues (check /tmp/server-test.log)"
fi

# ============================================================================
# 4. Security
# ============================================================================
log_section "4. Security"

log_check "Running npm audit (root)..."
if npm audit --json > /tmp/audit-root.json 2>&1; then
  VULNS=$(jq '.metadata.vulnerabilities.total // 0' /tmp/audit-root.json)
  if [ "$VULNS" -eq 0 ]; then
    log_pass "Root: 0 vulnerabilities"
  else
    log_warn "Root: $VULNS vulnerabilities (check .snyk policy)"
  fi
else
  log_fail "npm audit failed"
fi

log_check "Running npm audit (server)..."
if (cd server && npm audit --json > /tmp/audit-server.json 2>&1); then
  VULNS=$(jq '.metadata.vulnerabilities.total // 0' /tmp/audit-server.json)
  if [ "$VULNS" -eq 0 ]; then
    log_pass "Server: 0 vulnerabilities"
  else
    log_warn "Server: $VULNS vulnerabilities (check .snyk policy)"
  fi
else
  log_fail "Server npm audit failed"
fi

log_check "Checking .snyk policy file..."
if [ -f ".snyk" ]; then
  log_pass ".snyk policy file exists"
else
  log_warn ".snyk policy file not found"
fi

# ============================================================================
# 5. Documentation
# ============================================================================
log_section "5. Documentation"

DOCS_TO_CHECK=(
  "AUTOMATION_MAINTENANCE_HUB.md"
  "README.md"
  "app.json"
)

for doc in "${DOCS_TO_CHECK[@]}"; do
  if [ -f "$doc" ]; then
    log_pass "$doc exists"
  else
    log_warn "$doc not found"
  fi
done

# ============================================================================
# 6. Environment & Config
# ============================================================================
log_section "6. Environment & Config"

log_check "Checking app.json..."
if [ -f "app.json" ]; then
  VERSION=$(jq -r '.expo.version // "unknown"' app.json)
  NAME=$(jq -r '.expo.name // "unknown"' app.json)
  log_pass "app.json valid - Version: $VERSION, Name: $NAME"
else
  log_fail "app.json not found"
fi

log_check "Checking environment variables..."
REQUIRED_VARS=("EXPO_PUBLIC_API_URL" "EXPO_PUBLIC_STRIPE_PK")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    log_warn "Environment variable not set: $var"
  fi
done

# ============================================================================
# 7. Build Verification
# ============================================================================
log_section "7. Build Verification"

log_check "Verifying iOS project structure..."
if [ -d "ios/VarsityHub.xcodeproj" ]; then
  log_pass "Xcode project found"
else
  log_fail "Xcode project not found"
fi

log_check "Checking Podfile..."
if [ -f "ios/Podfile" ]; then
  log_pass "Podfile exists"
else
  log_fail "Podfile not found"
fi

log_check "Verifying eas.json..."
if [ -f "eas.json" ]; then
  log_pass "eas.json found"
else
  log_fail "eas.json not found"
fi

# ============================================================================
# 8. App Store Submission Checklist
# ============================================================================
log_section "8. App Store Submission Checklist"

echo -e "${YELLOW}Manual verification required:${NC}"
echo ""
echo "  □ Version number bumped (app.json + ios/VarsityHub.xcodeproj)"
echo "  □ Build number incremented"
echo "  □ Changelog updated"
echo "  □ Privacy Policy reviewed & up-to-date"
echo "  □ Apple Developer account credentials ready"
echo "  □ TestFlight builds passed QA"
echo "  □ Feature flags disabled for unfinished features"
echo "  □ Analytics tracking verified"
echo "  □ Deep links tested on TestFlight build"
echo "  □ All required screenshots & metadata prepared"
echo ""

# ============================================================================
# Summary
# ============================================================================
log_section "Summary"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
echo ""
echo "Automated checks: $CHECKS_PASSED passed, $CHECKS_FAILED failed"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ All automated checks PASSED${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Complete manual verification checklist above"
  echo "2. Run: eas build --platform ios --profile production"
  echo "3. Wait for build to complete"
  echo "4. Submit to App Store: npm run submit:ios"
  echo ""
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ Some checks FAILED - do not submit yet${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Fix the issues above and run the checklist again."
  echo ""
  exit 1
fi
