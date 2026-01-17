# Phase 1: SendGrid Template Configuration - Execution Guide

**Status:** Ready to Execute  
**Owner:** DevOps/Platform Team  
**Timeline:** 1-2 hours  
**Created:** December 12, 2025

---

## Overview

This guide walks through creating 9 SendGrid email templates for the email hooks integration. These are **template configuration only** - no code changes needed.

**Note:** This can run in parallel with any other work. No code deploys required until Phase 2.

---

## Prerequisites

- [ ] SendGrid account access (with template creation permission)
- [ ] Access to production .env file
- [ ] Access to staging .env file (if separate)
- [ ] Terminal access to deploy changes
- [ ] Slack/Email for coordination with team

---

## Step-by-Step Execution

### Part 1: Create SendGrid Templates (45 minutes)

#### 1. PAYMENT_RECEIPT Template

**Go to:** SendGrid Console → Settings → Templates → Create Template

**Name:** `PAYMENT_RECEIPT`  
**Subject:** `Your Payment Receipt for {{plan_name}}`

**Dynamic Variables Required:**
```
{{plan_name}}      - e.g., "Veteran Membership"
{{amount}}         - e.g., "$9.99"
{{billing_period}} - e.g., "Dec 12 - Jan 12"
{{invoice_url}}    - link to invoice (optional)
```

**Suggested Email Structure:**
```
Subject: Your Payment Receipt for {{plan_name}}

Hi there,

Thank you for your payment! Here's your receipt:

Plan: {{plan_name}}
Amount: {{amount}}
Billing Period: {{billing_period}}

[View Full Invoice] {{invoice_url}}

Questions? Contact support at support@varsityhub.app

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 2. PAYMENT_FAILED Template

**Name:** `PAYMENT_FAILED`  
**Subject:** `Payment Failed for {{plan_name}} - Action Required`

**Dynamic Variables Required:**
```
{{plan_name}}    - e.g., "Veteran Membership"
{{reason}}       - e.g., "Your card was declined"
{{manage_url}}   - link to manage subscription
```

**Suggested Email Structure:**
```
Subject: Payment Failed for {{plan_name}} - Action Required

We're having trouble processing your payment for {{plan_name}}.

Error: {{reason}}

To retry or update your payment method:
[Update Payment Method] {{manage_url}}

If you need help, contact support@varsityhub.app

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 3. SUBSCRIPTION_CANCELED Template

**Name:** `SUBSCRIPTION_CANCELED`  
**Subject:** `Your {{plan_name}} Subscription Has Been Canceled`

**Dynamic Variables Required:**
```
{{plan_name}}       - e.g., "Veteran Membership"
{{renewal_date}}    - e.g., "2025-01-12" (ISO format)
{{reactivate_url}}  - link to reactivate
```

**Suggested Email Structure:**
```
Subject: Your {{plan_name}} Subscription Has Been Canceled

Your {{plan_name}} subscription has been canceled.

Your access will continue until: {{renewal_date}}

Miss it? Reactivate anytime:
[Reactivate Subscription] {{reactivate_url}}

We'd love to have you back!

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 4. MEMBERSHIP_APPROVED Template

**Name:** `MEMBERSHIP_APPROVED`  
**Subject:** `🎉 You've Been Approved for {{team_name}}`

**Dynamic Variables Required:**
```
{{team_name}}         - e.g., "Basketball Club"
{{org_name}}          - e.g., "State University" (optional)
{{manage_url}}        - link to manage membership
```

**Suggested Email Structure:**
```
Subject: 🎉 You've Been Approved for {{team_name}}

Great news! Your request to join {{team_name}} has been approved!

Organization: {{org_name}}

You can now access all team features:
[View Team] {{manage_url}}

Welcome aboard!

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 5. MEMBERSHIP_DENIED Template

**Name:** `MEMBERSHIP_DENIED`  
**Subject:** `Your Request to Join {{team_name}}`

**Dynamic Variables Required:**
```
{{team_name}}  - e.g., "Basketball Club"
{{org_name}}   - e.g., "State University" (optional)
{{manage_url}} - link to browse other teams
```

**Suggested Email Structure:**
```
Subject: Your Request to Join {{team_name}}

Thank you for your interest in joining {{team_name}}!

