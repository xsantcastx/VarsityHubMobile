# Phase 2: QA Testing - Execution Guide

**Status:** Ready to Execute (after Phase 1 complete)  
**Owner:** QA Team / Engineering  
**Timeline:** 2-3 hours  
**Created:** December 12, 2025

---

## Prerequisites

- [ ] Phase 1 complete (SendGrid templates created & configured)
- [ ] Staging environment deployed with template IDs
- [ ] Access to staging server/API
- [ ] Test email account (e.g., test@varsityhub.app)
- [ ] Stripe sandbox account access
- [ ] Terminal access
- [ ] Code editor/IDE for reviewing changes

---

## Overview

Phase 2 validates that all email hooks work correctly before production deployment. All testing happens on staging.

**No production changes until this phase completes successfully.**

---

## Section 1: Unit & Import Testing (15 minutes)

### 1.1 Verify TypeScript Type Safety

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Check email.ts
npm run typecheck -- --noEmit server/src/lib/email.ts
# Expected: No errors

# Check all route files
npm run typecheck -- --noEmit server/src/routes/payments.ts
npm run typecheck -- --noEmit server/src/routes/organizations.ts
npm run typecheck -- --noEmit server/src/routes/teams.ts
npm run typecheck -- --noEmit server/src/routes/events.ts
npm run typecheck -- --noEmit server/src/routes/auth.ts
# Expected: No errors in any file
```

**✅ PASS:** All files have zero TypeScript errors  
**❌ FAIL:** Stop here, contact backend team to fix errors

---

### 1.2 Verify Compilation

```bash
# Full build
npm run build 2>&1 | tee build-output.txt

# Check for email-related errors
grep -i "error" build-output.txt | grep -i "email\|sendpayment\|sendevent\|sendmembership\|sendsecurity\|sendplanlimit" || echo "✅ No email-related compilation errors"

# Check for warnings (acceptable)
grep -i "warning" build-output.txt | head -20
```

**✅ PASS:** Build completes with no errors (warnings OK)  
**❌ FAIL:** Stop here, contact backend team

---

### 1.3 Verify Imports & Exports

```bash
# Verify email functions are exported
grep "^export async function send" server/src/lib/email.ts

# Expected output (7 functions):
# export async function sendPaymentReceiptEmail(...)
# export async function sendPaymentFailedEmail(...)
# export async function sendSubscriptionCanceledEmail(...)
# export async function sendMembershipDecisionEmail(...)
# export async function sendEventDecisionEmail(...)
# export async function sendSecurityAlertEmail(...)
# export async function sendPlanLimitWarningEmail(...)

# Count them
grep "^export async function send" server/src/lib/email.ts | wc -l
# Expected: 7
```

**✅ PASS:** All 7 functions exported  
**❌ FAIL:** Contact backend team

---

## Section 2: Staging Deployment Verification (10 minutes)

### 2.1 Verify Template IDs are Set

SSH into staging server or check deployment platform:

```bash
# Check that all 9 template IDs are configured
echo "PAYMENT_RECEIPT: $SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID"
echo "PAYMENT_FAILED: $SENDGRID_PAYMENT_FAILED_TEMPLATE_ID"
echo "SUBSCRIPTION_CANCELED: $SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID"
echo "MEMBERSHIP_APPROVED: $SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID"
echo "MEMBERSHIP_DENIED: $SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID"
echo "EVENT_APPROVED: $SENDGRID_EVENT_APPROVED_TEMPLATE_ID"
echo "EVENT_REJECTED: $SENDGRID_EVENT_REJECTED_TEMPLATE_ID"
echo "SECURITY_ALERT: $SENDGRID_SECURITY_ALERT_TEMPLATE_ID"
echo "PLAN_LIMIT_WARNING: $SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID"

# All should show: d-xxxxxxxxxxxxxxxxxxxxx
# If any are empty, Phase 1 wasn't completed - STOP and contact DevOps
```

**✅ PASS:** All 9 variables are set  
**❌ FAIL:** Stop, DevOps needs to complete Phase 1

---

### 2.2 Verify Server Logs

```bash
# Check server logs for email initialization
tail -f /path/to/staging/logs/app.log

