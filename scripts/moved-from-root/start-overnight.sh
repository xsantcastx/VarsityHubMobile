#!/bin/bash
# Quick launcher for overnight automation
# Usage: ./start-overnight.sh [option]

echo "🌙 VarsityHub Overnight Automation"
echo "=================================="
echo ""

if [ -z "$1" ]; then
  echo "Select an option:"
  echo ""
  echo "1. Lint Cleanup Only (2-3 hrs) - SAFEST, HIGHEST IMPACT"
  echo "   Fixes all lint errors, commits progress every 5 files"
  echo ""
  echo "2. Full Pipeline (4-6 hrs) - MAXIMUM PROGRESS"
  echo "   Lint + Backend + Quality + Docs"
  echo ""
  echo "3. Security Scan (30-60 mins) - NEW"
  echo "   Snyk scan + Secret scanning + Dependency audit"
  echo ""
  echo "4. Test Suite Run (1-2 hrs) - NEW"
  echo "   TypeScript + Unit tests + E2E smoke tests"
  echo ""
  echo "5. Database Health Check (15-30 mins) - NEW"
  echo "   Connection check + Migration status + Statistics"
  echo ""
  echo "6. API Validation (15-30 mins) - NEW"
  echo "   Health checks + Endpoint tests + Webhook validation"
  echo ""
  echo "7. Dependency Updates (1-2 hrs) - NEW"
  echo "   Check outdated packages + Security audit"
  echo ""
  echo "8. Error Log Analysis (30-45 mins) - NEW"
  echo "   Analyze Sentry errors + Categorize issues"
  echo ""
  echo "9. Stripe Reconciliation (15-30 mins) - NEW"
  echo "   Verify payments match database + Webhook check"
  echo ""
  echo "10. Status Check"
  echo "    Check if overnight process is running"
  echo ""
  read -p "Enter choice (1-10): " choice
else
  choice=$1
fi

case $choice in
  1)
    echo ""
    echo "🚀 Starting Lint Cleanup (Option 1)"
    echo "This will run for 2-3 hours in the background"
    echo ""
    nohup ./scripts/overnight-lint-cleanup.sh > overnight-lint.log 2>&1 &
    PID=$!
    echo "✅ Started! Process ID: $PID"
    echo "📋 Log file: overnight-lint.log"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f overnight-lint.log"
    echo ""
    echo "Check status:"
    echo "  ./start-overnight.sh 7"
    ;;
    
  2)
    echo ""
    echo "🚀 Starting Full Pipeline (Option 2)"
    echo "This will run for 4-6 hours in the background"
    echo ""
    nohup ./scripts/overnight-full-pipeline.sh > overnight-master.log 2>&1 &
    PID=$!
    echo "✅ Started! Process ID: $PID"
    echo "📋 Log file: overnight-master.log"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f overnight-master.log"
    echo ""
    echo "Check status:"
    echo "  ./start-overnight.sh 7"
    ;;
    
  3)
    echo ""
    echo "🔒 Starting Security Scan (Option 3)"
    echo "This will run for 30-60 minutes in the background"
    echo ""
    nohup ./scripts/overnight-security-scan.sh > overnight-security.log 2>&1 &
    PID=$!
    echo "✅ Started! Process ID: $PID"
    echo "📋 Log file: overnight-security.log"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f overnight-security.log"
    echo ""
    echo "Check status:"
    echo "  ./start-overnight.sh 7"
    ;;
    
  4)
    echo ""
    echo "🧪 Starting Test Suite Run (Option 4)"
    echo "This will run for 1-2 hours in the background"
    echo ""
    nohup ./scripts/overnight-test-run.sh > overnight-tests.log 2>&1 &
    PID=$!
    echo "✅ Started! Process ID: $PID"
    echo "📋 Log file: overnight-tests.log"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f overnight-tests.log"
    echo ""
    echo "Check status:"
    echo "  ./start-overnight.sh 7"
    ;;
    
  5)
    echo ""
    echo "🗄️  Starting Database Health Check (Option 5)"
    echo "This will run for 15-30 minutes in the background"
    echo ""
    nohup ./scripts/overnight-db-health.sh > overnight-db.log 2>&1 &
    PID=$!
    echo "✅ Started! Process ID: $PID"
    echo "📋 Log file: overnight-db.log"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f overnight-db.log"
    echo ""
    echo "Check status:"
    echo "  ./start-overnight.sh 7"
    ;;
    
  6)
    echo ""
    echo "🔌 Starting API Validation (Option 6)"
    echo "This will run for 15-30 minutes in the background"
    echo ""
    nohup ./scripts/overnight-api-validation.sh > overnight-api.log 2>&1 &
    PID=$!
    echo "✅ Started! Process ID: $PID"
    echo "📋 Log file: overnight-api.log"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f overnight-api.log"
    echo ""
    echo "Check status:"
    echo "  ./start-overnight.sh 7"
    ;;
    
  7)
    echo ""
    echo "📊 Checking Status..."
    echo ""
    
    # Check for running processes
    if ps aux | grep -E "overnight-(lint|full|security|test|db|api|deps|errors|stripe)" | grep -v grep > /dev/null; then
      echo "✅ Overnight process is RUNNING:"
      ps aux | grep -E "overnight-(lint|full|security|test|db|api|deps|errors|stripe)" | grep -v grep
      echo ""
      
      # Show recent log lines
      if [ -f "overnight-lint.log" ]; then
        echo "Recent progress (overnight-lint.log):"
        tail -20 overnight-lint.log
      elif [ -f "overnight-master.log" ]; then
        echo "Recent progress (overnight-master.log):"
        tail -20 overnight-master.log
      elif [ -f "overnight-deps.log" ]; then
        echo "Recent progress (overnight-deps.log):"
        tail -20 overnight-deps.log
      elif [ -f "overnight-errors.log" ]; then
        echo "Recent progress (overnight-errors.log):"
        tail -20 overnight-errors.log
      elif [ -f "overnight-stripe.log" ]; then
        echo "Recent progress (overnight-stripe.log):"
        tail -20 overnight-stripe.log
      fi
    else
      echo "⏸️  No overnight process currently running"
      echo ""
      
      # Check for completion
      if [ -f "overnight-results.txt" ]; then
        echo "📊 Last run results:"
        cat overnight-results.txt
      fi
      
      if [ -d "overnight-logs-"* ]; then
        LATEST_LOG=$(ls -td overnight-logs-* 2>/dev/null | head -1)
        if [ -f "$LATEST_LOG/SUMMARY.txt" ]; then
          echo ""
          echo "📋 Latest summary:"
          cat "$LATEST_LOG/SUMMARY.txt"
        fi
      fi
    fi
    ;;
    
  *)
    echo "Invalid choice. Use 1-10"
    exit 1
    ;;
esac

echo ""
echo "---"
echo "To stop the process:"
echo "  pkill -f overnight"
echo ""
