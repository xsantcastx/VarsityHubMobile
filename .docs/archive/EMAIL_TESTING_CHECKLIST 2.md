# 📋 Email System Testing Checklist

**Purpose:** Validate that all 40+ email templates are working correctly in production mode  
**Timeline:** 30-60 minutes after SendGrid updates complete  
**Prerequisite:** All SendGrid template updates must be completed (subjects, image URLs, variables)  
**Test Account:** emilmancero@gmail.com (configured as default test email)

---

## Pre-Testing Verification

### ✅ Environment Setup (5 minutes)

- [ ] SendGrid templates all updated and published
- [ ] `.env` file has `SENDGRID_API_KEY=` set correctly
- [ ] `server/.env` has all 40 template IDs configured
- [ ] Backend `server/src/lib/email.ts` deployed with latest changes
- [ ] Test email account (emilmancero@gmail.com) active and accessible
- [ ] Email client/Gmail open and ready to receive test emails
- [ ] JSON results file cleared: `rm -f test-results.json`

---

## Test Execution

### 🚀 Run Email Test Suite (2 minutes)

```bash
# Run comprehensive test
npx tsx scripts/test-all-emails.ts

# Expected output: 
# ✅ All 28+ tests shown
# 📊 SUCCESS RATE: 100%
```

**Success Criteria:**
- [ ] No fatal errors during test run
- [ ] Console shows `SUCCESS RATE: 100%` (or close to it)
- [ ] `test-results.json` file created in project root
- [ ] All email send functions reported as "✅ SENT"

---

## Manual Email Verification

### 📧 **Check Test Email Inbox (10-15 minutes)**

Wait 1-2 minutes for emails to arrive, then systematically verify each category:

#### 1️⃣ **Auth & Security Emails (5 emails)**

Check inbox for these 5 emails:

- [ ] **Verification Email**
  - Subject: Should contain "Verify Your Email" or similar
  - Variables: Name "Emil" should appear personalized
  - Action link: Verification code should be present
  - Images: Logo should load without clicking "Show Images"

- [ ] **Password Reset Email**
  - Subject: Should contain "Reset Your Password" or similar
  - Variables: Name "Emil" should appear
  - Action link: Reset code or link should be clickable
  - Style: Button should be properly styled (not plain text)

- [ ] **Password Changed Email**
  - Subject: Should contain "Password Changed" or similar
  - Variables: Name "Emil" and date should appear
  - Confirmation: Should confirm change was requested
  - Safety info: Should include security tips

- [ ] **Account Recovery Email**
  - Subject: Should contain "Recover Your Account" or similar
  - Variables: Name "Emil" and recovery code present
  - Urgency: Should feel appropriately urgent
  - Time-sensitive: Should mention time limit if applicable

- [ ] **Login from New Device Email**
  - Subject: Should contain "New Login Attempt" or similar
  - Variables: Device type "iPhone 15", location "Dallas, TX" shown
  - Device info: Should be accurate and detailed
  - Action: Allow/deny action should be available if applicable

**Verification Notes:**
```
✓ Subject lines must be clear and descriptive
✓ All variables must populate (name, code, date, device, location)
✓ Images must load automatically (HTTPS URLs working)
✓ Action buttons must be properly styled (not plain links)
```

---

#### 2️⃣ **Moderation & Trust Emails (8 emails)**

Check for these 8 emails:

- [ ] **Report Resolved - Resolved Status**
  - Subject: Should reference "Report Resolution"
  - Variables: Report ID (rep_001), resolution status ("resolved")
  - Reason: Should show "Issue has been addressed"
  - Appeal link: Should be present and clickable

- [ ] **Report Dismissed Email**
  - Subject: Should reference "Report Dismissed" 
  - Variables: Report ID (rep_002), reason present
  - Dismissal reason: "No violation found" should show
  - Appeal link: Should be available

- [ ] **Account Warning Email**
  - Subject: Should reference "Account Warning"
  - Variables: Report ID (rep_003), violation type ("Harassment")
  - Message: Should be clear about policy violation
  - Appeal link: Should be clickable

