# Phase 3: Production Deployment - Execution Guide

**Status:** Ready to Execute (after Phase 2 complete & signed off)  
**Owner:** DevOps/Engineering Lead  
**Timeline:** 1 hour  
**Created:** December 12, 2025

---

## Prerequisites

- [ ] Phase 2 QA testing complete & signed off
- [ ] All 10 test scenarios passing
- [ ] Code review approval obtained
- [ ] Product manager sign-off received
- [ ] Production .env has all 9 SendGrid template IDs configured
- [ ] Monitoring dashboards accessible
- [ ] Rollback plan reviewed (see below)
- [ ] Team communication channel ready (Slack)

---

## Pre-Deployment Checklist

### Code Review
- [ ] At least 1 engineer reviewed changes
- [ ] All comments addressed
- [ ] Approved to merge and deploy

### Quality Assurance
- [ ] Phase 2 testing complete
- [ ] All test scenarios passed
- [ ] No blocking issues identified
- [ ] QA lead signed off

### Configuration
- [ ] Production .env has all 9 template IDs set
- [ ] SendGrid API key valid
- [ ] Email domain authenticated in SendGrid
- [ ] Monitoring alerts configured for email failures

### Communication
- [ ] Team notified of deployment time
- [ ] Stakeholders aware of potential impact
- [ ] Rollback team on standby

---

## Deployment Timeline

| Step | Owner | Duration | Status |
|------|-------|----------|--------|
| 1. Pre-flight checks | DevOps | 5 min | ⏳ Pending |
| 2. Code merge | Engineering | 5 min | ⏳ Pending |
| 3. Staging validation | DevOps | 5 min | ⏳ Pending |
| 4. Production deployment | DevOps | 10 min | ⏳ Pending |
| 5. Post-deployment validation | QA/DevOps | 20 min | ⏳ Pending |
| 6. Monitoring (30 min) | DevOps | 30 min | ⏳ Pending |
| **Total** | | **75 minutes** | |

---

## Deployment Steps

### Step 1: Pre-Flight Checks (5 minutes)

```bash
# 1. Verify all tests passing in staging
# Run quick smoke test on staging

curl -X GET http://staging.varsityhub.app/health
# Expected: 200 OK

# 2. Verify production configuration
# SSH to production or check deployment platform
echo $SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID
echo $SENDGRID_PAYMENT_FAILED_TEMPLATE_ID
echo $SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID
echo $SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID
echo $SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID
echo $SENDGRID_EVENT_APPROVED_TEMPLATE_ID
echo $SENDGRID_EVENT_REJECTED_TEMPLATE_ID
echo $SENDGRID_SECURITY_ALERT_TEMPLATE_ID
echo $SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID

# All should show: d-xxxxxxxxxxxxxxxxxxxxx
# If any are empty, STOP and configure before deploying

# 3. Check production logs are accessible
tail -f /var/log/varsity-hub/app.log
# Expected: Can access logs
```

**Sign-off:** `__________` (DevOps) at `____:____ UTC`

---

### Step 2: Code Merge (5 minutes)

```bash
# Option A: If using GitHub (standard flow)
# 1. Go to GitHub → VarsityHubMobile
# 2. Create PR from main to production branch (if separate)
# 3. Or just ensure main has all commits

git log --oneline -5
# Should show commits: f6514b2, 50c09ff (email hooks)

# Option B: If using different merge process
# Follow your standard procedure

# Verify code is ready
git status
# Expected: "On branch main" and "working tree clean"
```

**Sign-off:** `__________` (Engineering) at `____:____ UTC`

---

### Step 3: Staging Validation (5 minutes)

Before deploying to production, run one final check on staging:

```bash
# Quick validation that staging is still working
npm run typecheck -- --noEmit server/src/lib/email.ts
npm run build 2>&1 | grep -i "error" || echo "✅ Build OK"

# Test one email function still works in staging
# Send a test email via staging API
curl -X POST http://staging.varsityhub.app/test/send-email \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_receipt", "to": "test@varsityhub.app"}'

# Should send an email within 10 seconds
```