# Look for:
# "✅ SendGrid email service initialized"
# Or warning if template IDs missing:
# "[email] SendGrid template IDs missing: ..."

# If you see missing templates, Phase 1 wasn't completed correctly
```

---

## Section 3: Integration Testing (90 minutes)

### Test 1: Payment Receipt Email (Stripe Invoice Success)

**Trigger:** `invoice.payment_succeeded` webhook

**Steps:**
```bash
# 1. Start staging server
npm run dev

# 2. Create test membership checkout (in browser or API)
curl -X POST http://localhost:3000/subscribe \
  -H "Authorization: Bearer [test-token]" \
  -H "Content-Type: application/json" \
  -d '{"plan": "veteran"}'
# Capture session_id from response

# 3. Trigger webhook manually in Stripe Dashboard
# (Stripe > Developers > Webhooks > Test Event)
# Event: invoice.payment_succeeded
# Add: customer_email = test@varsityhub.app

# 4. Check results
```

**Expected Outcome:**
- ✅ Email sent to test@varsityhub.app
- ✅ Subject: "Your Payment Receipt for Veteran Membership"
- ✅ Contains: Plan name, amount, billing period
- ✅ Server logs show: "[billing-email] Payment receipt email sent"

**If fails:**
- Check SendGrid Activity Log for bounce/error
- Verify template ID is set in environment
- Check server logs for error messages
- Review `EMAIL_HOOKS_INTEGRATION_SUMMARY.md` section on payments.ts

---

### Test 2: Payment Failed Email

**Trigger:** `invoice.payment_failed` webhook

**Steps:**
```bash
# 1. Trigger webhook in Stripe Dashboard
# Event: invoice.payment_failed
# Add: customer_email = test@varsityhub.app

# 2. Check results
```

**Expected Outcome:**
- ✅ Email sent to test@varsityhub.app
- ✅ Subject: "Payment Failed for..."
- ✅ Contains: Error reason, link to update payment method
- ✅ Server logs show: "[billing-email] payment_failed"

---

### Test 3: Subscription Canceled Email

**Trigger:** `customer.subscription.deleted` webhook

**Steps:**
```bash
# 1. Trigger webhook in Stripe Dashboard
# Event: customer.subscription.deleted
# Add: customer_email = test@varsityhub.app

# 2. Check results
```

**Expected Outcome:**
- ✅ Email sent to test@varsityhub.app
- ✅ Subject: "Your Subscription Has Been Canceled"
- ✅ Contains: Plan name, renewal/end date
- ✅ Server logs show: "[billing-email] subscription_canceled"

---

### Test 4: Subscription Renewed Email

**Trigger:** `customer.subscription.updated` webhook (with status=active)

**Steps:**
```bash
# 1. Trigger webhook in Stripe Dashboard
# Event: customer.subscription.updated
# Add: object.status = "active"
# Add: customer_email = test@varsityhub.app

# 2. Check results
```

**Expected Outcome:**
- ✅ Email sent to test@varsityhub.app
- ✅ Subject: "Your Payment Receipt for..."
- ✅ Contains: Current period or final period indicator
- ✅ Server logs show: "[billing-email] subscription_renewed"

---

### Test 5: Organization Membership Approval

**Trigger:** POST /join-requests/:id/approve

**Steps:**
```bash
# 1. Create organization join request
#    (via UI or API)

# 2. Call approval endpoint
curl -X POST http://localhost:3000/join-requests/[requestId]/approve \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json"

# 3. Check results
```

**Expected Outcome:**
- ✅ Email sent to requester
- ✅ Subject includes: "You've Been Approved"
- ✅ Contains: Organization/team name
- ✅ Server logs show either:
  - "[org-join] membership approval email sent" (new template), OR
  - No warning (means fallback to legacy template was used - also OK)

---

### Test 6: Organization Membership Denial

**Trigger:** POST /join-requests/:id/deny

**Steps:**
```bash
# 1. Create organization join request
#    (via UI or API)

