# Email Hooks: Next Steps & Action Items

**Status:** Implementation Complete | Configuration & Testing Pending  
**Created:** December 12, 2025

---

## Quick Summary

The email hooks integration adds 7 new SendGrid templates connected to core backend flows:

| Flow                          | Trigger                         | Email Function                | Template ID Needed    | Fallback                   |
| ----------------------------- | ------------------------------- | ----------------------------- | --------------------- | -------------------------- |
| Stripe: Payment Success       | invoice.payment_succeeded       | sendPaymentReceiptEmail       | PAYMENT_RECEIPT       | ❌ None                    |
| Stripe: Payment Failed        | invoice.payment_failed          | sendPaymentFailedEmail        | PAYMENT_FAILED        | ❌ None                    |
| Stripe: Subscription Canceled | customer.subscription.deleted   | sendSubscriptionCanceledEmail | SUBSCRIPTION_CANCELED | ❌ None                    |
| Stripe: Subscription Renewed  | customer.subscription.updated   | sendPaymentReceiptEmail       | PAYMENT_RECEIPT       | ❌ None                    |
| Org Join: Approved            | POST /join-requests/:id/approve | sendMembershipDecisionEmail   | MEMBERSHIP_APPROVED   | ✅ sendJoinRequestApproved |
| Org Join: Denied              | POST /join-requests/:id/deny    | sendMembershipDecisionEmail   | MEMBERSHIP_DENIED     | ✅ sendJoinRequestDenied   |
| Event: Approved               | PUT /events/:id/approve         | sendEventDecisionEmail        | EVENT_APPROVED        | ❌ None                    |
| Event: Rejected               | PUT /events/:id/reject          | sendEventDecisionEmail        | EVENT_REJECTED        | ❌ None                    |
| Plan Limit: Orgs/Teams        | POST endpoints                  | sendPlanLimitWarningEmail     | PLAN_LIMIT_WARNING    | ❌ None                    |
| Security: Password Reset      | POST /password/reset            | sendSecurityAlertEmail        | SECURITY_ALERT        | ❌ None                    |

---

## 🚀 Action Items (In Priority Order)

### Phase 1: Configuration (Required for Testing)

**Owner:** DevOps/Platform Team  
**Timeline:** 1-2 hours

#### 1.1 Create 9 New SendGrid Templates

**In SendGrid Console:**

1. **PAYMENT_RECEIPT** - "Your Payment Receipt for {plan_name}"
   - Dynamic variables: plan_name, amount, billing_period, invoice_url
   - Suggested content:
     - Confirmation that payment was successful
     - Plan name and amount
     - Billing period (e.g., "Monthly plan: Dec 12 - Jan 12")
     - Link to view invoice (if available)
     - CTAs: Manage subscription, contact support

2. **PAYMENT_FAILED** - "Payment Failed for {plan_name}"
   - Dynamic variables: plan_name, reason, manage_url
   - Content: Error message, what went wrong, how to update payment method

3. **SUBSCRIPTION_CANCELED** - "Your Subscription Has Been Canceled"
   - Dynamic variables: plan_name, renewal_date, reactivate_url
   - Content: Confirmation, when it ends, how to reactivate, CTAs

4. **MEMBERSHIP_APPROVED** - "You're Approved! Welcome to {team_name}"
   - Dynamic variables: team_name, org_name, manage_url
   - Content: Approval notification, team info, next steps, manage link

5. **MEMBERSHIP_DENIED** - "Your Request to Join {team_name}"
   - Dynamic variables: team_name, org_name, manage_url
   - Content: Denial notification, reason (if provided), other opportunities

6. **EVENT_APPROVED** - "Your Event {event_name} Has Been Approved"
   - Dynamic variables: event_name, event_date, review_url
   - Content: Approval, event details, view event link, share options

7. **EVENT_REJECTED** - "Your Event {event_name} Requires Review"
   - Dynamic variables: event_name, event_date, review_url, reason
   - Content: Rejection, reason, review URL, how to resubmit

8. **SECURITY_ALERT** - "Security Alert: {alert_type}"
   - Dynamic variables: alert_type, ip_address, location, manage_url
   - Content: Alert details, action taken, manage security settings link
   - Note: Currently only used for password_change, but reserved for new_device, email_change

