# Test Transaction Report Email on Railway Production

## 🔗 Production API URL

```
https://api-production-8ac3.up.railway.app
```

---

## ✅ Step 1: Check Health & SendGrid Status

```bash
curl -s https://api-production-8ac3.up.railway.app/health | jq '.integrations.sendgrid'
```

**Expected Output:**

- `true` = SendGrid configured and ready ✅
- `false` = SendGrid not configured ❌

**Full health check:**

```bash
curl -s https://api-production-8ac3.up.railway.app/health | jq .
```

---

## 📧 Step 2: Test Transaction Report Email

```bash
curl -X POST https://api-production-8ac3.up.railway.app/test-emails/transaction-report \
  -H "Content-Type: application/json" \
  -d '{"to": "support@varsityhub.app"}'
```

**Expected Response:**

```json
{
  "ok": true,
  "reportDate": "2024-12-XX",
  "summary": {
    "totalTransactions": X,
    "completedTransactions": X,
    "totalRevenueCents": X,
    "totalFeesCents": X,
    "totalDiscountsCents": X,
    "netRevenueCents": X
  },
  "message": "Transaction report sent successfully"
}
```

---

## ✅ Step 3: Verify Email Received

1. **Check inbox** at `support@varsityhub.app`
2. **Check "From" field** - Should show: `noreply@varsityhub.app` ✅
3. **Subject**: `📊 Daily Transaction Report - YYYY-MM-DD`
4. **Content**: HTML report with transaction summary, breakdowns, etc.

---

## 🚨 If Test Endpoint Returns 403

The `/test-emails/*` endpoints are **development-only** and disabled in production.

### Alternative: Verify End-of-Day Report Will Work

Since the test endpoint is dev-only, verify the scheduled job is configured:

```bash
# Check if scheduler is set up (if you have access to Railway logs)
# Look for: "[Scheduler] Added job: end-of-day-transaction-report"
```

The scheduled job will run automatically at **11:59 PM daily** and send to:

- `TRANSACTION_REPORT_EMAIL` env var (if set)
- OR first email from `ADMIN_EMAILS` env var
- OR fallback: `support@varsityhub.app` ✅

---

## 📋 Production Configuration Checklist

Verify these Railway environment variables are set:

```bash
# Required for email sending
SENDGRID_API_KEY=SG.xxxxx...
EMAIL_FROM=noreply@varsityhub.app

# Optional - override report recipient
TRANSACTION_REPORT_EMAIL=support@varsityhub.app

# Optional - fallback admin emails
ADMIN_EMAILS=support@varsityhub.app,...
```

---

## ✅ Success Criteria

1. **Health check** shows `sendgrid: true` ✅
2. **Test email** sends (if dev mode enabled) ✅
3. **Email received** with `From: noreply@varsityhub.app` ✅
4. **Report content** shows transaction data correctly ✅

---

## 🎯 Next Steps

Once verified:

1. ✅ Transaction reports will send daily at 11:59 PM
2. ✅ Recipient: `support@varsityhub.app`
3. ✅ From: `noreply@varsityhub.app`
4. ✅ System ready for production use