# 2. Call denial endpoint with reason
curl -X POST http://localhost:3000/join-requests/[requestId]/deny \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Does not meet our criteria"}'

# 3. Check results
```

**Expected Outcome:**
- ✅ Email sent to requester
- ✅ Subject includes: "Your Request to Join"
- ✅ Contains: Reason (if provided)
- ✅ Server logs show either:
  - "[org-join] membership denial email sent" (new template), OR
  - No warning (fallback to legacy OK)

---

### Test 7: Event Approval

**Trigger:** PUT /events/:id/approve

**Steps:**
```bash
# 1. Create fan event (will be pending)
#    (via UI or API)

# 2. Call approval endpoint
curl -X PUT http://localhost:3000/events/[eventId]/approve \
  -H "Authorization: Bearer [admin-token]"

# 3. Check results
```

**Expected Outcome:**
- ✅ Email sent to event creator
- ✅ Subject: "Your Event Has Been Approved"
- ✅ Contains: Event name, date, link to view
- ✅ Server logs show: "[events] event approval email sent" or no warning

---

### Test 8: Event Rejection

**Trigger:** PUT /events/:id/reject

**Steps:**
```bash
# 1. Create fan event
#    (via UI or API)

# 2. Call rejection endpoint with reason
curl -X PUT http://localhost:3000/events/[eventId]/reject \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Needs more details about location"}'

# 3. Check results
```

**Expected Outcome:**
- ✅ Email sent to event creator
- ✅ Subject: "Your Event Requires Review"
- ✅ Contains: Event name, rejection reason
- ✅ Server logs show: "[events] event rejection email sent" or no warning

---

### Test 9: Plan Limit Warning

**Trigger:** POST /organizations (when user hits org limit) or POST /teams (when limit hit)

**Steps:**
```bash
# 1. For rookie user, create org (hits limit after 1)
curl -X POST http://localhost:3000/organizations \
  -H "Authorization: Bearer [rookie-token]" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org 1"}'

# 2. Try to create second org (should hit limit)
curl -X POST http://localhost:3000/organizations \
  -H "Authorization: Bearer [rookie-token]" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org 2"}'

# 3. Check results
```

**Expected Outcome:**
- ✅ Email sent to user
- ✅ Subject: "You've Reached Your Limit"
- ✅ Contains: Plan name (Rookie), resource type (organization)
- ✅ Server logs show: "[organizations] plan limit warning email sent" or no warning

---

### Test 10: Security Alert Email

**Trigger:** POST /password/reset (successful password reset)

**Steps:**
```bash
# 1. Request password reset
curl -X POST http://localhost:3000/password/request-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "test@varsityhub.app"}'

# 2. Get reset code (check email or logs)

# 3. Complete reset
curl -X POST http://localhost:3000/password/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "test@varsityhub.app", "code": "[code]", "password": "newpassword123"}'

# 4. Check results
```

**Expected Outcome:**
- ✅ Security alert email sent to test@varsityhub.app
- ✅ Subject: "Security Alert: password_change"
- ✅ Contains: IP address, link to security settings
- ✅ Server logs show: "[security-email] password change alert sent" or no warning

---

## Section 4: Results Documentation (15 minutes)

### 4.1 Create Test Results Report

Create a file: `QA_PHASE_2_RESULTS.md`

```markdown
# QA Phase 2 - Test Results

**Date:** December 12, 2025  
**Tested By:** [QA Engineer Name]  
**Environment:** Staging  
**Status:** [PASS/FAIL]

## Unit Testing
- [x] TypeScript compilation: PASS
- [x] Import/Export verification: PASS
- [x] Type safety checks: PASS

## Integration Testing

### Stripe Webhooks
- [x] Test 1 - Payment Receipt: PASS
- [x] Test 2 - Payment Failed: PASS
- [x] Test 3 - Subscription Canceled: PASS
- [x] Test 4 - Subscription Renewed: PASS

### Organization Membership
- [x] Test 5 - Approval: PASS
- [x] Test 6 - Denial: PASS

### Events
- [x] Test 7 - Event Approval: PASS
- [x] Test 8 - Event Rejection: PASS

