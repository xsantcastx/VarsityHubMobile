#!/bin/bash
# Overnight API Validation
# Tests critical API endpoints and validates webhook configurations

echo "🔌 Starting overnight API validation..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:4000}"

# 1. Health check
echo ""
echo "================================================="
echo "Phase 1: API Health Check"
echo "================================================="
{
    echo "🔍 Checking API health endpoint..."
    curl -s -f "$API_URL/health" || echo "❌ ERROR: Health check failed"
} 2>&1 | tee "$LOG_DIR/1-health.log"

# 2. Critical endpoint tests
echo ""
echo "================================================="
echo "Phase 2: Critical Endpoints"
echo "================================================="
{
    echo "🔍 Testing critical endpoints..."
    
    # Auth endpoints (should return 401 without auth)
    echo "  - Testing /auth endpoints..."
    curl -s -o /dev/null -w "Status: %{http_code}\n" "$API_URL/api/auth/me" 2>&1
    
    # Payments configuration
    echo "  - Testing payments config..."
    curl -s "$API_URL/api/payments/config-status" 2>&1 | head -20
    
} 2>&1 | tee "$LOG_DIR/2-endpoints.log"

# 3. Webhook validation
echo ""
echo "================================================="
echo "Phase 3: Webhook Configuration"
echo "================================================="
{
    echo "🔍 Validating webhook configurations..."
    
    # Check if Stripe webhook secret is configured
    if [ -f "server/.env" ]; then
        if grep -q "STRIPE_WEBHOOK_SECRET" server/.env && ! grep -q "STRIPE_WEBHOOK_SECRET=$" server/.env; then
            echo "✅ Stripe webhook secret configured"
        else
            echo "⚠️  WARNING: Stripe webhook secret not configured"
        fi
    else
        echo "⚠️  WARNING: server/.env not found"
    fi
    
    # Check webhook endpoint accessibility
    echo "  - Webhook endpoints should be accessible from Stripe"
    echo "    Production: https://api-production-8ac3.up.railway.app/api/payments/webhook"
    
} 2>&1 | tee "$LOG_DIR/3-webhooks.log"

# 4. Environment validation
echo ""
echo "================================================="
echo "Phase 4: Environment Variables"
echo "================================================="
{
    echo "🔍 Validating critical environment variables..."
    
    if [ -f "server/.env" ]; then
        required_vars=(
            "STRIPE_SECRET_KEY"
            "STRIPE_WEBHOOK_SECRET"
            "JWT_SECRET"
            "DATABASE_URL"
        )
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" server/.env && ! grep -q "^$var=$" server/.env; then
                echo "✅ $var is set"
            else
                echo "⚠️  WARNING: $var is missing or empty"
            fi
        done
    else
        echo "⚠️  WARNING: server/.env not found"
    fi
    
} 2>&1 | tee "$LOG_DIR/4-env.log"

echo ""
echo "================================================="
echo "API Validation Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Completed: $(date)"
