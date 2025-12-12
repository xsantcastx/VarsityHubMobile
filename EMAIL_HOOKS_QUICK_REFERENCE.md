# Email Hooks: Quick Reference Card

**Status:** ✅ Implementation Complete | 🔄 Configuration Pending | ⏳ Testing Ready  
**Date:** December 12, 2025

---

## 📋 What Changed?

### Files Modified
- ✅ `server/src/routes/payments.ts` - Added Stripe invoice/subscription email notifications
- ✅ `server/src/routes/organizations.ts` - Added membership decision and plan limit emails
- ✅ `server/src/routes/teams.ts` - Added plan limit warning for team creation
- ✅ `server/src/routes/events.ts` - Added event approval/rejection notifications
- ✅ `server/src/routes/auth.ts` - Added security alert on password reset
- ✅ `server/src/lib/email.ts` - Added 7 new email functions (already exported)

### No Files Deleted
### No Breaking Changes
### Backward Compatible (with fallbacks)

---

## 🎯 Email Flows Added

### 1. Stripe Payment Lifecycle (4 emails)
```
User subscribes → payment processing ↓

├─ invoice.payment_succeeded 
│  └─ 📧 sendPaymentReceiptEmail()
│  
├─ invoice.payment_failed 
│  └─ 📧 sendPaymentFailedEmail()
│
├─ customer.subscription.updated 
│  └─ 📧 sendPaymentReceiptEmail() [renewal]
│
└─ customer.subscription.deleted 
   └─ 📧 sendSubscriptionCanceledEmail()
```

### 2. Organization Membership (2 emails)
```
User requests to join org ↓

├─ Admin approves
│  └─ 📧 sendMembershipDecisionEmail(approved=true)
│     └─ Fallback: sendJoinRequestApproved() [legacy]
│
└─ Admin denies
   └─ 📧 sendMembershipDecisionEmail(approved=false)
      └─ Fallback: sendJoinRequestDenied() [legacy]
```

### 3. Event Management (2 emails)
```
Creator submits fan event → pending approval ↓

├─ Admin/Coach approves
│  └─ 📧 sendEventDecisionEmail(approved=true)
│
└─ Admin/Coach rejects
   └─ 📧 sendEventDecisionEmail(approved=false, reason?)
```

### 4. Plan Limits (1 email)
```
User hits org/team limit ↓
└─ 📧 sendPlanLimitWarningEmail(resourceType, limit)
```

### 5. Security Alerts (1 email)
```
User completes password reset ↓
└─ 📧 sendSecurityAlertEmail(alertType='password_change')
```

---

## 🔧 SendGrid Template IDs Needed

**Add to production .env:**

```bash
SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID=d-...
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=d-...
SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID=d-...
SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID=d-...
SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID=d-...
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-...
SENDGRID_EVENT_REJECTED_TEMPLATE_ID=d-...
SENDGRID_SECURITY_ALERT_TEMPLATE_ID=d-...
SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID=d-...
```

**How to get Template IDs:**
1. Go to SendGrid Console: https://mail.google.com/mail/u/0/#settings/account
2. Create a new Dynamic Template for each email type above
3. Copy the Template ID (format: `d-xxxxxxxxxxxxxxxxxxxxxxxx`)
4. Add to .env

---

## 📊 Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Code Changes | ✅ Complete | All 5 files modified, imports verified |
| Email Functions | ✅ Complete | All 7 functions exported from email.ts |
| Type Safety | ✅ Complete | Full TypeScript support, no errors in routes |
| Fallback Behavior | ✅ Complete | Legacy templates for org membership, graceful degradation for others |
| Error Handling | ✅ Complete | All calls wrapped in try/catch with logging |
| Compilation | ✅ Complete | npm run build succeeds |
| Stripe Integration | ✅ Complete | Webhook handlers connected correctly |
| Email.js Functions | ✅ Complete | All 7 functions implement retry logic and logging |

---