### Plan Limits
- [x] Test 9 - Plan Limit Warning: PASS

### Security
- [x] Test 10 - Security Alert: PASS

## Issues Found
None

## Sign-off
**QA Lead Approval:** _____________________  
**Date:** December 12, 2025

**Recommendation:** ✅ READY FOR PRODUCTION
```

---

## Troubleshooting Guide

### Issue: "Email not received"

**Checklist:**
- [ ] Check spam folder (Gmail, Outlook often filter transactional emails)
- [ ] Verify template ID is set in environment
- [ ] Check SendGrid Activity Log → Email Activity
- [ ] Look for bounce/dropped status
- [ ] Check server logs for errors

**Resolution:**
1. If bounced/dropped: Check SendGrid API usage, sender domain authentication
2. If not in Activity Log: Template ID might be wrong, verify in environment
3. If in Activity Log but not received: Email server issue, check spam filters

---

### Issue: "Wrong email variables in template"

**Example:** Template shows `{{plan_name}}` literally instead of actual plan

**Cause:** Variable name mismatch between code and SendGrid template

**Resolution:**
1. Review code in email.ts to see what variable names are sent
2. Update SendGrid template to use exact same variable names (case-sensitive)
3. Verify template uses `{{variable}}` syntax (not `{variable}` or `[variable]`)
4. Resend test email

---

### Issue: "Server logs show '[email] SendGrid * template not configured'"

**Cause:** Template ID environment variable not set or empty

**Resolution:**
1. Verify Phase 1 was completed
2. Check environment variables are set: `echo $SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID`
3. If empty, contact DevOps to add template IDs
4. Restart server after adding environment variables

---

### Issue: "Multiple tests failing, same error"

**Likely Cause:** SendGrid API key invalid or API quota exceeded

**Resolution:**
1. Verify `SENDGRID_API_KEY` is still valid
2. Check SendGrid dashboard for API rate limits
3. Verify email addresses are valid (not fake test addresses)
4. Check that FROM email address is verified in SendGrid

---

## Sign-off Checklist

Before approving Phase 2:

- [ ] All 10 tests executed
- [ ] All 10 tests passed
- [ ] No blocking issues found
- [ ] Email formatting looks good (tested on mobile & desktop)
- [ ] Subject lines are clear and professional
- [ ] Links in emails work correctly
- [ ] Server logs show no errors for email sends
- [ ] SendGrid Activity Log shows successful sends
- [ ] Test results documented
- [ ] QA lead has reviewed and approved

---

## Success Criteria

✅ **Phase 2 is PASS when:**
- All 10 test scenarios execute successfully
- All emails arrive in test inbox
- Email content includes correct dynamic data
- No errors in server logs
- SendGrid shows successful delivery
- QA team signs off

---

## Failure Handling

❌ **If any test fails:**
1. Document the failure in detail
2. Check troubleshooting guide above
3. Review relevant section in `EMAIL_HOOKS_INTEGRATION_SUMMARY.md`
4. Contact backend team if code issue suspected
5. Contact DevOps if configuration issue suspected
6. Do NOT proceed to Phase 3 until all tests pass

---

## Timeline

| Step | Task | Est. Time |
|------|------|-----------|
| 1 | Unit testing | 15 min |
| 2 | Verify staging deployment | 10 min |
| 3 | Execute 10 integration tests | 90 min |
| 4 | Document results & sign-off | 15 min |
| **Total** | **Phase 2 Complete** | **130 minutes** |

---

## Next: Phase 3 - Production Deployment

Once Phase 2 is complete and signed off:

> "Phase 2 QA testing complete. All 10 test scenarios PASS.  
> Ready for Phase 3 - Production Deployment."

**Phase 3 will:**
- Merge code to production
- Deploy to production environment
- Monitor for 30+ minutes
- Confirm all flows working in production

---

**Phase 2 Owner:** QA Team / Engineering  
**Expected Completion:** ~2.5 hours from start  
**Next Phase Owner:** DevOps Team  
**Created:** December 12, 2025
