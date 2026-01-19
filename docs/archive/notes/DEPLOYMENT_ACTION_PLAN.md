# 🚀 DEPLOYMENT ACTION PLAN - IMMEDIATE NEXT STEPS

**Last Updated:** December 15, 2025  
**Status:** 🟢 Backend Code is Production Ready  
**Blockers:** SendGrid template upload + Railway env vars (non-code tasks)

---

## ⚡ QUICK START (30 Minutes Total)

### STEP 1: SendGrid Template Upload (20 min) ⏳ START HERE
**Link:** https://app.sendgrid.com/dynamic_templates  
**Action:** Upload these 5 HTML templates

| # | Template Name | Description | Variables Needed |
|---|---|---|---|
| 1 | Account Warning | First violation notice | user_name, report_id, violation_type, warning_reason, appeal_url |
| 2 | Content Removed | Content deletion notice | user_name, report_id, content_type, removal_reason, appeal_url |
| 3 | 7-Day Suspension | One-week account lock | user_name, suspension_days, suspension_date, reinstatement_date, appeal_url |
| 4 | 45-Day Suspension | 45-day account lock | user_name, suspension_days, suspension_date, reinstatement_date, appeal_url |
| 5 | Permanent Ban | Account termination | user_name, ban_reason, appeal_url |

**Templates Location:** Check your email template files or ask for HTML content  
**After Upload:** Copy each Template ID (looks like `d-abc123xyz`)

---

### STEP 2: Save Template IDs (1 min)
**Action:** Create a notepad with these 5 entries:

```
SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID = d-[YOUR_ID_HERE]
SENDGRID_CONTENT_REMOVED_TEMPLATE_ID = d-[YOUR_ID_HERE]
SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID = d-[YOUR_ID_HERE]
SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID = d-[YOUR_ID_HERE]
SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID = d-[YOUR_ID_HERE]
```

---

### STEP 3: Add to Railway (2 min)
**Link:** https://railway.app → VarsityHub Project → Variables  
**Action:** Add 5 environment variables from Step 2  
**Format:** Name = Value (exactly as above, including `d-` prefix)

---

### STEP 4: Deploy (2 min)
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
git add -A
git commit -m "feat: severity-based email system for abuse reports"
git push railway main
```

**Monitor:** Go to Railway dashboard → Logs tab  
**Expected:** No `TEMPLATE_ID missing` errors

---

### STEP 5: Smoke Test (5 min)
**Test:** Send 1 warning email to verify end-to-end flow

```bash
# From project root
curl -X PATCH http://localhost:3000/admin/reports/TEST_REPORT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "status": "resolved",
    "severity": "warning",
    "resolution_note": "Test warning email"
  }'
```

**Verify:**
- [ ] Response status: 200
- [ ] Email arrives in test inbox within 30 seconds
- [ ] Appeal button opens email client
- [ ] DB shows `suspension_until: null` (no suspension for warning)

---

## 📋 FULL E2E TEST SUITE (After Smoke Test Passes)

Run these 6 test cases to validate all severity levels:

### Test Case 1: Warning (No Suspension)
```bash
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID_1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "resolved", "severity": "warning"}'

# Expect:
# - Email sent to violator
# - offense_count += 1
# - suspension_until = null
```

### Test Case 2: Content Removal (No Suspension)
```bash
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID_2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "resolved", "severity": "content_removal"}'

# Expect:
# - Email sent to violator
# - offense_count += 1
# - suspension_until = null
```

### Test Case 3: 7-Day Suspension
```bash
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID_3 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "resolved", "severity": "suspend_7_days"}'

# Expect:
# - Email sent to violator with suspension details
# - suspension_until = now + 7 days
# - User cannot login until reinstatement_date
```

### Test Case 4: 45-Day Suspension
```bash
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID_4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "resolved", "severity": "suspend_45_days"}'