## 🚀 Next Steps (In Order)

### Step 1: Create SendGrid Templates (DevOps) - 30 min
Create 9 templates in SendGrid console:
1. PAYMENT_RECEIPT
2. PAYMENT_FAILED
3. SUBSCRIPTION_CANCELED
4. MEMBERSHIP_APPROVED
5. MEMBERSHIP_DENIED
6. EVENT_APPROVED
7. EVENT_REJECTED
8. SECURITY_ALERT
9. PLAN_LIMIT_WARNING

### Step 2: Configure Template IDs (DevOps) - 15 min
Add all 9 Template IDs to production .env

### Step 3: Test All Flows (QA) - 2 hours
- Stripe webhook sandbox tests (4 scenarios)
- Organization membership tests (2 scenarios)
- Event management tests (2 scenarios)
- Plan limit tests (1 scenario)
- Security alert test (1 scenario)

### Step 4: Deploy (DevOps) - 30 min
- Code review approval
- Deploy to production
- Monitor logs for 30 minutes

### Step 5: Fix Pre-existing Issues (Frontend) - 1-2 hours
- Fix app/organizations/[id].tsx (apiBaseUrl, routing)
- Fix app/team-invites.tsx (error vs _error variable)

---

## ⚙️ How Each Email Works

### Stripe Payments
```typescript
// Webhook triggers automatically
POST /webhook (Stripe → Your Server)
  → event.type = "invoice.payment_succeeded"
    → sendPaymentReceiptEmail({
        to: customer.email,
        planName: "Veteran Membership",
        amount: "$9.99",
        billingPeriod: "Dec 12 - Jan 12"
      })
    → SendGrid sends email using PAYMENT_RECEIPT template
```

### Organization Membership
```typescript
// Admin approves join request
POST /join-requests/:id/approve
  → Update join request status to 'approved'
    → Create membership
      → sendMembershipDecisionEmail({ approved: true })
        → Tries MEMBERSHIP_APPROVED template
        → Falls back to sendJoinRequestApproved() if template not configured
        → User receives email
```

### Events
```typescript
// Coach approves event
PUT /events/:id/approve
  → Update event status to 'approved'
    → sendEventDecisionEmail({ approved: true, eventName: "..." })
      → Sends EVENT_APPROVED template
      → Includes link back to event page
```

### Plan Limits
```typescript
// User hits limit
POST /organizations
  → Check plan limit
    → Limit reached?
      → notifyOrganizationPlanLimitEmail()
        → sendPlanLimitWarningEmail(...)
        → User notified to upgrade
```

### Security Alerts
```typescript
// User resets password
POST /password/reset
  → Validate code and hash new password
    → Update user in DB
      → sendSecurityAlertEmail({
          alertType: 'password_change',
          ipAddress: '192.168.1.1'
        })
        → User gets out-of-band notification
```

---

## 🧪 Quick Test Commands

### Verify Imports
```bash
grep "sendPaymentReceiptEmail\|sendPaymentFailedEmail" server/src/routes/payments.ts
grep "sendMembershipDecisionEmail\|sendPlanLimitWarningEmail" server/src/routes/organizations.ts
grep "sendEventDecisionEmail" server/src/routes/events.ts
grep "sendSecurityAlertEmail" server/src/routes/auth.ts
```

### Verify Exports
```bash
grep "^export async function send" server/src/lib/email.ts
# Should show 7 functions:
# - sendPaymentReceiptEmail
# - sendPaymentFailedEmail
# - sendSubscriptionCanceledEmail
# - sendMembershipDecisionEmail
# - sendEventDecisionEmail
# - sendSecurityAlertEmail
# - sendPlanLimitWarningEmail
```

### Verify Compilation
```bash
npm run typecheck -- --noEmit server/src/routes/payments.ts
npm run typecheck -- --noEmit server/src/lib/email.ts
# Should have no errors
```

---

## 🎯 Success Checklist