- [ ] **Content Removed Email**
  - Subject: Should reference "Content Removed"
  - Variables: Report ID (rep_004), content type ("Post")
  - Reason: "Hate speech" should be displayed
  - Appeal link: Should be present

- [ ] **Suspension (7 Days)**
  - Subject: Should reference "Suspension" + duration
  - Variables: 7 days, dates should show correctly
  - Duration: Should clearly state 7-day suspension
  - Reinstatement: Date should be calculated correctly

- [ ] **Suspension (45 Days)**
  - Subject: Should reference "Suspension" + duration
  - Variables: 45 days, all dates present
  - Duration: Should state 45 days
  - Appeal: Appeal URL should be working

- [ ] **Permanent Ban**
  - Subject: Should reference "Account Permanently Banned"
  - Variables: Report ID (rep_007), violation type present
  - Severity: Should feel appropriate to violation
  - Appeal link: Should be present (last chance to appeal)

**Verification Notes:**
```
✓ Suspension emails must show correct day counts (7 vs 45)
✓ All dates must be formatted correctly
✓ Appeal links must be functional and unique per email
✓ Violation types must match what was sent
```

---

#### 3️⃣ **Event Management Emails (8 emails)**

Check for these 8 emails:

- [ ] **Event Submission Received**
  - Subject: Should reference "Event Submitted" or "Submission Received"
  - Variables: Event name "Elite Showcase 2025", date "Friday, January 24, 2025"
  - Details: Time "6:00 PM", location "Dallas, TX" shown
  - Timeframe: "24-48 hours" review mentioned
  - Action: Dashboard link should work

- [ ] **Event Approved**
  - Subject: Should reference "Event Approved"
  - Variables: Event name, date, time, location all shown
  - Confirmation: Should congratulate event creator
  - Action: Event detail link should be clickable

- [ ] **Event Denied**
  - Subject: Should reference "Event Denied" or "Submission Denied"
  - Variables: Event details shown (name, date, time, location)
  - Reason: "Missing required documentation" displayed
  - Action: Resubmit link should be available

- [ ] **Event Reminder**
  - Subject: Should reference "Event Reminder" or "Upcoming Event"
  - Variables: Person name "Emil", event name, date, time
  - Reminder type: Should indicate it's a reminder
  - Action: Event detail link should work

- [ ] **Event Updated**
  - Subject: Should reference "Event Updated"
  - Variables: Updated fields ("Location and time") shown
  - New details: New date/time/location should be displayed
  - Action: Event detail link current

- [ ] **Event Canceled**
  - Subject: Should reference "Event Canceled"
  - Variables: Event details and reason ("Weather conditions")
  - Reason: Should be clear why canceled
  - Action: Event detail link should be present

- [ ] **Event RSVP Confirmed**
  - Subject: Should reference "RSVP Confirmed"
  - Variables: User name "Emil", event name, date, time, location
  - Confirmation: RSVP confirmed at (date/time) shown
  - Calendar: Calendar link should be present
  - Cancel: Cancel RSVP link should work

**Verification Notes:**
```
✓ Event details (name, date, time, location) must all be present
✓ Dates must be formatted consistently
✓ Action links must be different for each email type
✓ Event-specific variables must populate from backend
```

---

#### 4️⃣ **Team & Organization Emails (9 emails)**

Check for these 9 emails:

- [ ] **Organization Invitation**
  - Subject: Should reference "Organization Invitation"
  - Variables: Organization name "Texas Elite Sports", inviter "Director Johnson"
  - Role: "Coach" should be shown
  - Action: Accept link should be unique and clickable

- [ ] **Team Invitation**
  - Subject: Should reference "Team Invitation"
  - Variables: Recipient name "Emil", team "Dallas Lady Tigers"
  - Inviter: "Coach Smith" shown
  - Role: "Player" displayed
  - Actions: Accept and decline links both present

- [ ] **Athlete Invitation**
  - Subject: Should reference "Athlete Invitation"
  - Variables: Inviter "Coach Smith", athlete name, team, role
  - Details: Position "Forward" shown
  - Actions: Accept and decline links available

