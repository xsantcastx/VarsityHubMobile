#!/bin/bash
# Script to update the three missing SendGrid template IDs
# Based on the template IDs shown in the UI

echo "🔧 Fixing Three Missing SendGrid Template IDs"
echo ""

# Template IDs from the UI
TEAM_INVITE_ID="d-14788def39174bb6bf186716cce166fa"
SUSPENSION_45_DAYS_ID="d-0941019230d9459b81ff602d93f7aa04"
RSVP_CONFIRMED_ID="d-511e46f46f974f18a8f33c12564de14b"

echo "📋 Template IDs to set:"
echo "   TEAM_INVITE: $TEAM_INVITE_ID"
echo "   ACCOUNT_SUSPENSION_45_DAYS: $SUSPENSION_45_DAYS_ID"
echo "   EVENT_RSVP_CONFIRMED: $RSVP_CONFIRMED_ID"
echo ""

# Check if Railway CLI is available
if command -v railway &> /dev/null; then
    echo "✅ Railway CLI found"
    echo ""
    echo "🚀 Updating Railway environment variables..."
    
    railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "$TEAM_INVITE_ID"
    railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID "$SUSPENSION_45_DAYS_ID"
    railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID "$RSVP_CONFIRMED_ID"
    
    echo ""
    echo "✅ Railway variables updated!"
    echo "   Railway will automatically restart your service."
else
    echo "⚠️  Railway CLI not found. Please install it or update manually:"
    echo ""
    echo "   railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID \"$TEAM_INVITE_ID\""
    echo "   railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID \"$SUSPENSION_45_DAYS_ID\""
    echo "   railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID \"$RSVP_CONFIRMED_ID\""
fi

echo ""
echo "📝 For local .env file, add these lines:"
echo "   SENDGRID_TEAM_INVITE_TEMPLATE_ID=$TEAM_INVITE_ID"
echo "   SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=$SUSPENSION_45_DAYS_ID"
echo "   SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=$RSVP_CONFIRMED_ID"
echo ""
echo "✅ Done! Restart your server after updating .env file."