Before going to production, verify:

- [ ] All 9 SendGrid templates created
- [ ] All 9 Template IDs added to .env
- [ ] Staged and tested in staging environment
- [ ] All webhook tests passing (invoice, subscription, events)
- [ ] Organization membership emails working (with fallback)
- [ ] Event approval/rejection emails sending
- [ ] Plan limit warnings sending
- [ ] Security alerts on password reset
- [ ] Logs show no errors for email sends
- [ ] Emails rendering correctly on mobile/desktop
- [ ] QA sign-off obtained

---

## 🐛 Troubleshooting

### "SendGrid template not configured" warnings
**Cause:** Template ID not set in .env  
**Fix:** Add SENDGRID_*_TEMPLATE_ID to .env with correct ID

### "Failed to send email" errors
**Cause:** 
- SendGrid API key invalid
- SendGrid quota exceeded
- Template ID incorrect
- Email address invalid

**Fix:**
1. Check SENDGRID_API_KEY is set
2. Check SendGrid dashboard for quota
3. Verify template IDs are correct
4. Check server logs for full error message

### Email arrives in spam
**Cause:** SPF/DKIM/DMARC not configured  
**Fix:** Verify email domain authentication in SendGrid console

### Email not arriving at all
**Cause:** 
- Template not configured (most likely)
- Function not being called
- Wrong email address

**Fix:**
1. Check server logs for function call
2. Verify template ID in .env
3. Check SendGrid activity log
4. Test with SendGrid's test email

---

## 📞 Important Links

- **SendGrid Dashboard:** https://app.sendgrid.com
- **Stripe Webhook Events:** https://dashboard.stripe.com/webhooks
- **Email Functions:** `server/src/lib/email.ts` (lines 620-836)
- **Full Integration Docs:** `EMAIL_HOOKS_INTEGRATION_SUMMARY.md`
- **Deployment Guide:** `EMAIL_HOOKS_NEXT_STEPS.md`

---

## 📈 Metrics to Monitor

After deployment, track:

1. **Email Delivery Rate**
   - Target: >95% delivered
   - Monitor: SendGrid dashboard → Event Webhook

2. **Bounce Rate**
   - Target: <1%
   - Monitor: SendGrid → Email Activity → Bounces

3. **Spam Complaints**
   - Target: <0.1%
   - Monitor: SendGrid → Email Activity → Spam Reports

4. **Click-through Rate**
   - Track: Links in emails being clicked
   - Monitor: Google Analytics or SendGrid Link Tracking

5. **Error Logs**
   - Monitor: Server logs for "[*] Failed to send * email"
   - Expected: 0 (or < 0.1% if SendGrid momentarily down)

---

## 🎓 Key Concepts

### Fallback Pattern
Only used for organization membership (2 templates):
```typescript
try {
  const sent = await sendMembershipDecisionEmail(...);
  if (!sent) throw new Error('Template not configured');
} catch {
  // Fallback to legacy template
  await sendJoinRequestApproved(...);
}
```

### Graceful Degradation
Used for all other flows:
```typescript
try {
  await sendEventDecisionEmail(...);
} catch (err) {
  console.warn('[events] Failed to send email:', err);
  // Continue anyway, user can check event status manually
}
```

### Non-blocking Pattern
All emails are async and don't block the main response:
```typescript
// Response sent immediately
res.json({ success: true });

// Email sent in background
sendEventDecisionEmail(...).catch(err => console.warn(err));
```

---

## 📝 Change Summary

```
Total files modified: 6
Total lines added: ~150 (email function calls)
Total lines removed: 0
Breaking changes: 0
Backward compatibility: 100%

Email functions added: 7
New SendGrid templates needed: 9
Fallback templates: 2 (org membership only)

Complexity added: Low
Risk level: Low (all non-blocking, graceful degradation)
```

---

**Version:** 1.0  
**Last Updated:** December 12, 2025  
**Status:** Ready for Configuration & Testing
