# Quick Fix: Three Template IDs

## ✅ Template IDs Found

Based on your UI, here are the correct template IDs:

1. **Team Invitation**: `d-14788def39174bb6bf186716cce166fa`
2. **45 Day Suspension**: `d-0941019230d9459b81ff602d93f7aa04`
3. **Event RSVP Confirmation**: `d-511e46f46f974f18a8f33c12564de14b`

## 🚀 Quick Fix Commands

### Option 1: Run the Fix Script
```bash
./scripts/fix-template-ids.sh
```

### Option 2: Manual Railway Update
```bash
railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-14788def39174bb6bf186716cce166fa"
railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID "d-0941019230d9459b81ff602d93f7aa04"
railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID "d-511e46f46f974f18a8f33c12564de14b"
```

### Option 3: Update Local .env File
Add these lines to your `.env` or `server/.env` file:
```bash
SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-14788def39174bb6bf186716cce166fa
SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=d-0941019230d9459b81ff602d93f7aa04
SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=d-511e46f46f974f18a8f33c12564de14b
```

## ✅ Verification

After updating:
1. **Restart your server** (Railway restarts automatically)
2. **Check logs** for email initialization success
3. **Test emails** - try sending a team invite or RSVP confirmation
4. **Check SendGrid Activity Feed**: https://mc.sendgrid.com/activity

## 🎯 That's It!

These template IDs will now work correctly. The 404 errors will be resolved!