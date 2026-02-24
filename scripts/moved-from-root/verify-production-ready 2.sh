#!/bin/bash
# VarsityHub Pre-Launch Verification Script

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create report file and tee output to both stdout and file
LOG_FILE=verification-report.txt
exec > >(tee "$LOG_FILE") 2>&1

echo "================================"
echo "VarsityHub Pre-Launch Verification"
echo "================================"
echo ""

PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASSED++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAILED++)); }

# 1. TypeScript
echo "1️⃣  TypeScript Compilation"
if npm run typecheck -- --noEmit > /dev/null 2>&1; then
  pass "TypeScript compiles without errors"
else
  fail "TypeScript compilation errors found"
fi

# 2. Docker files
echo ""
echo "2️⃣  Docker Configuration"
[ -f "server/Dockerfile" ] && pass "Dockerfile exists" || fail "Dockerfile missing"
[ -f "start.sh" ] && pass "start.sh exists" || fail "start.sh missing"
[ -f "server/docker-compose.yml.prod" ] && pass "Production docker-compose exists" || fail "docker-compose.yml.prod missing"

# 3. Documentation
echo ""
echo "3️⃣  Documentation"
[ -f ".docs/guides/DOCKER_DEPLOYMENT.md" ] && pass "Docker deployment guide exists" || fail "DOCKER_DEPLOYMENT.md missing"
[ -f ".docs/checklists/QA_CHECKLIST.md" ] && pass "QA checklist exists" || fail "QA_CHECKLIST.md missing"
[ -f ".docs/AUDIT_SUMMARY.md" ] && pass "Audit summary exists" || fail "AUDIT_SUMMARY.md missing"

# 4. Configuration
echo ""
echo "4️⃣  Configuration"
grep -q "DATABASE_URL" .docs/guides/DOCKER_DEPLOYMENT.md && pass "Environment vars documented" || fail "Env vars not documented"
grep -q "HEALTHCHECK" server/Dockerfile && pass "Docker healthcheck configured" || fail "Healthcheck missing"

# 5. Error handling
echo ""
echo "5️⃣  Error Handling"
[ -f "utils/sentry.ts" ] && [ -f "components/ErrorBoundary.tsx" ] && \
  pass "Sentry + ErrorBoundary implemented" || \
  fail "Error handling not configured"

# 6. Prisma
echo ""
echo "6️⃣  Database Setup"
[ -f "server/prisma/schema.prisma" ] && pass "Prisma schema exists" || fail "Prisma schema missing"

# Summary
echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "${GREEN}Passed:${NC} $PASSED"
[ $FAILED -gt 0 ] && echo -e "${RED}Failed:${NC} $FAILED" || echo -e "${RED}Failed:${NC} 0"
echo ""

[ $FAILED -eq 0 ] && echo -e "${GREEN}✓ Ready for production!${NC}" && exit 0
echo -e "${RED}✗ Please fix issues above before deploying.${NC}" && exit 1
