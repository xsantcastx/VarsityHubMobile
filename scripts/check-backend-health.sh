#!/bin/bash

echo "🔍 Checking Backend Health..."
echo "=============================="
echo ""

BACKEND_URL="https://api-production-8ac3.up.railway.app"

echo "Testing backend at: $BACKEND_URL"
echo ""

# Test health endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>&1)

if [ "$response" = "200" ]; then
    echo "✅ Backend is UP and responding (HTTP 200)"
    echo ""
    echo "Full health check:"
    curl -s "$BACKEND_URL/health" | head -20
elif [ "$response" = "502" ]; then
    echo "❌ Bad Gateway (502) - Backend or gateway is having issues"
    echo ""
    echo "This means:"
    echo "- Railway backend might be down"
    echo "- Gateway/proxy is misconfigured"
    echo "- Network issue between servers"
    echo ""
    echo "Check Railway dashboard for:"
    echo "- Service status"
    echo "- Recent deployments"
    echo "- Error logs"
elif [ "$response" = "000" ]; then
    echo "❌ Cannot connect - Network error or backend is completely down"
else
    echo "⚠️  Backend returned HTTP $response"
    echo ""
    echo "Testing full response:"
    curl -s "$BACKEND_URL/health" | head -10
fi

echo ""
echo "=========================================="
echo ""
echo "If backend is down, this is NOT related to"
echo "Fast Refresh changes - it's a server issue."