9. **PLAN_LIMIT_WARNING** - "You've Hit Your {resource_type} Limit"
   - Dynamic variables: plan_name, resource_type, used_count, limit, upgrade_url
   - Content: Warning, current usage, limit, benefits of upgrading, upgrade link

#### 1.2 Add Template IDs to Environment Configuration

**In production .env:**

```bash
SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID=d-[ID from step 1.1.1]
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=d-[ID from step 1.1.2]
SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID=d-[ID from step 1.1.3]
SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID=d-[ID from step 1.1.4]
SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID=d-[ID from step 1.1.5]
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-[ID from step 1.1.6]
SENDGRID_EVENT_REJECTED_TEMPLATE_ID=d-[ID from step 1.1.7]
SENDGRID_SECURITY_ALERT_TEMPLATE_ID=d-[ID from step 1.1.8]
SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID=d-[ID from step 1.1.9]
```

**In staging .env:** Repeat with staging template IDs (or reuse if testing only)

#### 1.3 Deploy Configuration to Staging

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
# Update staging .env with new template IDs
git add .env.staging
git commit -m "Config: Add SendGrid template IDs for email hooks"
git push origin main

# Redeploy staging
# (command depends on your deployment process)
```

---

### Phase 2: Testing (Required before Production)

**Owner:** QA Team / Engineering  
**Timeline:** 2-3 hours
**Prerequisites:** Phase 1 complete

#### 2.1 Unit/Import Testing

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Verify imports and exports
npm run typecheck -- --noEmit server/src/lib/email.ts
npm run typecheck -- --noEmit server/src/routes/payments.ts
npm run typecheck -- --noEmit server/src/routes/organizations.ts
npm run typecheck -- --noEmit server/src/routes/events.ts
npm run typecheck -- --noEmit server/src/routes/auth.ts

# Verify compilation
npm run build 2>&1 | grep -E "error|Email|sendPayment|sendEvent|sendMembership|sendSecurity|sendPlanLimit" || echo "✅ No errors related to email hooks"
```

#### 2.2 Stripe Webhook Sandbox Testing

**Tools Needed:**

- Stripe CLI: `stripe listen --forward-to localhost:3000/payments/webhook`
- Test credit cards (from Stripe docs)
- ngrok or similar for local webhook testing

**Test Scenarios:**

1. **Scenario: Successful Membership Payment**

   ```
   1. Start: npm run dev (server and client)
   2. Stripe CLI: stripe listen --forward-to http://localhost:3000/payments/webhook
   3. User: Create membership checkout session (POST /subscribe)
   4. Capture: Session ID from response
   5. Webhook: stripe trigger invoice.payment_succeeded --add object.customer_email=test@example.com
   6. Expect: sendPaymentReceiptEmail called with correct params
   7. Verify: Check server logs for "[billing-email] Payment receipt email sent" or SendGrid email delivery logs
   ```

2. **Scenario: Payment Failure**

   ```
   1. Same setup as #1
   2. Webhook: stripe trigger invoice.payment_failed --add object.customer_email=test@example.com
   3. Expect: sendPaymentFailedEmail called
   4. Verify: Check logs and SendGrid
   ```

3. **Scenario: Subscription Renewal**

   ```
   1. Create active subscription first
   2. Webhook: stripe trigger customer.subscription.updated --add object.status=active
   3. Expect: sendPaymentReceiptEmail called with "Current period" or "Final period"
   4. Verify: Check logs
   ```

4. **Scenario: Subscription Cancellation**
   ```
   1. Create active subscription
   2. Webhook: stripe trigger customer.subscription.deleted
   3. Expect: sendSubscriptionCanceledEmail called
   4. Verify: Check logs
   ```

#### 2.3 Organization Membership Testing

```bash
# Test join request approval (with fallback)
curl -X POST http://localhost:3000/join-requests/[requestId]/approve \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json"

# Expect:
# - If MEMBERSHIP_APPROVED template configured: sendMembershipDecisionEmail sent
# - If not configured: sendJoinRequestApproved (legacy) sent
# Check logs for confirmation
```

#### 2.4 Event Management Testing

