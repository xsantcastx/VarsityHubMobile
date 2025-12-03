#!/bin/bash
# VarsityHub - Full Overnight Pipeline
# Runs all automated tasks: lint + backend + build + docs

set -e  # Exit on error
trap 'echo "❌ Pipeline failed at $(date)" | tee failure.log' ERR

echo "🌙🚀 Starting FULL overnight pipeline..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

echo "📁 Log directory: $LOG_DIR"

# Phase 1: Lint cleanup (2-3 hours)
echo ""
echo "================================================="
echo "Phase 1: Lint Cleanup (estimated 2-3 hours)"
echo "================================================="
if [ -f "scripts/overnight-lint-cleanup.sh" ]; then
  bash scripts/overnight-lint-cleanup.sh 2>&1 | tee "$LOG_DIR/1-lint.log"
else
  echo "⚠️  Lint script not found, skipping..." | tee "$LOG_DIR/1-lint.log"
fi

# Phase 2: Backend setup and verification (30 mins)
echo ""
echo "================================================="
echo "Phase 2: Backend Verification"
echo "================================================="
{
  # Check if backend is running
  if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
  else
    echo "⚠️  Backend not running, attempting to start..."
    npm run server:dev &
    sleep 10
  fi
  
  # Seed database if needed
  if [ -f "server/package.json" ]; then
    cd server
    if grep -q "\"seed\"" package.json; then
      echo "📦 Seeding database..."
      npm run seed 2>&1 || echo "Seed failed or already complete"
    fi
    cd ..
  fi
} 2>&1 | tee "$LOG_DIR/2-backend.log"

# Phase 3: TypeCheck and quality gates (15 mins)
echo ""
echo "================================================="
echo "Phase 3: Quality Verification"
echo "================================================="
{
  echo "🔍 Running TypeScript check..."
  npm run typecheck 2>&1
  
  echo "🔍 Running Expo doctor..."
  npm run doctor 2>&1 || true
  
  echo "🔍 Checking for critical errors..."
  npm run lint:strict 2>&1 | head -100
} 2>&1 | tee "$LOG_DIR/3-quality.log"

# Phase 4: Documentation generation (30 mins)
echo ""
echo "================================================="
echo "Phase 4: Documentation"
echo "================================================="
{
  mkdir -p docs
  
  echo "📚 Cataloging components..."
  find components -name "*.tsx" -type f 2>/dev/null | sort > docs/COMPONENTS.md || echo "No components found"
  find app -name "*.tsx" -type f | sort > docs/SCREENS.md
  
  echo "📦 Analyzing dependencies..."
  npm list --depth=0 > docs/DEPENDENCIES.txt 2>&1 || true
  npm outdated > docs/OUTDATED.txt 2>&1 || true
  
  echo "📈 Git statistics..."
  git log --oneline --since="1 month ago" > docs/RECENT_COMMITS.txt
  git shortlog -sn --all > docs/CONTRIBUTORS.txt
  
  echo "✅ Documentation generated in docs/"
} 2>&1 | tee "$LOG_DIR/4-docs.log"

# Phase 5: Generate summary
echo ""
echo "================================================="
echo "Phase 5: Generating Summary"
echo "================================================="

SUMMARY_FILE="$LOG_DIR/SUMMARY.txt"

{
  echo "🎉 VarsityHub Overnight Pipeline Complete!"
  echo "==========================================="
  echo ""
  echo "Started:  $(head -2 $LOG_DIR/1-lint.log | tail -1)"
  echo "Finished: $(date)"
  echo ""
  echo "Phase Results:"
  echo "-------------"
  echo "1. Lint Cleanup:"
  echo "   - Fixed: $(grep -c '✅ Fixed:' $LOG_DIR/1-lint.log 2>/dev/null || echo 0) files"
  echo "   - Failed: $(grep -c '❌ Failed:' $LOG_DIR/1-lint.log 2>/dev/null || echo 0) files"
  echo ""
  echo "2. Backend:"
  echo "   - Status: $(grep -o 'Backend.*running' $LOG_DIR/2-backend.log 2>/dev/null || echo 'Check log')"
  echo ""
  echo "3. Quality Gates:"
  echo "   - TypeCheck: $(grep -c 'error' $LOG_DIR/3-quality.log 2>/dev/null || echo 0) errors"
  echo "   - Lint Issues: $(grep -o '[0-9]* problems' $LOG_DIR/3-quality.log | head -1 || echo 'Check log')"
  echo ""
  echo "4. Documentation:"
  echo "   - Generated: $(wc -l < docs/SCREENS.md 2>/dev/null || echo 0) screens cataloged"
  echo ""
  echo "Detailed Logs:"
  echo "-------------"
  echo "- Lint:    $LOG_DIR/1-lint.log"
  echo "- Backend: $LOG_DIR/2-backend.log"
  echo "- Quality: $LOG_DIR/3-quality.log"
  echo "- Docs:    $LOG_DIR/4-docs.log"
  echo ""
  echo "Next Steps:"
  echo "----------"
  echo "1. Review this summary"
  echo "2. Check git log for commits"
  echo "3. Run: npm run typecheck"
  echo "4. Test app: npx expo start --clear"
  echo "5. Continue with Day 2 checklist"
  echo ""
} | tee "$SUMMARY_FILE"

# Commit everything
echo "💾 Committing all changes..."
git add .
git commit -m "Overnight pipeline complete ($(date +%Y-%m-%d))" 2>&1 || echo "Nothing new to commit"

# Display summary
cat "$SUMMARY_FILE"

# Success notification (macOS)
if command -v osascript &> /dev/null; then
  osascript -e 'display notification "Pipeline complete! Check summary." with title "VarsityHub Overnight"' 2>/dev/null || true
fi

echo ""
echo "✨ All done! Check $SUMMARY_FILE for details."
echo "✨ Master log: overnight-master.log"