Unfortunately, your membership request was not approved at this time.

Browse other teams you can join:
[Explore Teams] {{manage_url}}

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 6. EVENT_APPROVED Template

**Name:** `EVENT_APPROVED`  
**Subject:** `✅ Your Event {{event_name}} Has Been Approved`

**Dynamic Variables Required:**
```
{{event_name}}  - e.g., "Pickup Basketball Game"
{{event_date}}  - e.g., "2025-12-20" (ISO format)
{{review_url}}  - link to view event
```

**Suggested Email Structure:**
```
Subject: ✅ Your Event {{event_name}} Has Been Approved

Excellent! Your event has been approved and is now live on VarsityHub.

Event: {{event_name}}
Date: {{event_date}}

[View Event] {{review_url}}

Start promoting and get players interested!

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 7. EVENT_REJECTED Template

**Name:** `EVENT_REJECTED`  
**Subject:** `Your Event {{event_name}} Needs Review`

**Dynamic Variables Required:**
```
{{event_name}}  - e.g., "Pickup Basketball Game"
{{event_date}}  - e.g., "2025-12-20" (ISO format)
{{review_url}}  - link to view/edit event
{{reason}}      - e.g., "Missing required details" (optional)
```

**Suggested Email Structure:**
```
Subject: Your Event {{event_name}} Needs Review

Your event submission needs a bit more work before it can go live.

