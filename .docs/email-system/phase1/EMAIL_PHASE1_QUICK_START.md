# Phase 1 Email Templates - Quick Start Guide

**⏰ Time to implement**: ~2 hours  
**🎯 Objective**: Get "Join Request" emails working in production  
**📊 Impact**: Admins notified when coaches request to join organization

---

## The 5-Minute Overview

Your backend has **three email functions that are stubbed and ready to go**:

```typescript
// Currently DISABLED in server/src/lib/email.ts (lines 155-157)
export const sendJoinRequestToAdmin = makeDisabled('sendJoinRequestToAdmin');
export const sendJoinRequestApproved = makeDisabled('sendJoinRequestApproved');
export const sendJoinRequestDenied = makeDisabled('sendJoinRequestDenied');
```

These are called from `server/src/routes/organizations.ts` but don't send emails yet.

**To fix**: 
1. Create SendGrid templates (copy-paste from Phase 1 doc)
2. Add template IDs to `.env`
3. Un-stub the three functions
4. Done! ✅

---

## Step 1: Create SendGrid Templates (15 mins)

### Template 1: Join Request → Admin

**Where**: SendGrid Dashboard → Dynamic Templates → Create New

**Name**: "Join Request to Organization - Admin Notification"

**Copy this HTML**:
```html
<!-- See docs/EMAIL_TEMPLATES_PHASE1.md, Section 1 for full HTML -->
<!-- Includes: requester info, org name, message, approve/deny buttons -->
```

**Subject Line**:
```
{{requester_name}} requested to join {{org_name}}
```

**Save & copy Template ID**: `d-xxxxxxxxxxxxxxxxxxxxxxxx`

---

### Template 2: Join Request → Approved

**Name**: "Join Request Approved - Coach Welcome"

**Copy this HTML**:
```html
<!-- See docs/EMAIL_TEMPLATES_PHASE1.md, Section 2 for full HTML -->
<!-- Includes: success message, org dashboard link -->
```

**Subject Line**:
```
Welcome to {{org_name}}! Your request was approved
```

**Save & copy Template ID**: `d-xxxxxxxxxxxxxxxxxxxxxxxx`

---

### Template 3: Join Request → Denied

**Name**: "Join Request Denied"

**Copy this HTML**:
```html
<!-- See docs/EMAIL_TEMPLATES_PHASE1.md, Section 3 for full HTML -->
<!-- Includes: denial reason (optional) -->
```

**Subject Line**:
```
Update on your request to join {{org_name}}
```

**Save & copy Template ID**: `d-xxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 2: Update `.env` (2 mins)

```bash
# server/.env