**Sign-off:** `__________` (DevOps) at `____:____ UTC`

---

### Step 4: Production Deployment (10 minutes)

#### Option A: Vercel Deployment
```bash
# If using Vercel
vercel --prod

# Expected output:
# ✓ Production environment is ready
# ✓ Deploy to production [Y/n] ?
# Y

# Wait for deployment to complete (usually 1-2 minutes)
```

#### Option B: Docker/Kubernetes
```bash
# If using Docker/K8s
docker build -t varsity-hub:v[version] .
docker tag varsity-hub:v[version] [registry]/varsity-hub:latest

# Push to registry
docker push [registry]/varsity-hub:latest

# Update deployment
kubectl set image deployment/varsity-hub-server \
  varsity-hub-server=[registry]/varsity-hub:latest \
  --record

# Watch rollout
kubectl rollout status deployment/varsity-hub-server
```

#### Option C: GitHub Actions / CI/CD Pipeline
```bash
# If using GitHub Actions
git push origin main:production

# GitHub Actions will automatically:
# 1. Run tests
# 2. Build
# 3. Deploy to production
# Monitor the workflow in GitHub > Actions

# Check status
git log --oneline -3
# Should see your deployment commit
```

#### Option D: ECS / AWS
```bash
# If using AWS ECS
aws ecs update-service \
  --cluster varsity-hub-prod \
  --service varsity-hub-server \
  --force-new-deployment

# Monitor
aws ecs describe-services \
  --cluster varsity-hub-prod \
  --services varsity-hub-server \
  | jq '.services[0].deployments'
```

**Sign-off:** `__________` (DevOps) at `____:____ UTC`

**Deployment Complete:** `____:____ UTC`

---

### Step 5: Post-Deployment Validation (20 minutes)

#### 5.1 Server Startup (5 min)

```bash
# Wait for production deployment to complete
sleep 30

# Check health endpoint
curl -X GET https://api.varsityhub.app/health
# Expected: 200 OK

# Check application logs
tail -f /var/log/varsity-hub/app.log | head -50

# Look for:
# ✅ "SendGrid email service initialized"
# OR warning about missing templates (acceptable):
# "[email] SendGrid template IDs missing: ..."
# (means fallback templates will be used)

# Expected startup time: 30-60 seconds
```

**Status:** `✅ Server running` or `❌ Issues detected`

#### 5.2 Email Configuration Verification (5 min)

```bash
# Verify template IDs are loaded
curl -X GET https://api.varsityhub.app/admin/config/email \
  -H "Authorization: Bearer [admin-token]"

# Should return all template IDs
# Or at least show no errors

# Verify SendGrid connectivity
curl -X GET "https://api.sendgrid.com/v3/templates" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" | jq '.templates[0].id'

# Expected: Returns template IDs like "d-xxxxxxxxxxxxxxxxxxxxx"
```

**Status:** `✅ Configuration OK` or `❌ Issues detected`

#### 5.3 Smoke Test - Send One Email (10 min)

Send a test email through each flow to verify production works:

```bash
# Test 1: Trigger payment receipt email
# (Use Stripe webhook test event on production subscription)

curl -X POST https://api.varsityhub.app/payments/webhook \
  -H "stripe-signature: [signature]" \
  -H "Content-Type: application/json" \
  -d '{...invoice.payment_succeeded event...}'

# Check for email in test inbox (10-30 seconds)
# Subject should be: "Your Payment Receipt for..."

# Test 2: Trigger organization membership approval
curl -X POST https://api.varsityhub.app/join-requests/[id]/approve \
  -H "Authorization: Bearer [admin-token]"

# Check for email in test inbox
# Subject should include: "Approved" or fallback message

# Test 3: Trigger event approval
curl -X PUT https://api.varsityhub.app/events/[id]/approve \
  -H "Authorization: Bearer [admin-token]"

# Check for email in test inbox
# Subject should include: "Approved"
```

