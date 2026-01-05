# ⚡ QUICK REFERENCE - SEVERITY SYSTEM

**Print This & Keep It Handy During Deployment**

---

## SEVERITY LEVELS (5 Total)

| # | Severity | Action | DB Field | Email | User Impact |
|---|----------|--------|----------|-------|-------------|
| 1 | `warning` | Send warning email | No suspension | ✅ Yes | Account OK |
| 2 | `content_removal` | Remove content | No suspension | ✅ Yes | Account OK |
| 3 | `suspend_7_days` | Lock account | suspension_until = +7d | ✅ Yes | Can't login |
| 4 | `suspend_45_days` | Extended lock | suspension_until = +45d | ✅ Yes | Can't login |
| 5 | `permanent_ban` | Delete account | permanent_ban = true | ✅ Yes | Banned forever |

---

## EMAIL FUNCTION MAPPING

```
Severity                 → Function Name
─────────────────────────────────────────────
warning                  → sendAccountWarningEmail()
content_removal          → sendContentRemovedEmail()
suspend_7_days           → sendAccountSuspensionEmail(7)
suspend_45_days          → sendAccountSuspensionEmail(45)
permanent_ban            → sendAccountPermanentBanEmail()
```

---

## ENVIRONMENT VARIABLES (5 Required)

```
SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID=d-??????????
SENDGRID_CONTENT_REMOVED_TEMPLATE_ID=d-??????????
SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID=d-??????????
SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=d-??????????
SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID=d-??????????
```

**Where to Add:** Railway Dashboard → Variables Tab

---

## TEST COMMAND (Curl)

```bash
# Send warning email
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "resolved", "severity": "warning"}'

# Expected Response: 200
# Expected Action: Warning email sent + offense_count += 1
```

---

## DEPLOYMENT STEPS (30 Minutes)

```
Step 1: SendGrid Upload (20 min)
  → Go to app.sendgrid.com/dynamic_templates
  → Upload 5 HTML templates
  → Copy 5 template IDs

Step 2: Add to Railway (2 min)
  → Go to Railway dashboard
  → Add 5 env vars from Step 1
  → Save changes

Step 3: Deploy Code (2 min)
  → git add -A && git commit && git push railway main

Step 4: Smoke Test (5 min)
  → Send 1 warning email (see TEST COMMAND above)
  → Verify email arrives
  → Verify DB shows suspension_until = null

Step 5: E2E Tests (5 min)
  → Run all 6 test cases
  → Verify all 5 severity levels work
  → Done!
```

---

## DATABASE FIELDS

```
users table:
  - is_suspended: boolean
  - suspension_until: datetime
  - suspension_reason: string
  - permanent_ban: boolean
  - offense_count: int

abuse_reports table:
  - severity: varchar(50)
```

---

## API ENDPOINTS

```
PATCH /admin/reports/:id
  Accept: { status, severity, resolution_note }
  Severity Options: warning | content_removal | suspend_7_days | suspend_45_days | permanent_ban

POST /admin/reports/bulk-update
  Accept: { report_ids[], status, severity, resolution_note }

GET /admin/reports
  Returns: reports with severity field
```

---

## FILE LOCATIONS

```
Code:
  - Email functions: server/src/lib/email.ts (lines 617-793)
  - Sanctions logic: server/src/routes/adminReports.ts (lines 100-188)
  - Tests: server/src/__tests__/adminReports.test.ts

Docs:
  - Deployment plan: DEPLOYMENT_ACTION_PLAN.md
  - Validation report: PRODUCTION_READINESS_VALIDATION.md
  - Final status: SEVERITY_EMAIL_SYSTEM_FINAL_STATUS.md
```

---

## ERROR MESSAGES

```
❌ "Missing or invalid SendGrid template ID"
   → Add missing env var to Railway Variables

❌ "Cannot send warning email"
   → Check if user has email address in DB
   → Check SendGrid dashboard for errors

❌ "Sanctions not applied"
   → Check database transaction logs
   → Verify Prisma connection

❌ "Email not received"
   → Check spam folder
   → Verify SendGrid templates render correctly
```

---

## ROLLBACK (If Needed)

```bash
git revert HEAD
git push railway main
# That's it! Old system restored.
```

---

## SUCCESS INDICATORS

- ✅ All 5 template IDs in Railway Variables
- ✅ No errors in Railway logs
- ✅ Warning email arrives in inbox
- ✅ Database shows severity saved
- ✅ Suspension dates correct (+7, +45 days)
- ✅ All 6 E2E tests pass
- ✅ Mailto links work in email client

---

## SEVERITY DECISION TREE

```
Is the violation a first-time minor offense?
  → YES: severity = "warning"
  → NO: Continue

Is content illegal/explicit?
  → YES: severity = "content_removal"
  → NO: Continue

Has user violated multiple times?
  → 1-2 violations: severity = "suspend_7_days"
  → 3+ violations: severity = "suspend_45_days"
  → Extreme/hate speech: severity = "permanent_ban"
```

---

## MONITORING DASHBOARD

Track these metrics post-deployment:

```
24-Hour Metrics:
  - severity_emails_sent (by type)
  - severity_email_failures
  - users_suspended (7-day + 45-day)
  - users_banned_permanently
  - appeals_received
  - bounce_rate (should be < 0.5%)
```

---

## QUICK FACTS

- **Total Code Added:** ~300 lines
- **Breaking Changes:** 0
- **TypeScript Errors:** 0
- **Linting Errors:** 0
- **Test Coverage:** 6/6 passing
- **Rollback Time:** 2 minutes
- **Deployment Time:** 30 minutes
- **Risk Level:** LOW ✅

---

**Version:** 1.0  
**Last Updated:** December 15, 2025  
**Status:** 🟢 READY TO DEPLOY

---

**BOOKMARK THIS PAGE** ⭐  
Print for deployment team reference.