{{#if reason}}
Reason: {{reason}}
{{/if}}

[Review & Edit Event] {{review_url}}

We're here to help! Contact support@varsityhub.app if you have questions.

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 8. SECURITY_ALERT Template

**Name:** `SECURITY_ALERT`  
**Subject:** `⚠️ Security Alert: {{alert_type}}`

**Dynamic Variables Required:**
```
{{alert_type}}  - e.g., "password_change" (or new_device, email_change)
{{ip_address}}  - e.g., "192.168.1.1"
{{location}}    - e.g., "San Francisco, CA" (optional)
{{manage_url}}  - link to security settings
```

**Suggested Email Structure:**
```
Subject: ⚠️ Security Alert: {{alert_type}}

We detected a security event on your VarsityHub account.

Action: {{alert_type}}
{{#if ip_address}}IP Address: {{ip_address}}{{/if}}
{{#if location}}Location: {{location}}{{/if}}

If this wasn't you, secure your account immediately:
[Manage Security Settings] {{manage_url}}

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

#### 9. PLAN_LIMIT_WARNING Template

**Name:** `PLAN_LIMIT_WARNING`  
**Subject:** `You've Reached Your {{plan_name}} {{resource_type}} Limit`

**Dynamic Variables Required:**
```
{{plan_name}}        - e.g., "Rookie" (or Veteran, Legend)
{{resource_type}}    - "team" or "organization"
{{used_count}}       - e.g., "3"
{{limit}}            - e.g., "3" (or "Unlimited")
{{upgrade_url}}      - link to upgrade plan
```

**Suggested Email Structure:**
```
Subject: You've Reached Your {{plan_name}} {{resource_type}} Limit

You've reached the maximum number of {{resource_type}}s for your plan.

Current Plan: {{plan_name}}
{{resource_type | capitalize}}s Created: {{used_count}}/{{limit}}

Upgrade your plan to create more:
[View Upgrade Options] {{upgrade_url}}

---
VarsityHub Team
```

**Save & Note Template ID:** `d-xxxxxxxxxxxxxxxxxxx`

---

### Part 2: Collect Template IDs (5 minutes)

After creating all 9 templates, you'll have 9 Template IDs in the format: `d-xxxxxxxxxxxxxxxxxxxxxxxx`

**Create a tracking document:**

```
SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID=d-[from step 1]
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=d-[from step 2]
SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID=d-[from step 3]
SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID=d-[from step 4]
SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID=d-[from step 5]
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-[from step 6]
SENDGRID_EVENT_REJECTED_TEMPLATE_ID=d-[from step 7]
SENDGRID_SECURITY_ALERT_TEMPLATE_ID=d-[from step 8]
SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID=d-[from step 9]
```

**⚠️ IMPORTANT:** Keep these IDs safe - you'll use them in the next step.

---

### Part 3: Add Template IDs to Environment (10 minutes)

#### For Staging Environment

```bash
# SSH into staging server or open your deployment platform
# Edit .env.staging (or staging secrets)

# Add all 9 template IDs:
SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID=d-...
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=d-...
SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID=d-...
SENDGRID_MEMBERSHIP_APPROVED_TEMPLATE_ID=d-...
SENDGRID_MEMBERSHIP_DENIED_TEMPLATE_ID=d-...
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-...
SENDGRID_EVENT_REJECTED_TEMPLATE_ID=d-...
SENDGRID_SECURITY_ALERT_TEMPLATE_ID=d-...
SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID=d-...

# Save and redeploy staging
```

#### For Production Environment

```bash
# Use your deployment platform's secrets management
# (e.g., GitHub Actions Secrets, Vercel Secrets, AWS Secrets Manager, etc.)

# Add all 9 template IDs to production secrets
# DO NOT commit .env to git
```

---

### Part 4: Verification (5 minutes)

After configuration, verify the setup:

```bash
# On staging server
# Check that environment variables are set
echo $SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID
# Should output: d-...

# Check SendGrid connectivity
curl -X GET "https://api.sendgrid.com/v3/templates" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" | grep -i "payment_receipt" || echo "Template not found"
```

---

## Checklist

### Creation Phase
- [ ] PAYMENT_RECEIPT template created → Template ID: `d-________________`
- [ ] PAYMENT_FAILED template created → Template ID: `d-________________`
- [ ] SUBSCRIPTION_CANCELED template created → Template ID: `d-________________`
- [ ] MEMBERSHIP_APPROVED template created → Template ID: `d-________________`
- [ ] MEMBERSHIP_DENIED template created → Template ID: `d-________________`
- [ ] EVENT_APPROVED template created → Template ID: `d-________________`
- [ ] EVENT_REJECTED template created → Template ID: `d-________________`
- [ ] SECURITY_ALERT template created → Template ID: `d-________________`
- [ ] PLAN_LIMIT_WARNING template created → Template ID: `d-________________`

### Configuration Phase
- [ ] All template IDs added to staging .env
- [ ] All template IDs added to production secrets
- [ ] Staging redeployed
- [ ] Environment variables verified on staging
- [ ] SendGrid connectivity confirmed

### Documentation Phase
- [ ] Template IDs documented in secure location
- [ ] Team notified that Phase 1 is complete
- [ ] Next steps (Phase 2 - QA Testing) communicated

---

## Troubleshooting

### Issue: "Template not found in SendGrid"

**Solution:**
1. Verify template was actually created (check SendGrid console)
2. Make sure you copied the full Template ID (including `d-`)
3. Check that the API key is correct

### Issue: "Environment variable not being read"

**Solution:**
1. Verify you used the correct variable name (exact case matters)
2. Restart the application after adding .env changes
3. Confirm the secrets manager is properly configured

### Issue: "Emails not sending with template"

**Solution:**
- This is expected until Phase 2 configuration is complete
- Check server logs for warnings about missing templates
- Verify template ID in environment matches SendGrid

---

## Timeline

| Step | Task | Est. Time |
|------|------|-----------|
| 1 | Create 9 SendGrid templates | 45 min |
| 2 | Collect template IDs | 5 min |
| 3 | Add to environment | 10 min |
| 4 | Verify setup | 5 min |
| **Total** | **Phase 1 Complete** | **65 minutes** |

---

## Next: Phase 2 - QA Testing

Once Phase 1 is complete, notify the QA team:

> "Phase 1 complete. Template IDs configured and deployed to staging.  
> Ready to begin Phase 2 - QA Testing."

**Phase 2 will:**
- Run unit/import tests
- Execute Stripe webhook sandbox tests
- Verify all email flows work correctly
- Sign off on production readiness

---

## Support

**Questions?** Refer to:
- `EMAIL_HOOKS_INTEGRATION_SUMMARY.md` - Technical details
- `EMAIL_HOOKS_NEXT_STEPS.md` - Full deployment guide
- `EMAIL_HOOKS_QUICK_REFERENCE.md` - Troubleshooting

---

**Phase 1 Owner:** DevOps/Platform Team  
**Expected Completion:** ~1 hour from start  
**Next Phase Owner:** QA Team  
**Created:** December 12, 2025