**Status:** 
- [ ] Payment email received
- [ ] Membership email received  
- [ ] Event email received
- [ ] All emails look correct

---

### Step 6: Monitoring (30 minutes)

**During this period, monitor for issues in real-time.**

#### Monitor Email Delivery

```bash
# Watch SendGrid Activity Log
# https://app.sendgrid.com/email_activity

# Expected:
# ✅ Emails showing up (not bouncing)
# ✅ Delivered rate > 95%
# ✅ No spam complaints
# ✅ No hard bounces

# Set up alerts if rate drops below 90%
```

#### Monitor Application Logs

```bash
# Real-time log monitoring
tail -f /var/log/varsity-hub/app.log | grep -i "email\|sendgrid"

# Expected:
# ✅ No "[email] Failed to send" errors
# ✅ No "SendGrid API" errors
# ✅ No template not found warnings (unless expected)

# If errors appear:
# 1. Note the error message
# 2. Check troubleshooting section below
# 3. May need rollback (see below)
```

#### Monitor User Impact

```bash
# Check support channels for complaints
# Slack #support channel
# Email inbox

# Expected:
# ✅ No spike in support tickets
# ✅ No user reports of missing emails
# ✅ No unsubscribe spikes
```

#### Error Budget

During 30-minute monitoring window, acceptable error rates:
- Email failures: < 1% (1 out of 100 emails)
- API errors: < 0.1%
- Bounce rate: < 0.5%

**If error rate exceeds these, consider rollback.**

---

## Rollback Procedure

**If critical issues detected:**

### Quick Rollback (< 5 minutes)

```bash
# Option 1: Remove template IDs (fastest)
# In production .env, set all template IDs to empty:
SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID=
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=
# ... etc for all 9

# Effect: Emails log warnings but system continues
# App stays online, just no new emails sent
# Users can still complete actions

# Restart application
# (No code changes, just environment change)
```

### Full Rollback (5-10 minutes)

```bash
# Option 2: Revert code to previous version
git revert [commit-hash-of-email-hooks]
git push origin main:production

# Redeploy from previous version
vercel --prod
# Or your deployment process

# Wait for deployment to complete
# Check health endpoint

# Expected: System back to pre-deployment state
# All new email features disabled
# System fully functional otherwise
```

---

## Success Criteria

✅ **Production deployment is SUCCESSFUL when:**
- [ ] Deployment completes without errors
- [ ] Server health check passes
- [ ] Template IDs are configured
- [ ] Smoke tests pass (emails sent/received)
- [ ] SendGrid Activity Log shows deliveries
- [ ] No spike in error logs
- [ ] Support tickets not affected
- [ ] 30-minute monitoring period complete
- [ ] Deployment owner signs off

---

## Post-Deployment (After 30 min monitoring)

### 1. Update Status

```bash
# Create deployment log entry
cat > DEPLOYMENT_LOG.md << EOF
# Email Hooks Production Deployment

**Date:** December 12, 2025  
**Time:** [Start] - [End] UTC  
**Owner:** [DevOps Engineer]  
**Status:** ✅ SUCCESS

## Metrics
- Deployment time: X minutes
- Email delivery rate: 99.X%
- Error rate: < 0.1%
- Bounce rate: < 0.5%
- Support tickets: 0

## Sign-offs
- DevOps: __________
- QA: __________
- Engineering: __________

## Next Steps
- Monitor SendGrid dashboard daily for 1 week
- Check email logs weekly
- Report metrics to team

EOF

git add DEPLOYMENT_LOG.md
git commit -m "Deployment: Email Hooks Production - SUCCESS"
```

### 2. Notify Team

Send message to team:

> "🎉 Email Hooks Production Deployment Complete!
>
> ✅ All systems operational
> ✅ All email flows active
> ✅ 30-minute monitoring complete
> ✅ Zero critical issues
>
> Status: LIVE in production
>
> Next: Phase 4 (frontend bug fixes - separate PR)

---

## Checklist for Deployment Day

- [ ] Pre-flight checks complete
- [ ] Code review approved
- [ ] Phase 2 QA signed off
- [ ] Production .env configured with all 9 template IDs
- [ ] Monitoring dashboards open
- [ ] Team notified & on standby
- [ ] Rollback plan reviewed
- [ ] Deployment executed
- [ ] Smoke tests passed
- [ ] 30-minute monitoring complete
- [ ] All success criteria met
- [ ] Team notified of completion
- [ ] Deployment log created
- [ ] Lessons learned documented

---

## Troubleshooting

### Issue: "Server won't start after deployment"

**Cause:** Environment configuration issue

**Resolution:**
1. Check production logs: `tail -f /var/log/varsity-hub/app.log`
2. Verify all environment variables set correctly
3. Verify SendGrid API key is valid
4. Rollback to previous version if critical

---

### Issue: "Emails not being sent"

**Cause:** Template IDs missing or incorrect

**Resolution:**
1. Check that all 9 template IDs are in environment
2. Verify template IDs match SendGrid console (no typos)
3. Check SendGrid API key is still valid
4. Check email addresses are valid (not fake test addresses)

---

### Issue: "High bounce rate"

**Cause:** Invalid email addresses in production

**Resolution:**
1. Check user email validation in signup flow
2. Review bouncing email addresses in SendGrid
3. Consider implementing email verification earlier in flow

---

### Issue: "Email template shows variable names like {{plan_name}}"

**Cause:** Dynamic template variable mismatch

**Resolution:**
1. Check SendGrid template variable names match code
2. Verify template uses `{{variable}}` syntax
3. Resend test email to verify

---

## Monitoring Schedule (Post-Deployment)

**Week 1:** Daily checks
- Email delivery rate
- Error rates
- Support tickets

**Week 2-4:** Weekly checks
- Overall email metrics
- User feedback
- Performance impact

**After 1 month:** Move to standard monitoring
- Include in weekly DevOps report
- Monitor for trends

---

## Success Metrics

Track these metrics post-deployment:

| Metric | Target | How to Monitor |
|--------|--------|----------------|
| Email Delivery Rate | > 95% | SendGrid Dashboard |
| Bounce Rate | < 1% | SendGrid Activity Log |
| Spam Complaints | < 0.1% | SendGrid Event Webhook |
| Error Rate | < 0.5% | Application Logs |
| Support Impact | 0 new tickets | Support Channel |
| User Feedback | Positive | User reports, surveys |

---

## Timeline Summary

| Phase | Step | Duration | Owner |
|-------|------|----------|-------|
| Phase 3 | Pre-flight checks | 5 min | DevOps |
| | Code merge | 5 min | Engineering |
| | Staging validation | 5 min | DevOps |
| | Production deployment | 10 min | DevOps |
| | Post-deployment validation | 20 min | QA/DevOps |
| | Monitoring | 30 min | DevOps |
| **Total** | **Phase 3 Complete** | **75 minutes** | **Team** |

---

## Next: Phase 4 - Frontend Bug Fixes

After Phase 3 is complete:

> "Phase 3 Production Deployment complete and stable.  
> Ready to proceed with Phase 4 - Frontend Bug Fixes (separate PR)"

**Phase 4 will:**
- Fix app/organizations/[id].tsx (apiBaseUrl issue)
- Fix app/team-invites.tsx (error vs _error)
- Create separate PR (don't block email hooks)
- Merge after email hooks are stable (24+ hours)

---

**Phase 3 Owner:** DevOps/Engineering Lead  
**Expected Completion:** ~75 minutes  
**Next Phase Owner:** Frontend Team  
**Created:** December 12, 2025
