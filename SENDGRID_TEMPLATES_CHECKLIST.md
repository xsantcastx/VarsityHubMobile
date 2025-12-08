# SendGrid Templates: Action Items

## Templates Already Configured ✅

These are **ready to use immediately**:

| Template | ID | Use Case |
|----------|----|---------| 
| Verification | d-e6e34f349f364529a046d530ba3e03bd | Email confirmation after signup |
| Password Reset | d-0f8c1353d4d44599bff28635cd39c167 | Password recovery flow |
| Team Invite | d-04a0746f62e04d9bbd63f8f70ff7897b | Team member invitations |

## Templates Missing ⚠️ (Create On-Demand)

These are **not yet created** in SendGrid. Create them when the corresponding features are implemented:

### 1. **org_invite**
- **When Needed:** When org members can be invited to join organizations
- **To Create:**
  1. Go to SendGrid > Dynamic Templates
  2. Create new template
  3. Name: "Organization Invite"
  4. Copy the template ID
  5. Add to `server/.env`: `SENDGRID_ORG_INVITE_TEMPLATE_ID=d-xxxxx`

### 2. **join_request_admin**
- **When Needed:** When admins receive notifications about new membership requests
- **To Create:**
  1. SendGrid > Dynamic Templates > New
  2. Name: "Join Request Admin Notification"
  3. Copy the template ID
  4. Add to `server/.env`: `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID=d-xxxxx`

### 3. **join_request_approved**
- **When Needed:** When users receive approval notification for their join requests
- **To Create:**
  1. SendGrid > Dynamic Templates > New
  2. Name: "Join Request Approved"
  3. Copy the template ID
  4. Add to `server/.env`: `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID=d-xxxxx`

### 4. **join_request_denied**
- **When Needed:** When users receive denial notification for their join requests
- **To Create:**
  1. SendGrid > Dynamic Templates > New
  2. Name: "Join Request Denied"
  3. Copy the template ID
  4. Add to `server/.env`: `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID=d-xxxxx`

## How to Create SendGrid Templates

1. **Login to SendGrid Dashboard**
   - https://app.sendgrid.com/

2. **Navigate to Dynamic Templates**
   - Left sidebar > Marketing > Dynamic Templates

3. **Create Template**
   - Click "Create Template"
   - Enter template name (use names above)
   - Design/upload HTML content
   - Add dynamic variables (e.g., `{{firstName}}`, `{{joinUrl}}`)

4. **Copy Template ID**
   - After creation, template shows ID: `d-xxxxx...`
   - Copy this exact ID

5. **Update Environment**
   - Add to `server/.env`:
     ```
     SENDGRID_ORG_INVITE_TEMPLATE_ID=d-xxxxx
     ```
   - Restart server: `cd server && npm run dev`
   - Server should recognize template at boot

6. **Update Railway (Production)**
   - Go to Railway dashboard
   - Add/update the same variable
   - Railway auto-redeploys

## Current Status

```
Configured:  3 / 7 templates
Missing:     4 / 7 templates
Ready Now:   ✅ Email verification, password reset, team invites
Blocked:     ⚠️  Org features until templates created
```

## No Immediate Action Required

- The app works fine without org templates
- The server warns about them at boot (expected)
- Create them when the UI needs those features

---

**See `ENVIRONMENT_CONFIGURATION_STATUS.md` for full configuration overview.**
