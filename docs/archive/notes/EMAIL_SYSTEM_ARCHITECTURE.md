# VarsityHub Email System Architecture & Flow

**Complete Overview of Email Infrastructure**

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                     VarsityHub Application                       │
│  (Web App / Mobile App / Backend Services)                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Triggers Email Event
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Email Module (/server/src/lib/email.ts)    │
│                                                                   │
│  27 Exported Functions:                                          │
│  ├─ sendPasswordResetEmail()                 ✅ Patched          │
│  ├─ sendPasswordChangedEmail()               ✅ Patched          │
│  ├─ sendAccountRecoveryEmail()               ✅ Patched          │
│  ├─ sendVerificationEmail()                  ✅ Ready            │
│  ├─ sendOrganizationInvitationEmail()        ✅ Ready            │
│  ├─ sendTeamInvitationEmail()                ✅ Ready            │
│  ├─ sendAthleteInvitationEmail()             ✅ Ready            │
│  ├─ sendRoleAssignmentEmail()                ✅ Ready            │
│  ├─ sendRosterThresholdEmail()               ✅ Ready            │
│  ├─ sendInvitationDeclinedEmail()            ✅ Ready            │
│  ├─ sendTeamRosterUpdateEmail()              ✅ Ready            │
│  ├─ sendUserConfirmationEmail()              ✅ Ready            │
│  ├─ sendMemberRemovedEmail()                 ✅ Ready            │
│  ├─ sendPaymentFailedEmail()                 ✅ Ready            │
│  ├─ sendReportResolutionEmail()              ✅ Ready            │
│  ├─ sendEventSubmissionReceivedEmail()       ✅ Ready            │
│  ├─ sendEventApprovedEmail()                 ✅ Ready            │
│  ├─ sendEventDeniedEmail()                   ✅ Ready            │
│  ├─ sendEventReminderEmail()                 ✅ Ready            │
│  ├─ sendEventUpdatedEmail()                  ✅ Ready            │
│  ├─ sendEventCanceledEmail()                 ✅ Ready            │
│  ├─ sendAccountWarningEmail()                ✅ Ready            │
│  ├─ sendContentRemovedEmail()                ✅ Ready            │
│  ├─ sendAccountSuspensionEmail()             ✅ Ready            │
│  ├─ sendAccountPermanentBanEmail()           ✅ Ready            │
│  ├─ sendEventRsvpConfirmedEmail()            ✅ Ready            │
│  ├─ sendLoginFromNewDeviceEmail()            ✅ Ready            │
│  ├─ sendStaffMemberJoinedEmail()             ✅ Ready            │
│  └─ sendSubscriptionExpiringEmail()          ✅ Ready            │
│                                                                   │
│  Each function:                                                  │
│  1. Validates SENDGRID_API_KEY                                   │
│  2. Checks template ID env var                                   │
│  3. Maps params → dynamicTemplateData (snake_case)              │
│  4. Calls sgMail.send() with templateId                         │
│  5. Returns success/failure status                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Passes:
                 │ - Template ID (from env var)
                 │ - To: recipient email
                 │ - dynamicTemplateData: {token: value}
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SendGrid API                                    │
│        (Environment: SENDGRID_API_KEY)                           │
│                                                                   │
│  sgMail.send({                                                   │
│    to: recipient@example.com,                                    │
│    from: noreply@varsityhub.app,                                │
│    templateId: d-xxxxxxxxxxxxx,                                 │
│    dynamicTemplateData: { user_name, event_date, ... }          │
│  })                                                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Looks up template
                 │ Renders with data
                 │ Queues for delivery
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              SendGrid Templates (29 total)                       │
│                                                                   │
│  Each template contains:                                         │
│  ├─ <subject>Email Subject Line</subject>                       │
│  ├─ Handlebars syntax: {{token_name}}                           │
│  ├─ Conditionals: {{#if field}}...{{/if}}                       │
│  ├─ Arrays: {{#each items}}...{{/each}}                         │
│  ├─ HTML/CSS formatting                                         │
│  └─ Footer with policy links                                    │
│                                                                   │
│  Template ID Environment Variables:                             │
│  ├─ SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxx...              │
│  ├─ SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-xxx...              │
│  ├─ SENDGRID_REPORT_RESOLVED_TEMPLATE_ID=d-xxx...             │
│  └─ ... (29 total)                                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Sends to
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Email Client                                 │
│                                                                   │
│  User receives:                                                  │
│  ├─ Rendered HTML email                                          │
│  ├─ All tokens populated with real data                         │
│  ├─ Links working (https://varsityhub.app/...)                  │
│  ├─ Professional formatting                                     │
│  └─ Privacy/Community Guidelines footer links                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 DATA FLOW: Example "Event Approved" Email

```
Application Code:
├─ Event approved by admin
├─ Trigger: events.update() → status="approved"
└─ Call sendEventApprovedEmail(params)

                        │
                        ▼

Backend Function (sendEventApprovedEmail):
┌─────────────────────────────────────────┐
│ Function receives:                      │
│ {                                       │
│   to: "coach@school.edu",               │
│   coachName: "Mike Johnson",             │
│   eventName: "Varsity Football",         │
│   eventDate: "Friday, Jan 24, 2025",     │
│   eventTime: "7:00 PM CT",               │
│   eventLocation: "Stadium",              │
│   opponent: "Central High",              │
│   organizationName: "Lincoln High",      │
│   approvalNotes: "Great event!",         │
│   eventLink: "https://varsityhub.app/...",
│   manageLink: "https://varsityhub.app/..."
│ }                                       │
└─────────────────────────────────────────┘

                        │
                        │ Maps to:
                        ▼

SendGrid dynamicTemplateData:
┌─────────────────────────────────────────┐
│ {                                       │
│   coach_name: "Mike Johnson",           │
│   event_name: "Varsity Football",       │
│   event_date: "Friday, Jan 24, 2025",   │
│   event_time: "7:00 PM CT",             │
│   event_location: "Stadium",            │
│   opponent: "Central High",             │
│   organization_name: "Lincoln High",    │
│   approval_notes: "Great event!",       │
│   event_link: "https://...",            │
│   manage_link: "https://...",           │
│   privacy_policy_url: "https://...",    │
│   community_guidelines_url: "https://..." │
│ }                                       │
└─────────────────────────────────────────┘

                        │
                        │ Sent to SendGrid API with:
                        │ - templateId: d-e76de0670704646938e05a28e4c1a20d3
                        │ - dynamicTemplateData: {...}
                        │ - to: coach@school.edu
                        │
                        ▼

SendGrid Template HTML:
┌─────────────────────────────────────────┐
│ <subject>Event Approved: {{event_name}}  │
│ </subject>                              │
│                                         │
│ <html>                                  │
│   Hello {{coach_name}},                 │
│                                         │
│   Your event "{{event_name}}" has been  │
│   approved! It's scheduled for:         │
│                                         │
│   📅 {{event_date}} at {{event_time}}   │
│   📍 {{event_location}}                 │
│   🏁 vs {{opponent}}                    │
│                                         │
│   Notes: {{approval_notes}}             │
│                                         │
│   <a href="{{event_link}}">View Event   │
│   </a>                                  │
│   <a href="{{manage_link}}">Manage      │
│   </a>                                  │
│                                         │
│   <footer>                              │
│     <a href="{{privacy_policy_url}}">   │
│     Privacy</a> |                       │
│     <a href="{{community_guidelines_url│
│     }}">Guidelines</a>                  │
│   </footer>                             │
│ </html>                                 │
└─────────────────────────────────────────┘

                        │
                        │ Renders to:
                        ▼

Rendered Email (what coach receives):
┌─────────────────────────────────────────┐
│ Subject: Event Approved: Varsity Football│
│                                         │
│ Hello Mike Johnson,                     │
│                                         │
│ Your event "Varsity Football" has been  │
│ approved! It's scheduled for:           │
│                                         │
│ 📅 Friday, Jan 24, 2025 at 7:00 PM CT  │
│ 📍 Stadium                              │
│ 🏁 vs Central High                      │
│                                         │
│ Notes: Great event!                     │
│                                         │
│ [View Event]  [Manage]                  │
│                                         │
│ Privacy | Guidelines                    │
└─────────────────────────────────────────┘
```

---

## 🔐 SECURITY LAYERS

```
Layer 1: API Authentication
├─ SENDGRID_API_KEY stored in Railway env vars (not in code)
├─ Never logged or exposed
└─ Used only for sgMail.send() calls

Layer 2: Data Validation
├─ Each function checks SENDGRID_API_KEY exists
├─ Each function checks template ID exists in TEMPLATE_IDS
├─ Parameters validated at function call site
└─ Error handling with debug logging

Layer 3: Template Security
├─ No hardcoded sensitive data in templates
├─ All URLs parameterized from backend
├─ Canonical domain (varsityhub.app) used consistently
├─ HTML sanitized by SendGrid before delivery
└─ Footer includes privacy & guidelines links

Layer 4: Parameter Sanitization
├─ All params passed as dynamicTemplateData
├─ No code injection possible (Handlebars-based)
├─ Token values rendered as text, not HTML
└─ User-provided content safely escaped
```

---

## 📈 SCALABILITY

```
Current Setup:
├─ 27 backend functions
├─ 29 SendGrid templates
├─ No rate limiting (SendGrid handles up to 300 emails/sec)
├─ Asynchronous sending (returns promise)
└─ No email queue needed (SendGrid manages delivery)

Handles:
├─ Event-driven: ~100 events/day typical
├─ Triggered: ~50 manual invitations/day
├─ Transactional: ~20 account actions/day
└─ Bulk: User confirmations (~5/day)

Total: ~200-300 emails/day easily sustained
```

---

## 🔄 DEPLOYMENT PIPELINE

```
Step 1: Local Development
├─ Edit backend code (email.ts)
├─ Test with SENDGRID_API_KEY in .env.local
└─ Verify emails send correctly

Step 2: Git Commit
├─ Commit changes to main branch
├─ Include patched email functions
├─ Push to GitHub
└─ Trigger CI/CD

Step 3: Railway Deployment
├─ Railway detects push
├─ Builds backend Docker image
├─ Runs tests (no errors)
├─ Deploys to production
└─ Sets env vars from Railway dashboard

Step 4: Template Configuration
├─ Create templates in SendGrid (separate from code)
├─ Copy template IDs
├─ Add to Railway env vars
├─ No code changes needed

Step 5: Testing
├─ Send test email from app
├─ Verify receipt in inbox
├─ Check token rendering
├─ Confirm link functionality
└─ Monitor SendGrid dashboard
```

---

## 📊 TEMPLATE CATEGORIES & COUNT

```
Security & Auth (5)              ███░░░░░░ 16%
├─ Password Reset
├─ Password Changed
├─ Account Recovery
├─ Email Verification
└─ Login New Device

Org & Team (10)                  ██████░░░ 32%
├─ Organization Invitation
├─ Team Invitation
├─ Athlete Invitation
├─ Role Assignment
├─ Roster Threshold
├─ Invitation Declined
├─ Team Roster Update
├─ Staff Member Joined
├─ Member Removed
└─ User Confirmation

Billing (2)                       █░░░░░░░░ 6%
├─ Payment Failed
└─ Subscription Expiring

Events (7)                        ██████░░░ 23%
├─ Event Submission
├─ Event Approved
├─ Event Denied
├─ Event Reminder
├─ Event Updated
├─ Event Cancelled
└─ Event RSVP

Moderation (7)                    ██████░░░ 23%
├─ Report Dismissed
├─ Report Resolved
├─ Account Warning
├─ Content Removed
├─ Suspension 7-day
├─ Suspension 45-day
└─ Permanent Ban

TOTAL: 31 templates (with variants)
```

---

## 🎯 TOKEN NAMING CONVENTION

All tokens use **snake_case** (underscore-separated):

```
✅ Correct Tokens:
  {{user_name}}
  {{privacy_policy_url}}
  {{community_guidelines_url}}
  {{report_id}}
  {{suspension_duration}}
  {{payment_method_last4}}

❌ Incorrect Formats:
  {{userName}}           # camelCase
  {{PRIVACY_POLICY_URL}} # UPPERCASE
  {{PrivacyPolicyUrl}}   # PascalCase
```

This is critical because backend sends snake_case and templates expect snake_case.

---

## 📱 RESPONSIVE DESIGN

All templates should be:

- Mobile-responsive (tested on iPhone, Android)
- Support dark mode (many clients default)
- Text-only fallback (for email clients that strip CSS)
- Accessible (proper alt text, semantic HTML)
- Fast-loading (optimize images, minimal external resources)

---

## ✅ FINAL VERIFICATION CHECKLIST

Before deploying to production:

```
Backend Code:
[✅] All 27 functions exported correctly
[✅] 3 functions patched with privacy/community URLs
[✅] Snyk security scan PASSED
[✅] Code compiles without errors
[✅] No console errors in logs

SendGrid:
[ ] 29 templates created
[ ] All have <subject> tags
[ ] All tested with provided payloads
[ ] All template IDs copied correctly

Railway:
[ ] SENDGRID_API_KEY set
[ ] All 29 template ID env vars set
[ ] EMAIL_FROM configured
[ ] Deployment completed

Testing:
[ ] Test email sent and received
[ ] All tokens rendered correctly
[ ] Links are working
[ ] Formatting looks professional
[ ] Footer links present
```

---

## 🚀 YOU ARE HERE

```
Timeline:
Phase 1: Backend Code       ✅ COMPLETE
├─ Function audit
├─ Apply patches
├─ Security scan
└─ Documentation

Phase 2: SendGrid Setup     ⏳ IN PROGRESS (You are here)
├─ Create templates
├─ Test templates
└─ Copy template IDs

Phase 3: Railway Deploy     ⏳ PENDING
├─ Add env vars
└─ Trigger deployment

Phase 4: Production Test    ⏳ PENDING
├─ Send test emails
├─ Monitor delivery
└─ Activate for users
```

Next step: Follow SENDGRID_QUICK_REFERENCE.md to create templates.

---

**System Status: ✅ READY FOR SENDGRID SETUP**

All backend infrastructure complete and verified.
Waiting on SendGrid template configuration.