# Expect:
# - Email sent to violator with 45-day lock
# - suspension_until = now + 45 days
# - User blocked from all account features
```

### Test Case 5: Permanent Ban
```bash
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID_5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "resolved", "severity": "permanent_ban"}'

# Expect:
# - Email sent with permanent ban notice
# - permanent_ban = true in database
# - User account is permanently locked (no reinstatement date)
```

### Test Case 6: Dismissed (No Violator Email)
```bash
curl -X PATCH http://localhost:3000/admin/reports/REPORT_ID_6 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "dismissed"}'

# Expect:
# - NO email sent to violator
# - Reporter email sent (existing behavior)
# - User account unaffected
```

---

## ✅ VERIFICATION CHECKLIST

After all tests pass, verify:

- [ ] All 6 test cases returned status 200
- [ ] All 5 severity emails arrived in inbox
- [ ] Appeal buttons work in email client (click → opens compose)
- [ ] Database shows correct suspension_until dates:
  - warning: `null`
  - content_removal: `null`
  - suspend_7_days: `+7 days from now`
  - suspend_45_days: `+45 days from now`
  - permanent_ban: `permanent_ban = true`
- [ ] Railway logs show no errors
- [ ] SendGrid activity shows all 5 emails delivered

---

## 🔧 TROUBLESHOOTING

### Issue: "Missing or invalid SendGrid template ID"
**Solution:** 
1. Go to Railway → Variables
2. Verify all 5 template IDs start with `d-`
3. Copy exact IDs from SendGrid (no extra spaces)
4. Redeploy: `git push railway main`

### Issue: Email not arriving
**Solution:**
1. Check Railway logs: `railway logs` → search for "warning email"
2. Check SendGrid dashboard: Suppression List (bounced?)
3. Verify test email address is real and not on bounce list
4. Try different email domain (Gmail/Outlook vs corporate)

### Issue: Database not updating
**Solution:**
1. Check auth token is valid (admin user)
2. Verify report ID exists: `curl http://localhost:3000/admin/reports`
3. Check server logs for Prisma errors
4. Confirm suspension_until is datetime format in database

### Issue: API returns 401 Unauthorized
**Solution:**
1. Get fresh admin token: Login as admin → check auth header
2. Ensure `Bearer` prefix is included in Authorization header
3. Verify admin user has `is_admin: true` in database

---

## 📞 SUPPORT CONTACTS

**If deployment breaks:**
1. Check Railway logs first
2. Verify all 5 template IDs are set in Railway Variables
3. Rollback: `git revert HEAD && git push railway main`

**Code Questions:**
- Email functions: `/server/src/lib/email.ts` (lines 617-793)
- Sanctions logic: `/server/src/routes/adminReports.ts` (lines 100-188)
- Tests: `/server/src/__tests__/adminReports.test.ts`

---

## 🎯 SUCCESS CRITERIA

✅ **Deployment is successful when:**
1. TypeScript build passes (confirmed ✓)
2. All 5 template IDs in Railway (next step)
3. All 6 test cases return 200 (next step)
4. All 5 emails arrive in inbox (next step)
5. Database shows correct suspension dates (next step)
6. Railway logs show 0 errors (next step)

---

## 📅 TIMELINE

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | SendGrid Template Upload | 20 min | ⏳ TODO |
| 2 | Add Template IDs to Railway | 2 min | ⏳ TODO |
| 3 | Deploy to Railway | 2 min | ⏳ TODO |
| 4 | Smoke Test (1 email) | 5 min | ⏳ TODO |
| 5 | Full E2E Tests (6 cases) | 10 min | ⏳ TODO |
| **TOTAL** | | **39 min** | |

**Estimated Launch:** Within 1 hour of starting Phase 1

---

## 🎁 BONUS: Frontend Integration

**For frontend team:**
- Template: `/FIGMA_APPEAL_FLOW_PROMPT.md`
- Design: 6 screens (Warning, Content Removed, 7-Day, 45-Day, Ban, Appeal)
- Can be designed in parallel while backend deploys

---

**READY?** Start with Step 1 above! 🚀
