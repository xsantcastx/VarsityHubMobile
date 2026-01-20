# Update Railway Template IDs

## ⚠️ Issue Found

The template IDs currently set in Railway don't match the ones in your SendGrid UI. That's why you're getting 404 errors!

## 🔧 Fix: Update Railway Variables

Run these commands to set the **correct** template IDs:

```bash
railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-14788def39174bb6bf186716cce166fa"
railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID "d-0941019230d9459b81ff602d93f7aa04"
railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID "d-511e46f46f974f18a8f33c12564de14b"
```

## ✅ Verification

After updating, run:
```bash
./scripts/verify-railway-template-ids.sh
```

Or check manually in Railway dashboard to confirm the values match.

## 🎯 Result

After Railway restarts (automatic), the 404 errors will be gone and emails will work!