- [ ] **Role Assignment**
  - Subject: Should reference "Role Assigned" or similar
  - Variables: Assignee name "Emil", role "Team Admin"
  - Context: "Granted by Director Johnson" shown
  - Organization: "Texas Elite Sports" mentioned
  - Action: Dashboard link works

- [ ] **Roster Threshold**
  - Subject: Should reference "Roster Limit"
  - Variables: Team name, current size (18), limit (20)
  - Warning: Should indicate approaching roster limit
  - Action: Manage roster link should work

- [ ] **Invitation Declined**
  - Subject: Should reference "Invitation Declined"
  - Variables: Invitee name, role, team name shown
  - Message: Should acknowledge decline
  - Next steps: Should suggest next action
  - Action: Dashboard link present

- [ ] **Team Roster Update**
  - Subject: Should reference "Roster Update"
  - Variables: Team name, updated by "Coach Smith"
  - Changes: "Added 2 new players" summary shown
  - Action: Roster link should work

- [ ] **Staff Member Joined**
  - Subject: Should reference "Staff Member Joined"
  - Variables: Staff name "Coach Taylor", role "Assistant Coach"
  - Team: "Dallas Lady Tigers" mentioned
  - Action: Staff dashboard link works

- [ ] **User Confirmation**
  - Subject: Should reference "Welcome" or "Account Confirmed"
  - Variables: Organization "Texas Elite Sports", name "Emil"
  - Greeting: Should be personalized
  - Action: Dashboard link should work

**Verification Notes:**
```
✓ All invitation links must be unique (not duplicated)
✓ Personal names must populate correctly
✓ Organization/team names must match what was sent
✓ Role assignments must display the actual role
```

---

#### 5️⃣ **Billing & Payment Emails (2 emails)**

Check for these 2 emails:

- [ ] **Payment Failed**
  - Subject: Should reference "Payment Failed" or "Payment Issue"
  - Variables: Last 4 digits (4242), amount ($49.99), plan ("Pro Plan")
  - Dates: Failed date and retry date should show
  - Urgency: Should feel appropriately urgent
  - Actions: Update payment link and support link should work

- [ ] **Subscription Expiring**
  - Subject: Should reference "Subscription Expiring" or "Renewal Coming"
  - Variables: Plan name, renewal date, price ($49.99)
  - Reminder: Should clearly indicate coming renewal
  - Options: Change plan and cancel links both available
  - Action: Billing portal link should work

**Verification Notes:**
```
✓ Payment amounts and last 4 digits must be accurate
✓ Dates must be formatted consistently
✓ Links must lead to correct billing pages
✓ Payment methods must be referenced securely
```

---

## Detailed Verification Checklist

### 🔍 **For Each Email Received, Check:**

**1. Subject Line** (Most Critical)
```
□ Subject line is present (NOT blank)
□ Subject is descriptive and clear
□ Subject indicates email type (e.g., "Email Verified", "Event Reminder")
□ Subject contains relevant details (name, event, team, etc.) when appropriate
```

**2. Images & Styling**
```
□ Logo/images load immediately (NO "Show Images" click required)
□ Images have HTTPS URLs (checked in source)
□ All colors and fonts display correctly
□ Buttons are styled properly (NOT plain text links)
□ Layout is not broken or misaligned
```

**3. Variables & Personalization**
```
□ Personal name (Emil) appears throughout email
□ Event names, team names, organization names match what was sent
□ Dates are formatted consistently (MM/DD/YYYY or similar)
□ Times are shown with timezone (or consistent 24/12-hour format)
□ Amounts/prices show with correct currency ($)
□ Numbers are formatted correctly (separators for large numbers)
```

**4. Links & Actions**
```
□ All action links are present and clickable
□ Links are properly formatted (NOT wrapped/broken)
□ Links appear to go to correct domain (varsityhub.app)
□ Multiple links are DIFFERENT (not duplicated)
□ Special links (accept/decline, approve/deny) are unique per email
```

