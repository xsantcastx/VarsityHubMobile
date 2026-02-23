#!/bin/bash
# Check for errors during web testing session

echo "🔍 VarsityHub Web Testing - Error Report"
echo "========================================"
echo ""

# Check if web app is running
if ! curl -s http://localhost:8081 > /dev/null 2>&1; then
  echo "❌ Web app is NOT running at http://localhost:8081"
  echo ""
  echo "Start it with: npm run web"
  exit 1
fi

echo "✅ Web app is running at http://localhost:8081"
echo ""

# Check bundler output for errors
if [ -f "web-bundler-output.log" ]; then
  ERROR_COUNT=$(grep -c "ERROR\|Error\|error" web-bundler-output.log 2>/dev/null || echo "0")
  WARN_COUNT=$(grep -c "WARN\|Warning\|warning" web-bundler-output.log 2>/dev/null || echo "0")
  
  echo "📊 Bundler Log Summary:"
  echo "   Errors: $ERROR_COUNT"
  echo "   Warnings: $WARN_COUNT"
  echo ""
  
  if [ "$ERROR_COUNT" -gt "0" ]; then
    echo "❌ Recent Errors from Bundler:"
    grep -i "error" web-bundler-output.log | tail -5
    echo ""
  fi
fi

# Check Railway backend
echo "🚀 Checking Railway Backend..."
RAILWAY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://localhost:8081" https://api-production-8ac3.up.railway.app/health)

if [ "$RAILWAY_RESPONSE" = "200" ]; then
  echo "✅ Railway backend responding: HTTP $RAILWAY_RESPONSE"
else
  echo "❌ Railway backend issue: HTTP $RAILWAY_RESPONSE"
fi
echo ""

# Instructions
echo "📝 To check browser errors, open Chrome DevTools and run:"
echo "   window.testingMonitor.getErrorReport()"
echo ""
echo "📄 Full changelog: WEB_TESTING_CHANGELOG.md"
echo ""
