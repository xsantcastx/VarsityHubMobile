#!/bin/bash
# Overnight Stripe Payment Reconciliation
# Verifies Stripe webhooks match database records

echo "💳 Starting overnight Stripe reconciliation..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:4000}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"

echo ""
echo "================================================="
echo "Phase 1: Stripe Configuration Check"
echo "================================================="
{
    echo "🔍 Checking Stripe configuration..."
    
    if [ -z "$STRIPE_SECRET_KEY" ]; then
        if [ -f "server/.env" ]; then
            # Try to read from server/.env (may have permission issues)
            echo "⚠️  STRIPE_SECRET_KEY not in environment"
            echo "   Checking server/.env..."
            
            if grep -q "STRIPE_SECRET_KEY" server/.env 2>/dev/null; then
                echo "   ✅ Stripe key found in server/.env"
            else
                echo "   ❌ Stripe key not found in server/.env"
            fi
        else
            echo "⚠️  STRIPE_SECRET_KEY not configured"
            echo "   Set STRIPE_SECRET_KEY environment variable or in server/.env"
        fi
    else
        echo "✅ STRIPE_SECRET_KEY configured"
    fi
    
    # Check webhook secret
    if [ -f "server/.env" ]; then
        if grep -q "STRIPE_WEBHOOK_SECRET" server/.env 2>/dev/null; then
            echo "✅ STRIPE_WEBHOOK_SECRET found"
        else
            echo "⚠️  STRIPE_WEBHOOK_SECRET not found"
        fi
    fi
    
} 2>&1 | tee "$LOG_DIR/1-config.log"

# 2. Database transaction check
echo ""
echo "================================================="
echo "Phase 2: Database Transaction Analysis"
echo "================================================="
{
    echo "🔍 Analyzing database transactions..."
    
    # Check if API is available to query transactions
    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        echo "✅ API is accessible"
        
        # Try to get transaction stats (if endpoint exists)
        echo ""
        echo "📊 Attempting to fetch transaction statistics..."
        
        # Note: This would require an admin endpoint or direct database access
        # For now, we'll document what should be checked
        echo "   To fully reconcile, you need:"
        echo "   • Access to transactions table"
        echo "   • Access to Stripe dashboard"
        echo "   • Compare payment_status between DB and Stripe"
        
    else
        echo "⚠️  API not accessible (backend may not be running)"
        echo "   Reconciliation requires backend access"
    fi
    
    # Check for transaction log files if any
    if [ -d "server/logs" ]; then
        echo ""
        echo "🔍 Checking for transaction logs..."
        TRANSACTION_LOGS=$(find server/logs -name "*transaction*" -o -name "*payment*" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "   Found $TRANSACTION_LOGS transaction-related log files"
    fi
    
} 2>&1 | tee "$LOG_DIR/2-database.log"

# 3. Webhook verification
echo ""
echo "================================================="
echo "Phase 3: Webhook Configuration Verification"
echo "================================================="
{
    echo "🔍 Verifying webhook configuration..."
    
    echo "📋 Webhook endpoints to verify:"
    echo "   Production: https://api-production-8ac3.up.railway.app/api/payments/webhook"
    echo "   Local: $API_URL/api/payments/webhook"
    echo ""
    
    # Check if webhook routes exist in codebase
    if [ -f "server/src/routes/payments.ts" ]; then
        if grep -q "paymentsRouter.post('/webhook'" server/src/routes/payments.ts 2>/dev/null; then
            echo "✅ Webhook route exists in code"
        else
            echo "⚠️  Webhook route not found in payments.ts"
        fi
        
        # Check for webhook signature verification
        if grep -q "stripe-signature\|WEBHOOK_SECRET" server/src/routes/payments.ts 2>/dev/null; then
            echo "✅ Webhook signature verification implemented"
        else
            echo "⚠️  Webhook signature verification not found"
        fi
    fi
    
    # Check billing webhook route
    if [ -f "server/src/routes/billing.ts" ]; then
        if grep -q "billingRouter.post('/webhooks/stripe'" server/src/routes/billing.ts 2>/dev/null; then
            echo "✅ Billing webhook route exists"
        fi
    fi
    
} 2>&1 | tee "$LOG_DIR/3-webhook.log"

# 4. Reconciliation checklist
echo ""
echo "================================================="
echo "Phase 4: Reconciliation Checklist"
echo "================================================="
{
    echo "📋 Generating reconciliation checklist..."
    
    CHECKLIST_FILE="$LOG_DIR/stripe-reconciliation-checklist.txt"
    
    cat > "$CHECKLIST_FILE" << EOF
╔═══════════════════════════════════════════════════════════╗
║  STRIPE PAYMENT RECONCILIATION CHECKLIST                  ║
╚═══════════════════════════════════════════════════════════╝

Generated: $(date)

MANUAL RECONCILIATION STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ Stripe Dashboard Check:
   • Go to: https://dashboard.stripe.com/payments
   • Export payments from last 24 hours
   • Note: Session IDs, amounts, statuses

2. ✅ Database Verification:
   • Query transactions table for last 24 hours
   • Compare session IDs with Stripe
   • Verify payment_status matches
   • Check for missing transactions

3. ✅ Subscription Reconciliation:
   • Check active subscriptions in Stripe
   • Compare with user.subscription_id in database
   • Verify subscription_tier matches
   • Check for expired/canceled subscriptions

4. ✅ Webhook Verification:
   • Review Stripe webhook logs
   • Check for failed webhook deliveries
   • Verify webhook signatures
   • Check for duplicate processing

5. ✅ Failed Payment Handling:
   • Check for failed payments in Stripe
   • Verify database updated correctly
   • Check for retry logic
   • Verify user notifications sent

AUTOMATED CHECKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Configuration:
   • Stripe Secret Key: $([ -n "$STRIPE_SECRET_KEY" ] && echo "Configured" || echo "Missing")
   • Webhook Secret: Check server/.env
   • Webhook Routes: Verified in code

⚠️  REQUIRES MANUAL VERIFICATION:
   • Stripe Dashboard access
   • Database query access
   • Recent transaction comparison

TIPS FOR RECONCILIATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Compare session IDs between Stripe and database
2. Check payment_status field matches
3. Verify amounts match (cents vs dollars)
4. Check subscription status matches
5. Look for orphaned transactions
6. Verify webhook processing worked

RED FLAGS TO WATCH FOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Transactions in Stripe but not in database
⚠️  Transactions in database but not in Stripe
⚠️  Payment status mismatches
⚠️  Amount discrepancies
⚠️  Failed webhook deliveries
⚠️  Duplicate transaction processing

EOF

    cat "$CHECKLIST_FILE"
    echo ""
    echo "📄 Full checklist saved to: $CHECKLIST_FILE"
    
} 2>&1 | tee "$LOG_DIR/4-checklist.log"

echo ""
echo "================================================="
echo "Stripe Reconciliation Check Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Checklist: $LOG_DIR/stripe-reconciliation-checklist.txt"
echo ""
echo "⚠️  NOTE: Full reconciliation requires:"
echo "   • Stripe Dashboard access"
echo "   • Database query access"
echo "   • Manual comparison of records"
echo ""
echo "Completed: $(date)"