```bash
# Test event approval
curl -X PUT http://localhost:3000/events/[eventId]/approve \
  -H "Authorization: Bearer [token]"

# Expect: sendEventDecisionEmail called with approved=true
# Check logs for: "[events] Failed to send event approval email:" (if fails) or success logs

# Test event rejection
curl -X PUT http://localhost:3000/events/[eventId]/reject \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Does not comply with community guidelines"}'

# Expect: sendEventDecisionEmail called with approved=false and reason
```

#### 2.5 Plan Limit Testing

```bash
# Rookie user attempts to create org (should hit limit after 1)
# Expect: sendPlanLimitWarningEmail called
# Check logs for: "[organizations] Failed to send plan limit warning email:" or success

# Same for teams
```

#### 2.6 Security Alert Testing

```bash
# Complete password reset flow
1. POST /auth/password/request-reset (get code)
2. POST /auth/password/reset (submit new password)

# Expect: sendSecurityAlertEmail called with alertType='password_change'
# Check logs for confirmation
```

---

### Phase 3: Production Deployment

**Owner:** DevOps/Engineering Lead  
**Timeline:** 1 hour
**Prerequisites:** Phase 2 complete with all tests passing

#### 3.1 Code Review & Approval

- [ ] Review `EMAIL_HOOKS_INTEGRATION_SUMMARY.md` for architecture
- [ ] Code review: changes to payments.ts, organizations.ts, events.ts, teams.ts, auth.ts
- [ ] Verify all imports are correct
- [ ] Verify all template IDs have fallbacks or error handling
- [ ] Approve for production

#### 3.2 Merge to Production

```bash
# Ensure all changes are committed
git status
# Should be clean, all changes committed

# Verify main branch is up to date
git log --oneline -5

# Merge strategy: FF or squash depending on your workflow
# Example:
git merge --ff-only origin/main
# or
git rebase origin/main
```

#### 3.3 Update Production Environment

```bash
# Add template IDs to production .env
# Verify all 9 template IDs are set
SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID=...
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=...
SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID=...
SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID=...
SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID=...
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=...
SENDGRID_EVENT_REJECTED_TEMPLATE_ID=...
SENDGRID_SECURITY_ALERT_TEMPLATE_ID=...
SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID=...

# Note: Do NOT commit .env to git
# Use your deployment platform's secrets management (GitHub Actions, Vercel, AWS, etc.)
```

#### 3.4 Deploy to Production

```bash
# Depends on your deployment process, e.g.:
# If using Vercel:
vercel --prod

# If using Docker/K8s:
docker build -t varsity-hub:latest .
kubectl set image deployment/varsity-hub-server \
  varsity-hub-server=varsity-hub:latest

# If using CI/CD (GitHub Actions, GitLab CI):
# Push to production branch and let CI handle it
git push origin main:production
```

#### 3.5 Verify Production Deployment

```bash
# Check server logs for initialization
tail -f [production-logs]
# Should see: "✅ SendGrid email service initialized"

# Run smoke test
# Create a test membership transaction or event approval
# Verify email arrives in your test inbox

# Monitor for 30 minutes
# Check logs for any send failures
# Monitor SendGrid dashboard for delivery status
```

---

### Phase 4: Bug Fixes (Separate PRs)

**Owner:** Frontend Team  
**Timeline:** 1-2 hours
**Note:** These are PRE-EXISTING issues, not caused by email hooks

#### 4.1 Fix app/organizations/[id].tsx

Issue: `Property 'apiBaseUrl' does not exist on type 'AppConfig'`

**Fix:**

```typescript
// app/organizations/[id].tsx line 24
// Change from:
const { apiBaseUrl } = useAppConfig();

// To:
const config = useAppConfig();
const apiBaseUrl = config.apiUrl || config.API_URL || 'https://api.varsityhub.app';
```

Also fix routing issues on lines 86, 93:

- `/contact` → check if this should be `/notifications` or removed
- `/join-organization` → check if this should be `/organizations`

#### 4.2 Fix app/team-invites.tsx

Issue: `Cannot find name 'error'. Did you mean '_error'?`

**Fix:**

```typescript
// app/team-invites.tsx line 66
// Change from:
const { error } = useSearchParams();

// To:
const { _error } = useSearchParams();

// And update references:
if (_error) {
  // handle error
}
```

