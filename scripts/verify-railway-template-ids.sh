#!/bin/bash
# Verify Railway template IDs match SendGrid UI

echo "🔍 Verifying Railway Template IDs"
echo ""

# Expected IDs from SendGrid UI
EXPECTED_TEAM_INVITE="d-14788def39174bb6bf186716cce166fa"
EXPECTED_SUSPENSION_45="d-0941019230d9459b81ff602d93f7aa04"
EXPECTED_RSVP="d-511e46f46f974f18a8f33c12564de14b"

echo "📋 Expected Template IDs (from SendGrid UI):"
echo "   TEAM_INVITE: $EXPECTED_TEAM_INVITE"
echo "   ACCOUNT_SUSPENSION_45_DAYS: $EXPECTED_SUSPENSION_45"
echo "   EVENT_RSVP_CONFIRMED: $EXPECTED_RSVP"
echo ""

if command -v railway &> /dev/null; then
    echo "✅ Railway CLI found"
    echo ""
    echo "🔍 Checking Railway environment variables..."
    echo ""
    
    # Get current values from Railway
    CURRENT_TEAM=$(railway variables get SENDGRID_TEAM_INVITE_TEMPLATE_ID 2>/dev/null || echo "NOT_SET")
    CURRENT_SUSPENSION=$(railway variables get SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID 2>/dev/null || echo "NOT_SET")
    CURRENT_RSVP=$(railway variables get SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID 2>/dev/null || echo "NOT_SET")
    
    echo "📊 Current Railway Values:"
    echo "   TEAM_INVITE: $CURRENT_TEAM"
    echo "   ACCOUNT_SUSPENSION_45_DAYS: $CURRENT_SUSPENSION"
    echo "   EVENT_RSVP_CONFIRMED: $CURRENT_RSVP"
    echo ""
    
    # Compare
    MISMATCHES=0
    
    if [ "$CURRENT_TEAM" != "$EXPECTED_TEAM_INVITE" ]; then
        echo "❌ TEAM_INVITE mismatch!"
        echo "   Railway: $CURRENT_TEAM"
        echo "   Expected: $EXPECTED_TEAM_INVITE"
        MISMATCHES=$((MISMATCHES + 1))
    else
        echo "✅ TEAM_INVITE matches"
    fi
    
    if [ "$CURRENT_SUSPENSION" != "$EXPECTED_SUSPENSION_45" ]; then
        echo "❌ ACCOUNT_SUSPENSION_45_DAYS mismatch!"
        echo "   Railway: $CURRENT_SUSPENSION"
        echo "   Expected: $EXPECTED_SUSPENSION_45"
        MISMATCHES=$((MISMATCHES + 1))
    else
        echo "✅ ACCOUNT_SUSPENSION_45_DAYS matches"
    fi
    
    if [ "$CURRENT_RSVP" != "$EXPECTED_RSVP" ]; then
        echo "❌ EVENT_RSVP_CONFIRMED mismatch!"
        echo "   Railway: $CURRENT_RSVP"
        echo "   Expected: $EXPECTED_RSVP"
        MISMATCHES=$((MISMATCHES + 1))
    else
        echo "✅ EVENT_RSVP_CONFIRMED matches"
    fi
    
    echo ""
    if [ $MISMATCHES -eq 0 ]; then
        echo "✅ All template IDs match! The 404 errors might be because:"
        echo "   1. Templates were deleted from SendGrid"
        echo "   2. Templates exist but API access is restricted"
        echo "   3. Template IDs need verification in SendGrid dashboard"
        echo ""
        echo "💡 Check SendGrid: https://mc.sendgrid.com/dynamic-templates"
        echo "   Verify each template ID exists and is active"
    else
        echo "⚠️  Found $MISMATCHES mismatch(es). Update them with:"
        echo ""
        echo "   railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID \"$EXPECTED_TEAM_INVITE\""
        echo "   railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID \"$EXPECTED_SUSPENSION_45\""
        echo "   railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID \"$EXPECTED_RSVP\""
    fi
else
    echo "❌ Railway CLI not found. Install it with:"
    echo "   npm i -g @railway/cli"
    echo ""
    echo "Or check manually in Railway dashboard:"
    echo "   https://railway.app"
fi

echo ""