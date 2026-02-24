#!/bin/bash
# Overnight Error Log Analysis
# Analyzes Sentry error logs and categorizes issues

echo "🔍 Starting overnight error log analysis..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

# Check if Sentry DSN is configured
SENTRY_DSN="${EXPO_PUBLIC_SENTRY_DSN:-}"
API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:4000}"

echo ""
echo "================================================="
echo "Phase 1: Error Log Collection"
echo "================================================="
{
    echo "📊 Analyzing error patterns..."
    
    # Check for Sentry configuration
    if [ -z "$SENTRY_DSN" ]; then
        echo "⚠️  Sentry DSN not configured (EXPO_PUBLIC_SENTRY_DSN)"
        echo "   Skipping Sentry error analysis"
    else
        echo "✅ Sentry DSN configured"
        echo "   Note: Sentry API access required for full analysis"
        echo "   Manual analysis recommended via Sentry dashboard"
    fi
    
    # Check for local error logs
    if [ -d "logs" ]; then
        echo ""
        echo "🔍 Checking local error logs..."
        ERROR_COUNT=$(find logs -name "*.log" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "   Found $ERROR_COUNT log files"
        
        if [ "$ERROR_COUNT" -gt 0 ]; then
            echo ""
            echo "📋 Recent error patterns:"
            grep -r "error\|Error\|ERROR" logs/ 2>/dev/null | tail -50 | head -20 || echo "   No error patterns found"
        fi
    else
        echo "⚠️  Logs directory not found"
    fi
    
    # Check server logs if available
    if [ -d "server/logs" ]; then
        echo ""
        echo "🔍 Checking server error logs..."
        SERVER_ERRORS=$(find server/logs -name "*.log" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "   Found $SERVER_ERRORS server log files"
    fi
    
} 2>&1 | tee "$LOG_DIR/1-collection.log"

# 2. Categorize errors
echo ""
echo "================================================="
echo "Phase 2: Error Categorization"
echo "================================================="
{
    echo "📊 Categorizing error types..."
    
    # Check for common error patterns in codebase
    if [ -d "app" ]; then
        echo ""
        echo "🔍 Analyzing codebase for error patterns..."
        
        # Count catch blocks without error handling
        EMPTY_CATCHES=$(grep -r "catch.*{" app/ server/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -c "catch" || echo "0")
        echo "   Catch blocks found: $EMPTY_CATCHES"
        
        # Count console.error statements (error logging)
        CONSOLE_ERRORS=$(grep -r "console.error" app/ server/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
        echo "   console.error calls: $CONSOLE_ERRORS"
        
        # Check for error boundary usage
        ERROR_BOUNDARIES=$(grep -r "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" app/ --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
        echo "   Error boundaries: $ERROR_BOUNDARIES"
    fi
    
} 2>&1 | tee "$LOG_DIR/2-categorization.log"

# 3. API error endpoint check
echo ""
echo "================================================="
echo "Phase 3: API Error Endpoints"
echo "================================================="
{
    echo "🔍 Checking API error handling..."
    
    # Try to check health endpoint for errors
    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        echo "✅ API health endpoint responding"
        
        # Check for error endpoint (if exists)
        if curl -s -f "$API_URL/api/errors/recent" > /dev/null 2>&1; then
            echo "✅ Error endpoint available"
            curl -s "$API_URL/api/errors/recent" | head -20
        else
            echo "⚠️  Error endpoint not available"
        fi
    else
        echo "⚠️  API not accessible (backend may not be running)"
    fi
    
} 2>&1 | tee "$LOG_DIR/3-api.log"

# 4. Generate error report
echo ""
echo "================================================="
echo "Phase 4: Error Report Generation"
echo "================================================="
{
    echo "📊 Generating error analysis report..."
    
    REPORT_FILE="$LOG_DIR/error-analysis-report.txt"
    
    cat > "$REPORT_FILE" << EOF
╔═══════════════════════════════════════════════════════════╗
║  ERROR LOG ANALYSIS REPORT                                ║
╚═══════════════════════════════════════════════════════════╝

Generated: $(date)

SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sentry Configuration:
  • DSN Configured: $([ -n "$SENTRY_DSN" ] && echo "Yes" || echo "No")
  • Manual Analysis: Sentry Dashboard recommended

Local Logs:
  • Log Files Found: $ERROR_COUNT
  • Server Log Files: $SERVER_ERRORS

Codebase Analysis:
  • Catch Blocks: $EMPTY_CATCHES
  • Console Errors: $CONSOLE_ERRORS
  • Error Boundaries: $ERROR_BOUNDARIES

RECOMMENDATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review Sentry Dashboard for production errors
2. Check local log files for development errors
3. Ensure all catch blocks handle errors appropriately
4. Consider adding error boundaries to critical components
5. Monitor API error endpoints regularly

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review Sentry dashboard: https://sentry.io/
2. Check detailed logs in: $LOG_DIR/
3. Fix high-frequency errors first
4. Add error boundaries where missing
5. Improve error handling in catch blocks

EOF

    cat "$REPORT_FILE"
    echo ""
    echo "📄 Full report saved to: $REPORT_FILE"
    
} 2>&1 | tee "$LOG_DIR/4-report.log"

echo ""
echo "================================================="
echo "Error Log Analysis Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Report: $LOG_DIR/error-analysis-report.txt"
echo "Completed: $(date)"
