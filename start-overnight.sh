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
  echo "3. Status Check"
  echo "   Check if overnight process is running"
  echo ""
  read -p "Enter choice (1-3): " choice
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
    echo "  ./start-overnight.sh 3"
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
    echo "  ./start-overnight.sh 3"
    ;;
    
  3)
    echo ""
    echo "📊 Checking Status..."
    echo ""
    
    # Check for running processes
    if ps aux | grep -E "overnight-(lint|full)" | grep -v grep > /dev/null; then
      echo "✅ Overnight process is RUNNING:"
      ps aux | grep -E "overnight-(lint|full)" | grep -v grep
      echo ""
      
      # Show recent log lines
      if [ -f "overnight-lint.log" ]; then
        echo "Recent progress (overnight-lint.log):"
        tail -20 overnight-lint.log
      elif [ -f "overnight-master.log" ]; then
        echo "Recent progress (overnight-master.log):"
        tail -20 overnight-master.log
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
    echo "Invalid choice. Use 1, 2, or 3"
    exit 1
    ;;
esac

echo ""
echo "---"
echo "To stop the process:"
echo "  pkill -f overnight"
echo ""
