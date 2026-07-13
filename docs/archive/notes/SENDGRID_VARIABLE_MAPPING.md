# 🔴 CRITICAL: SendGrid Template Variable Mapping

## The Real Problem

Your SendGrid TEMPLATES are expecting SPECIFIC variable names that DO NOT match what your backend is sending.

From your SendGrid dashboard inspection, here are the exact variables each template expects:

---

## 1. Team Invitation Template

**Template ID:** `d-14788def39174bb66bf186716cce166fa`

### What SendGrid Expects (from template HTML):

```
{{recipientName}}
{{teamName}}
{{inviterName}}
{{role}}
{{acceptLink}}
{{declineLink}}
{{privacyPolicyUrl}}
{{communityGuidelinesUrl}}
```

### What Your Backend Currently Sends:

```javascript
(recipientName,
  recipient_name,
  teamName,
  team_name,
  inviterName,
  inviter_name,
  role,
  inviteLink,
  accept_link,
  declineLink,
  decline_link,
  privacy_policy_url,
  community_guidelines_url);
```

### ISSUE:

❌ Variable names use camelCase in template, backend sends snake_case too
❌ Backend sends `inviteLink` but template expects `acceptLink`

---

## 2. Account Suspension (45 Days) Template

**Template ID:** `d-0941019230d9459b81ff602d937f7aa04`

### What SendGrid Expects:

```
{{userN ame}}
{{reportId}}
{{violationType}}
{{suspensionDays}} OR {{suspensionDuration}}
{{suspensionDate}}
{{reinstatementDate}}
{{suspensionReason}}
{{appealUrl}}
{{communityGuidelinesUrl}}
{{privacyPolicyUrl}}
```

### What Your Backend Currently Sends:

```javascript
user_name, userName, report_id, reportId, violation_type, violationType,
suspension_days, suspensionDays, suspension_duration, suspensionDuration,
suspension_date, suspensionDate, reinstatement_date, reinstatementDate,
suspension_reason, suspensionReason, appeal_url, appealUrl, etc.
```

### ISSUE:

✅ Actually looks correct - backend sends both formats

---

## 3. Event RSVP Confirmed Template

**Template ID:** `d-511e46f4646f974f18a8f33c12564de14b`

### What SendGrid Expects:

```
{{userName}}
{{eventName}}
{{eventDate}}
{{eventTime}}
{{eventLocation}}
{{rsvpConfirmedAt}}
{{organizationName}}
{{eventDetailLink}}
{{calendarLink}}
{{cancelRsvpLink}}
{{privacyPolicyUrl}}
{{communityGuidelinesUrl}}
```

### What Your Backend Currently Sends:

```javascript
(user_name,
  userName,
  event_name,
  eventName,
  event_date,
  eventDate,
  event_time,
  eventTime,
  event_location,
  eventLocation,
  rsvp_confirmed_at,
  rsvpConfirmedAt,
  organization_name,
  organizationName,
  event_detail_link,
  eventDetailLink,
  calendar_link,
  calendarLink,
  cancel_rsvp_link,
  cancelRsvpLink,
  privacy_policy_url,
  community_guidelines_url);
```

### ISSUE:

✅ Actually looks correct - backend sends both formats

---

## ✅ SOLUTION: Fix in SendGrid Dashboard

**You MUST edit each template and change the Handlebars variables to use CONSISTENT naming**

### Option 1: Make SendGrid Templates Use snake_case (Recommended)

Edit each template in SendGrid and change:

```
{{userName}} → {{user_name}}
{{eventName}} → {{event_name}}
{{eventDate}} → {{event_date}}
{{eventTime}} → {{event_time}}
{{eventLocation}} → {{event_location}}
{{rsvpConfirmedAt}} → {{rsvp_confirmed_at}}
{{organizationName}} → {{organization_name}}
{{eventDetailLink}} → {{event_detail_link}}
{{calendarLink}} → {{calendar_link}}
{{cancelRsvpLink}} → {{cancel_rsvp_link}}
{{privacyPolicyUrl}} → {{privacy_policy_url}}
{{communityGuidelinesUrl}} → {{community_guidelines_url}}
{{recipientName}} → {{recipient_name}}
{{teamName}} → {{team_name}}
{{inviterName}} → {{inviter_name}}
{{acceptLink}} → {{accept_link}}
{{declineLink}} → {{decline_link}}
```

Then in backend email.ts, REMOVE camelCase duplicates - only send snake_case.

### Option 2: Make Backend Use camelCase (Current)

Keep backend as-is (sending both). Fix SendGrid templates to use camelCase ONLY:

```
{{user_name}} → {{userName}}
{{event_name}} → {{eventName}}
{{event_date}} → {{eventDate}}
{{event_time}} → {{eventTime}}
{{event_location}} → {{eventLocation}}
{{rsvp_confirmed_at}} → {{rsvpConfirmedAt}}
{{organization_name}} → {{organizationName}}
{{event_detail_link}} → {{eventDetailLink}}
{{calendar_link}} → {{calendarLink}}
{{cancel_rsvp_link}} → {{cancelRsvpLink}}
{{privacy_policy_url}} → {{privacyPolicyUrl}}
{{community_guidelines_url}} → {{communityGuidelinesUrl}}
{{recipient_name}} → {{recipientName}}
{{team_name}} → {{teamName}}
{{inviter_name}} → {{inviterName}}
{{accept_link}} → {{acceptLink}}
{{decline_link}} → {{declineLink}}
```

---

## 🎯 REQUIRED ACTIONS

1. **Log into SendGrid**
2. **Go to Dynamic Templates**
3. **For EACH of these 3 templates:**
   - `d-14788def39174bb66bf186716cce166fa` (Team Invitation)
   - `d-0941019230d9459b81ff602d937f7aa04` (Suspension 45d)
   - `d-511e46f4646f974f18a8f33c12564de14b` (Event RSVP)

4. **Click "Edit"**
5. **Go to the template HTML editor**
6. **Find and replace all variable references** to use CONSISTENT naming
7. **Test with SendGrid preview** (use sample data)
8. **Save and publish**

---

## Quick Reference: Variable Mapping

| Use Case        | Team Invite         | Suspension                   | Event RSVP            |
| --------------- | ------------------- | ---------------------------- | --------------------- |
| User name       | `{{recipientName}}` | `{{userName}}`               | `{{userName}}`        |
| Primary link    | `{{acceptLink}}`    | `{{appealUrl}}`              | `{{eventDetailLink}}` |
| Secondary link  | `{{declineLink}}`   | `{{communityGuidelinesUrl}}` | `{{calendarLink}}`    |
| Event/Team name | `{{teamName}}`      | `{{suspensionDays}}`         | `{{eventName}}`       |

---

## Why This Is Happening

SendGrid templates are essentially **Handlebars templates** stored in their database. When you created these templates, they were defined with specific variable names. The backend must send JSON keys that EXACTLY match those Handlebars variable names.

**If template has `{{myVariable}}`, backend must send `{"myVariable": value}`**

Current mismatch:

- Template expects camelCase: `{{recipientName}}`
- Backend sends both: `{ recipientName: "...", recipient_name: "..." }`
- SendGrid throws 400 error because template can't find REQUIRED variables

---

**Status:** 🔴 BLOCKED ON SENDGRID TEMPLATE UPDATES  
**Priority:** 🔥 CRITICAL for production  
**Est. Time to Fix:** 30 minutes (if you have SendGrid dashboard access)