---

## Monitoring & Maintenance

### Post-Deployment (First Week)

1. **Check Email Delivery Logs**
   - Monitor SendGrid dashboard for bounce/spam rates
   - Target: <1% bounce rate, <0.1% spam complaints
   - Action: Investigate any failures

2. **Check Application Logs**
   - Look for "[billing-email]", "[events]", "[organizations]" warnings
   - Pattern: "[*] Failed to send \* email" = template not configured or SendGrid error
   - Action: Check template IDs, retry manually if needed

3. **Verify Email Content**
   - Check emails arriving in test accounts
   - Verify all dynamic variables populated correctly
   - Verify links work and go to correct pages
   - Check for rendering issues on mobile/desktop

4. **Monitor User Feedback**
   - Watch for user reports of missed emails
   - Check analytics for clicks on email links
   - Monitor bounce/unsubscribe rates

### Ongoing Maintenance

1. **Template Updates**
   - If you need to change email copy, update in SendGrid (don't redeploy code)
   - If you add new dynamic variables, must update code AND template

2. **Email Variable Validation**
   - Ensure all formatUsd(), formatDateFromUnix(), etc. return expected formats
   - Monitor for null/undefined variables in SendGrid bounce logs

3. **Scale Considerations**
   - Email service is async (non-blocking)
   - At scale (10k+ emails/day), consider queue system (Bull, RabbitMQ)
   - Currently: Direct SendGrid API calls should handle moderate volume

---

## Rollback Plan

If critical issues found in production:

### Option 1: Quick Disable (Keep Code, Disable Templates)

```bash
# Remove template IDs from production .env
# Set all SENDGRID_*_TEMPLATE_ID to empty string or ""
# Redeploy

# Effect: All new email functions will:
# - Log warning "[email] SendGrid * template not configured"
# - Return false
# - Fall back to legacy if available (org membership only)
# - No-op for others (acceptable, users won't get new emails)

# Recovery: Restore template IDs in .env, redeploy
```

### Option 2: Revert Code (Full Rollback)

```bash
git revert [commit-hash-of-email-integration]
git push origin main:production
# Redeploy from previous version
```

**Note:** Option 1 preferred (keeps features, disables new email) unless critical bug in code logic.

---

## Success Criteria

✅ **Testing is Complete When:**

- [ ] All 6 Stripe webhook scenarios tested successfully
- [ ] All organization membership emails sent correctly
- [ ] All event approval/rejection emails sent correctly
- [ ] All plan limit warning emails sent correctly
- [ ] Security alert emails sent on password reset
- [ ] No errors in application logs
- [ ] All emails render correctly on mobile/desktop
- [ ] QA team signs off

✅ **Production Ready When:**

- [ ] Code review approved
- [ ] All tests passing
- [ ] All template IDs configured
- [ ] Monitoring/alerting set up
- [ ] Team trained on new flows
- [ ] Rollback plan documented (above)

---

## Contacts & Escalation

- **SendGrid Issues:** Check dashboard.sendgrid.com > Email Activity, Event Webhook
- **Stripe Webhook Issues:** Check Stripe Dashboard > Developers > Webhooks > Event Attempts
- **Server Logs:** Check your hosting platform logs (Vercel, AWS, Heroku, etc.)
- **Email Not Arriving:** Check spam folder, SendGrid bounce logs, test with noreply@sendgrid.com

---

## Timeline Summary

| Phase       | Task                             | Est. Time     | Owner          |
| ----------- | -------------------------------- | ------------- | -------------- |
| **Phase 1** | Configure SendGrid + Environment | 1-2 hours     | DevOps         |
| **Phase 2** | Testing (all scenarios)          | 2-3 hours     | QA/Engineering |
| **Phase 3** | Production Deployment            | 1 hour        | DevOps         |
| **Phase 4** | Bug Fixes (separate PRs)         | 1-2 hours     | Frontend       |
| **Total**   |                                  | **5-8 hours** | Team           |

---

**Next Immediate Action:**
👉 **Contact DevOps team to begin Phase 1 (SendGrid configuration)**

---

Created: December 12, 2025  
Email Hooks Integration Project
