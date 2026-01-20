#!/bin/bash
# Verify the three problematic template IDs from UI vs Railway vs SendGrid

echo "🔍 VERIFYING THREE TEMPLATE IDs"
echo ""

# IDs from SendGrid UI (shown by user)
UI_TEAM_INVITE="d-14788def39174bb6bf186716cce166fa"
UI_SUSPENSION_45="d-0941019230d9459b81ff602d93f7aa04"
UI_RSVP="d-511e46f46f974f18a8f33c12564de14b"

# IDs that failed (from export-summary.json)
FAILED_TEAM_INVITE="d-14788def39174bb66bf186716cce166fa"
FAILED_SUSPENSION_45="d-0941019230d9459b81ff602d937f7aa04"
FAILED_RSVP="d-511e46f4646f974f18a8f33c12564de14b"

echo "📋 Template IDs from SendGrid UI:"
echo "   1. TEAM_INVITE: $UI_TEAM_INVITE"
echo "   2. ACCOUNT_SUSPENSION_45_DAYS: $UI_SUSPENSION_45"
echo "   3. EVENT_RSVP_CONFIRMED: $UI_RSVP"
echo ""

echo "❌ Template IDs that FAILED (404 errors):"
echo "   1. TEAM_INVITE: $FAILED_TEAM_INVITE"
echo "   2. ACCOUNT_SUSPENSION_45_DAYS: $FAILED_SUSPENSION_45"
echo "   3. EVENT_RSVP_CONFIRMED: $FAILED_RSVP"
echo ""

# Check Railway if CLI is available
if command -v railway &> /dev/null; then
    echo "✅ Railway CLI found - checking current values..."
    echo ""
    
    RAILWAY_TEAM=$(railway variables get SENDGRID_TEAM_INVITE_TEMPLATE_ID 2>/dev/null | grep -v "^$" || echo "NOT_SET")
    RAILWAY_SUSPENSION=$(railway variables get SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID 2>/dev/null | grep -v "^$" || echo "NOT_SET")
    RAILWAY_RSVP=$(railway variables get SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID 2>/dev/null | grep -v "^$" || echo "NOT_SET")
    
    echo "📊 Railway Current Values:"
    echo "   TEAM_INVITE: $RAILWAY_TEAM"
    echo "   ACCOUNT_SUSPENSION_45_DAYS: $RAILWAY_SUSPENSION"
    echo "   EVENT_RSVP_CONFIRMED: $RAILWAY_RSVP"
    echo ""
    
    # Verify against UI IDs
    echo "🔍 VERIFICATION RESULTS:"
    echo ""
    
    if [ "$RAILWAY_TEAM" = "$UI_TEAM_INVITE" ]; then
        echo "✅ TEAM_INVITE: Railway matches UI ($UI_TEAM_INVITE)"
    elif [ "$RAILWAY_TEAM" = "$FAILED_TEAM_INVITE" ]; then
        echo "❌ TEAM_INVITE: Railway has WRONG ID (failed one)"
        echo "   Current: $RAILWAY_TEAM"
        echo "   Should be: $UI_TEAM_INVITE"
        echo "   Fix: railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID \"$UI_TEAM_INVITE\""
    else
        echo "⚠️  TEAM_INVITE: Railway has different ID"
        echo "   Current: $RAILWAY_TEAM"
        echo "   UI shows: $UI_TEAM_INVITE"
    fi
    
    echo ""
    
    if [ "$RAILWAY_SUSPENSION" = "$UI_SUSPENSION_45" ]; then
        echo "✅ ACCOUNT_SUSPENSION_45_DAYS: Railway matches UI ($UI_SUSPENSION_45)"
    elif [ "$RAILWAY_SUSPENSION" = "$FAILED_SUSPENSION_45" ]; then
        echo "❌ ACCOUNT_SUSPENSION_45_DAYS: Railway has WRONG ID (failed one)"
        echo "   Current: $RAILWAY_SUSPENSION"
        echo "   Should be: $UI_SUSPENSION_45"
        echo "   Fix: railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID \"$UI_SUSPENSION_45\""
    else
        echo "⚠️  ACCOUNT_SUSPENSION_45_DAYS: Railway has different ID"
        echo "   Current: $RAILWAY_SUSPENSION"
        echo "   UI shows: $UI_SUSPENSION_45"
    fi
    
    echo ""
    
    if [ "$RAILWAY_RSVP" = "$UI_RSVP" ]; then
        echo "✅ EVENT_RSVP_CONFIRMED: Railway matches UI ($UI_RSVP)"
    elif [ "$RAILWAY_RSVP" = "$FAILED_RSVP" ]; then
        echo "❌ EVENT_RSVP_CONFIRMED: Railway has WRONG ID (failed one)"
        echo "   Current: $RAILWAY_RSVP"
        echo "   Should be: $UI_RSVP"
        echo "   Fix: railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID \"$UI_RSVP\""
    else
        echo "⚠️  EVENT_RSVP_CONFIRMED: Railway has different ID"
        echo "   Current: $RAILWAY_RSVP"
        echo "   UI shows: $UI_RSVP"
    fi
    
    echo ""
    echo "📝 SUMMARY:"
    echo "   If Railway IDs don't match UI IDs, update them with the commands shown above."
    echo "   Railway will automatically restart after variable changes."
else
    echo "⚠️  Railway CLI not installed. Install with: npm i -g @railway/cli"
    echo ""
    echo "Or check manually in Railway dashboard and compare:"
    echo "   Expected TEAM_INVITE: $UI_TEAM_INVITE"
    echo "   Expected SUSPENSION_45: $UI_SUSPENSION_45"
    echo "   Expected RSVP_CONFIRMED: $UI_RSVP"
fi

echo ""