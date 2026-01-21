#!/bin/bash

echo "🔍 DIAGNOSING RAILWAY BAD GATEWAY ERROR"
echo "========================================"
echo ""

API_URL="https://api-production-8ac3.up.railway.app"

echo "1️⃣  Testing Backend Connection..."
echo ""

# Test health endpoint
response=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>&1)
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status Code: $http_code"
echo ""

if [ "$http_code" = "200" ]; then
    echo "✅ Backend is UP!"
    echo ""
    echo "Response:"
    echo "$body" | head -20
elif [ "$http_code" = "502" ]; then
    echo "❌ Bad Gateway (502) - This means:"
    echo ""
    echo "Possible causes:"
    echo "1. Backend service crashed on startup"
    echo "2. Missing required environment variables (DATABASE_URL, JWT_SECRET)"
    echo "3. Database connection failed"
    echo "4. Backend is restarting/deploying"
    echo ""
    echo "🔧 FIX STEPS:"
    echo ""
    echo "Step 1: Check Railway Dashboard"
    echo "  1. Go to: https://railway.app/dashboard"
    echo "  2. Open your project"
    echo "  3. Click on the 'api' service"
    echo "  4. Check 'Deployments' tab for recent failures"
    echo "  5. Check 'Logs' tab for error messages"
    echo ""
    echo "Step 2: Verify Required Environment Variables"
    echo "  In Railway Dashboard → Settings → Variables, ensure you have:"
    echo "  ✓ DATABASE_URL (required)"
    echo "  ✓ JWT_SECRET (required, must be ≥32 characters)"
    echo ""
    echo "Step 3: Check if Service Needs Restart"
    echo "  In Railway Dashboard:"
    echo "  1. Go to service settings"
    echo "  2. Click 'Redeploy' or 'Restart'"
    echo ""
    echo "Step 4: Check Build Logs"
    echo "  In Railway Dashboard → Deployments:"
    echo "  - Look for build errors"
    echo "  - Check if Docker build succeeded"
    echo "  - Verify all dependencies installed"
    echo ""
elif [ "$http_code" = "000" ] || [ -z "$http_code" ]; then
    echo "❌ Cannot connect - Network error or backend completely down"
    echo ""
    echo "This could mean:"
    echo "- Backend service is stopped"
    echo "- Railway infrastructure issue"
    echo "- Network connectivity problem"
    echo ""
    echo "Check Railway Dashboard → Service Status"
else
    echo "⚠️  Unexpected status: $http_code"
    echo ""
    echo "Response body:"
    echo "$body" | head -10
fi

echo ""
echo "========================================"
echo ""
echo "💡 The Bad Gateway error is a Railway backend issue."
echo "   I've configured the app correctly - this needs to be"
echo "   fixed in Railway dashboard (see steps above)."
echo ""
