#!/bin/bash
# Overnight Strength & Organization Tasks
# Runs all code quality, performance, and organization tasks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUMMARY_FILE="$RESULTS_DIR/strength-organization-summary-$TIMESTAMP.txt"

mkdir -p "$RESULTS_DIR"

echo "🌙 Starting Overnight Strength & Organization Tasks..."
echo "Started: $(date)"
echo ""

cd "$PROJECT_ROOT"

# Track results
TASKS_RUN=0
TASKS_SUCCESS=0
TASKS_FAILED=0

run_task() {
  local task_name="$1"
  local script_path="$2"
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Task: $task_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  TASKS_RUN=$((TASKS_RUN + 1))
  
  if [ -f "$script_path" ]; then
    if bash "$script_path" 2>&1; then
      echo "✅ $task_name completed successfully"
      TASKS_SUCCESS=$((TASKS_SUCCESS + 1))
      return 0
    else
      echo "❌ $task_name failed"
      TASKS_FAILED=$((TASKS_FAILED + 1))
      return 1
    fi
  else
    echo "⚠️  Script not found: $script_path"
    return 1
  fi
}

# Phase 1: Code Organization
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 1: Code Organization & Cleanup"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

run_task "Unused Imports Cleanup" "scripts/overnight-unused-imports.sh"
run_task "Console.log Audit" "scripts/overnight-console-cleanup.sh"

# Phase 2: Performance
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 2: Performance Analysis"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

run_task "Database Query Performance" "scripts/overnight-db-performance.sh"

# Phase 3: Code Quality
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: Code Quality & Maintainability"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

run_task "Floating Promises Analysis" "scripts/overnight-floating-promises.sh"

# Generate summary
cat > "$SUMMARY_FILE" <<EOF
════════════════════════════════════════════════════════════════════════════════
OVERNIGHT STRENGTH & ORGANIZATION TASKS - SUMMARY
════════════════════════════════════════════════════════════════════════════════

Completed: $(date)
Duration: ~$(($TASKS_RUN * 2)) minutes

RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks Run:    $TASKS_RUN
✅ Successful: $TASKS_SUCCESS
❌ Failed:     $TASKS_FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK REVIEW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Unused Imports:
   $(ls -t $RESULTS_DIR/unused-imports-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".summary.totalUnused" 2>/dev/null || echo "N/A"') unused imports found
   Priority files: $(ls -t $RESULTS_DIR/unused-imports-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".priorityFiles | length" 2>/dev/null || echo "N/A")

2. Console Statements:
   $(ls -t $RESULTS_DIR/console-audit-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".summary.totalConsoleStatements" 2>/dev/null || echo "N/A") total console statements
   Files with 10+: $(ls -t $RESULTS_DIR/console-audit-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".priorityFiles | length" 2>/dev/null || echo "N/A")

3. Database Performance:
   N+1 queries: $(ls -t $RESULTS_DIR/db-performance-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".summary.nPlusOne" 2>/dev/null || echo "N/A")
   Missing indexes: $(ls -t $RESULTS_DIR/db-performance-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".summary.missingIndexes" 2>/dev/null || echo "N/A")

4. Floating Promises:
   Total: $(ls -t $RESULTS_DIR/floating-promises-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".summary.total" 2>/dev/null || echo "N/A")
   Safe auto-fixes: $(ls -t $RESULTS_DIR/floating-promises-*.json 2>/dev/null | head -1 | xargs -I {} sh -c 'cat {} | jq -r ".summary.routerNavigation" 2>/dev/null || echo "N/A")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review unused imports report and remove unused imports from priority files
2. Clean up console.log statements (remove or wrap in __DEV__)
3. Fix N+1 queries and add missing database indexes
4. Fix floating promises (start with router navigation - safe auto-fix)

Full reports available in: $RESULTS_DIR/

EOF

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "✅ Overnight Strength & Organization Tasks Complete!"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
cat "$SUMMARY_FILE"
echo ""
echo "📄 Full summary: $SUMMARY_FILE"
echo "📁 All reports: $RESULTS_DIR/"