# Add these three lines with the IDs from Step 1:
SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID=d-admin-template-id-here
SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID=d-approved-template-id-here
SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID=d-denied-template-id-here
```

---

## Step 3: Un-Stub the Functions (30 mins)

### File: `server/src/lib/email.ts`

**Current** (lines 155-157):
```typescript
export const sendJoinRequestToAdmin = makeDisabled('sendJoinRequestToAdmin');
export const sendJoinRequestApproved = makeDisabled('sendJoinRequestApproved');
export const sendJoinRequestDenied = makeDisabled('sendJoinRequestDenied');
```

**Replace with** (paste below):

```typescript
// Send join request notification to organization admin
export async function sendJoinRequestToAdmin(params: {
  adminEmail: string;
  adminName: string;
  requesterName: string;
  requesterEmail: string;
  organizationName: string;
  message?: string;
  requestId: string;
  requestedAt: string;
  approveUrl: string;
  denyUrl: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.JOIN_REQUEST_ADMIN) {
    console.warn('[email] SendGrid join request admin template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.adminEmail,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.JOIN_REQUEST_ADMIN,
      dynamicTemplateData: {
        admin_name: params.adminName,
        requester_name: params.requesterName,
        requester_email: params.requesterEmail,
        org_name: params.organizationName,
        message: params.message || '',
        requested_at: params.requestedAt,
        approve_url: params.approveUrl,
        deny_url: params.denyUrl,
        logo_image: params.orgLogoUrl || '',
      },
    });
    debugLog(`✅ Join request admin notification sent to ${params.adminEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send join request admin email:', error);
    return false;
  }
}

// Send approval notification to requester
export async function sendJoinRequestApproved(params: {
  userEmail: string;
  userName: string;
  organizationName: string;
  adminName?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.JOIN_REQUEST_APPROVED) {
    console.warn('[email] SendGrid join request approved template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.userEmail,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.JOIN_REQUEST_APPROVED,
      dynamicTemplateData: {
        user_name: params.userName,
        org_name: params.organizationName,
        admin_name: params.adminName || 'Admin',
        org_url: `${APP_BASE_URL}/organizations`,
        logo_image: params.orgLogoUrl || '',
      },
    });
    debugLog(`✅ Join request approval email sent to ${params.userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send join request approval email:', error);
    return false;
  }
}

// Send denial notification to requester
export async function sendJoinRequestDenied(params: {
  userEmail: string;
  userName: string;
  organizationName: string;
  reason?: string;
  orgLogoUrl?: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY || !TEMPLATE_IDS.JOIN_REQUEST_DENIED) {
    console.warn('[email] SendGrid join request denied template not configured');
    return false;
  }

  try {
    await sgMail.send({
      to: params.userEmail,
      from: EMAIL_FROM,
      templateId: TEMPLATE_IDS.JOIN_REQUEST_DENIED,
      dynamicTemplateData: {
        user_name: params.userName,
        org_name: params.organizationName,
        reason: params.reason || '',
        logo_image: params.orgLogoUrl || '',
      },
    });
    debugLog(`✅ Join request denial email sent to ${params.userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send join request denial email:', error);
    return false;
  }
}
```

**Also add to TEMPLATE_IDS object** (top of file, around line 12):
```typescript
const TEMPLATE_IDS = {
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',
  PASSWORD_CHANGED: process.env.SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID || '',
  ACCOUNT_RECOVERY: process.env.SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID || '',
  
  // Add these three:
  JOIN_REQUEST_ADMIN: process.env.SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID || '',
  JOIN_REQUEST_APPROVED: process.env.SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID || '',
  JOIN_REQUEST_DENIED: process.env.SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID || '',
} as const;
```

---

## Step 4: Test (15 mins)

### Quick Test via Curl

```bash
# Test the join request admin email
curl -X POST http://localhost:3000/test-emails/join-admin \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "admin@example.com",
    "adminName": "Director Johnson",
    "requesterName": "John Smith",
    "requesterEmail": "john@example.com",
    "organizationName": "Texas Elite Sports",
    "message": "I would love to volunteer as a coach.",
    "requestId": "req_123",
    "requestedAt": "2025-12-14T10:00:00Z",
    "approveUrl": "https://varsityhub.app/organizations/org_123/join-requests/req_123/approve",
    "denyUrl": "https://varsityhub.app/organizations/org_123/join-requests/req_123/deny"
  }'
```

**Expected Response**:
```json
{
  "ok": true
}
```

### Full Integration Test

1. Open mobile app
2. Login as Coach A
3. Navigate to onboarding Step 4 (Organization)
4. Search for organization
5. Click "Request to Join"
6. Submit message
7. **Verify**: Coach's server logs show email sent ✅

---

## Troubleshooting

### "Template ID not configured"

```
[email] SendGrid join request admin template not configured
```

**Fix**: Check `server/.env` has all three template IDs set correctly

### "Failed to send email"

```
❌ Failed to send join request admin email: ...
```

**Debug**:
1. Verify SENDGRID_API_KEY is set
2. Verify template IDs are correct in SendGrid dashboard
3. Check SendGrid API key has send permissions
4. Check dynamic variable names match template (case-sensitive!)

### Email not arriving

1. Check spam/junk folder
2. Verify recipient email is correct
3. Check SendGrid Activity Log (Dashboard → Mail Send → Logs)
4. Look for bounces or failures in SendGrid

---

## What Gets Sent When

| Action | Email Sent To | Function | Template |
|--------|---------------|----------|----------|
| Coach requests join org | Organization owner | `sendJoinRequestToAdmin()` | Join Request → Admin |
| Admin approves request | Coach | `sendJoinRequestApproved()` | Join Request → Approved |
| Admin denies request | Coach | `sendJoinRequestDenied()` | Join Request → Denied |

---

## Phase 1 vs Phase 2

**Phase 1** ✅ (What you're doing now):
- ✅ Simple join requests (org-level)
- ✅ Coach name, email, message
- ✅ Basic approve/deny
- ✅ Ready TODAY

**Phase 2** 🔜 (Future, requires more backend work):
- ❌ Team-level joins
- ❌ Role selection
- ❌ Seat tracking
- ❌ Expiration
- See `docs/EMAIL_TEMPLATES_PHASE2_VISION.md`

---

## Files You Need

| File | Purpose |
|------|---------|
| `docs/EMAIL_TEMPLATES_PHASE1.md` | Complete HTML/text templates + setup |
| `server/.env` | Where you add template IDs |
| `server/src/lib/email.ts` | Where you un-stub functions |
| `server/src/routes/organizations.ts` | Already calls functions (no changes needed) |
| `server/src/routes/test-emails.ts` | Test endpoints (already set up) |

---

## Estimated Time

- Create SendGrid templates: **15 min**
- Update `.env`: **2 min**  
- Un-stub functions: **30 min**
- Test: **15 min**
- **Total: ~1 hour** ✅

---

## Success Criteria

✅ When done:
- [ ] 3 SendGrid templates created with correct IDs
- [ ] `.env` updated with template IDs
- [ ] Functions un-stubbed in `email.ts`
- [ ] `POST /test-emails/join-admin` returns `{ "ok": true }`
- [ ] Real join request workflow sends emails
- [ ] Emails appear in admin inbox

---

**Need help?** See full template designs in `docs/EMAIL_TEMPLATES_PHASE1.md`  
**Want more context?** See `IMPLEMENTATION_SUMMARY_PHASE1.md`