**5. Content & Tone**
```
□ Message is clear and understandable
□ Email has appropriate tone for type (urgent for security, friendly for invites)
□ Instructions are clear if action is needed
□ Contact info/support link is present
□ Footer has correct company info (VarsityHub)
```

---

## Troubleshooting Guide

### ❌ Email Not Received

**Check:**
- [ ] Spam/Junk folder (move to Inbox if found)
- [ ] Wait additional 2-3 minutes (sometimes slow)
- [ ] Check email address is correct: `emilmancero@gmail.com`
- [ ] Run test script again: `npx tsx scripts/test-all-emails.ts`
- [ ] Check `test-results.json` for which emails failed
- [ ] Check SendGrid dashboard for delivery errors

**If Still Missing:**
- [ ] Verify SendGrid API key is correct
- [ ] Verify template IDs are correct in `server/.env`
- [ ] Check SendGrid Suppressions tab (email might be suppressed)
- [ ] Verify backend can access SendGrid (check logs)

### ⚠️ Subject Line Missing

**Indicates:** SendGrid template not configured with subject line

**Fix:**
- [ ] Go to SendGrid > Dynamic Templates
- [ ] Click on each template showing missing subject
- [ ] Go to "Settings" tab
- [ ] Add subject line (copy from FIGMA_SENDGRID_PROMPT.md)
- [ ] Retest email after saving

### 🖼️ Images Not Loading (Require "Show Images")

**Indicates:** HTTP URLs still in template (should be HTTPS)

**Fix:**
- [ ] Check email source/raw (right-click > View Message Source)
- [ ] Look for `<img src="http://...">` (should be `https://`)
- [ ] Go to SendGrid template HTML
- [ ] Replace all `http://` with `https://` in image URLs
- [ ] Retest email after saving

### 🔄 Variables Not Populating

**Indicates:** Variable names in template don't match backend

**Fix:**
1. Check which variables are missing:
   - [ ] Check in test email (variables appear blank or as {{variable}})
2. Identify the template name
3. Go to `server/src/lib/email.ts`
4. Find the email function (e.g., `sendEventRsvpConfirmedEmail`)
5. Check what variables are being sent
6. Update SendGrid template to match variable names
7. Test again

**Example:**
- If template has `{{event_name}}` but backend sends `eventName`
- Either: (a) Change template to `{{eventName}}`
- Or: (b) Change backend to send `event_name` too (already fixed in 3 templates)

---

## Test Result Documentation

### 📊 **After Testing, Record:**

```markdown
**Test Date:** [Date/Time]
**Tester:** [Your Name]
**Test Email:** emilmancero@gmail.com

**Results Summary:**
- Total Emails Tested: 28+
- Emails Received: [X]/28+
- Emails with Issues: [Y]/28+
- Success Rate: [X/28+ × 100]%

**Category Summary:**
- Auth & Security: [X]/5 ✓
- Moderation & Trust: [X]/8 ✓
- Event Management: [X]/8 ✓
- Team & Organization: [X]/9 ✓
- Billing & Payment: [X]/2 ✓

**Issues Found:**
1. [Template name]: [Issue description]
2. [Template name]: [Issue description]
...

**Status:**
- [ ] ALL TESTS PASS - Ready for production
- [ ] MINOR ISSUES - Can proceed with fixes post-launch
- [ ] CRITICAL ISSUES - Must fix before production launch
```

---

## Sign-Off

**Checklist Complete:** Date: _______ Time: _______

**Tested By:** _________________ **Verified By:** _________________

**Ready for Production Deployment?** YES / NO / WITH EXCEPTIONS

---

## Notes

- **Total Emails to Verify:** 28+ emails across 5 categories
- **Estimated Time:** 30-60 minutes
- **Must Pass:** Subject lines + image loading + variable population
- **Nice to Have:** Additional styling, advanced animations
- **Blocking Issues:** Missing subjects, broken images, unpopulated variables
- **Non-Blocking Issues:** Minor styling differences, font variations (can fix in follow-up)

