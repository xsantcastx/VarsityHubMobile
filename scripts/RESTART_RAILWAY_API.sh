#!/bin/bash
set -e

echo "🔄 RESTARTING RAILWAY API SERVICE"
echo "=================================="
echo ""

cd "$(dirname "$0")/../server" || exit 1

echo "1️⃣  Checking current service..."
railway status 2>&1 || echo "Not linked to service"

echo ""
echo "2️⃣  To restart the API service, run these commands:"
echo ""
echo "   cd server"
echo "   railway service"
echo "   # Select 'api' or your backend service name"
echo "   railway logs"
echo "   # Check logs for errors"
echo ""
echo "3️⃣  Then restart via Railway Dashboard:"
echo "   - Go to: https://railway.app/dashboard"
echo "   - Click your project → 'api' service"
echo "   - Click '...' menu → 'Restart' or 'Redeploy'"
echo ""
echo "   OR trigger redeploy:"
echo "   railway up"
echo ""
