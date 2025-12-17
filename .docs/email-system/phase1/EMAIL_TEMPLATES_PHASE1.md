# Email Templates - Phase 1 (Production Ready)

**Date**: December 14, 2025  
**Status**: Phase 1 Implementation (Backend-Ready)  
**Next Phase**: See `EMAIL_TEMPLATES_PHASE2_VISION.md`

---

## Overview

This document defines the **Phase 1 email templates** - those using ONLY data currently available from the backend without additional schema changes or calculations.

Each template below uses **only real fields** from the current Prisma schema and application logic.

---

## 1. Join Request → Organization Admin Notification

**SendGrid Template ID**: `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID`

**Purpose**: Notify organization owner/manager when a coach requests to join their organization

**Trigger**: `POST /organizations/join-requests` (after join request created)

**Backend Call**:
```typescript
await sendJoinRequestToAdmin({
  adminEmail: string;        // Organization owner's email
  adminName: string;         // Organization owner's name
  requesterName: string;     // Coach requesting to join
  requesterEmail: string;    // Coach's email
  organizationName: string;  // Organization name
  message?: string;          // Optional message from coach (max 500 chars)
  requestId: string;         // Join request ID (for URL generation)
  requestedAt: string;       // ISO timestamp when request created
  approveUrl: string;        // Deep link: /organizations/{id}/join-requests/{requestId}/approve
  denyUrl: string;           // Deep link: /organizations/{id}/join-requests/{requestId}/deny
  orgLogoUrl?: string;       // Organization logo (optional)
});
```

**Dynamic Template Variables** (for SendGrid):
```json
{
  "admin_name": "Director Johnson",
  "requester_name": "John Smith",
  "requester_email": "john@example.com",
  "org_name": "Texas Elite Sports",
  "message": "I would love to volunteer as a coach for your organization.",
  "approve_url": "https://varsityhub.app/organizations/org_123/join-requests/req_456/approve",
  "deny_url": "https://varsityhub.app/organizations/org_123/join-requests/req_456/deny",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Email Template Structure**:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
    .content h2 { color: #111827; margin-top: 0; font-size: 20px; }
    .info-block { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; }
    .info-row { margin: 8px 0; }
    .info-label { font-weight: 600; color: #6b7280; }
    .message-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .action-buttons { margin: 24px 0; text-align: center; }
    .btn { display: inline-block; padding: 12px 28px; margin: 0 8px; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .btn-approve { background: #10b981; color: white; }
    .btn-deny { background: #ef4444; color: white; }
    .btn:hover { opacity: 0.9; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .logo { max-width: 100px; height: auto; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      {{#if logo_image}}<img src="{{logo_image}}" alt="{{org_name}}" class="logo">{{/if}}
      <h1>New Join Request</h1>
    </div>

    <div class="content">
      <p>Hi {{admin_name}},</p>
      
      <p><strong>{{requester_name}}</strong> has requested to join your organization <strong>{{org_name}}</strong>.</p>

      <div class="info-block">
        <div class="info-row">
          <span class="info-label">Name:</span> {{requester_name}}
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span> {{requester_email}}
        </div>
      </div>

      {{#if message}}
      <div class="message-box">
        <p><strong>Their message:</strong></p>
        <p>{{message}}</p>
      </div>
      {{/if}}

      <p>Review this request and choose to approve or deny:</p>

      <div class="action-buttons">
        <a href="{{approve_url}}" class="btn btn-approve">Approve Request</a>
        <a href="{{deny_url}}" class="btn btn-deny">Deny Request</a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">Or manage all requests in your VarsityHub organization dashboard.</p>
    </div>

    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
```

**Plain Text Fallback**:
```
VARSITYHUB - NEW JOIN REQUEST

Hi {{admin_name}},

{{requester_name}} ({{requester_email}}) has requested to join your organization {{org_name}}.

{{#if message}}
Message from {{requester_name}}:
{{message}}

{{/if}}
To approve or deny this request, visit your organization dashboard on VarsityHub.

---
VarsityHub
```

**Subject Line**:
```
{{requester_name}} requested to join {{org_name}}
```

---

## 2. Join Request → Approved Notification

**SendGrid Template ID**: `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID`

**Purpose**: Notify coach when their organization join request is approved

**Trigger**: `POST /organizations/join-requests/{id}/approve`

**Backend Call**:
```typescript
await sendJoinRequestApproved({
  userEmail: string;         // Coach's email
  userName: string;          // Coach's name
  organizationName: string;  // Organization they joined
  adminName?: string;        // Admin who approved (optional)
  orgLogoUrl?: string;       // Organization logo (optional)
});
```

**Dynamic Template Variables**:
```json
{
  "user_name": "John Smith",
  "org_name": "Texas Elite Sports",
  "admin_name": "Director Johnson",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png",
  "org_dashboard_url": "https://varsityhub.app/organizations/org_123"
}
```

**Email Template Structure**:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
    .success-badge { background: #d1fae5; color: #065f46; padding: 12px 16px; border-radius: 6px; margin: 16px 0; text-align: center; font-weight: 600; }
    .action-button { display: inline-block; background: #10b981; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .logo { max-width: 100px; height: auto; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      {{#if logo_image}}<img src="{{logo_image}}" alt="{{org_name}}" class="logo">{{/if}}
      <h1>Request Approved!</h1>
    </div>

    <div class="content">
      <p>Hi {{user_name}},</p>
      
      <div class="success-badge">✓ Your request to join {{org_name}} has been approved!</div>

      {{#if admin_name}}<p>{{admin_name}} has approved your request to join <strong>{{org_name}}</strong>.</p>{{/if}}

      <p>You are now a member of the organization and can access all shared resources and team information.</p>

      <div style="text-align: center;">
        <a href="{{org_dashboard_url}}" class="action-button">View Organization</a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">Welcome to {{org_name}}! If you have any questions, reach out to the organization administrators.</p>
    </div>

    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Plain Text Fallback**:
```
VARSITYHUB - REQUEST APPROVED

Hi {{user_name}},

Great news! Your request to join {{org_name}} has been approved.

{{#if admin_name}}{{admin_name}} approved your request.{{/if}}

You are now a member and can access all organization resources.

Visit your organization dashboard to get started.

---
VarsityHub
```

**Subject Line**:
```
Welcome to {{org_name}}! Your request was approved
```

---

## 3. Join Request → Denied Notification

**SendGrid Template ID**: `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID`

**Purpose**: Notify coach when their organization join request is denied

**Trigger**: `POST /organizations/join-requests/{id}/deny`

**Backend Call**:
```typescript
await sendJoinRequestDenied({
  userEmail: string;         // Coach's email
  userName: string;          // Coach's name
  organizationName: string;  // Organization
  reason?: string;           // Optional denial reason (max 500 chars)
  orgLogoUrl?: string;       // Organization logo (optional)
});
```

**Dynamic Template Variables**:
```json
{
  "user_name": "John Smith",
  "org_name": "Texas Elite Sports",
  "reason": "We are currently at capacity for volunteer coaches.",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Email Template Structure**:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
    .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .logo { max-width: 100px; height: auto; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      {{#if logo_image}}<img src="{{logo_image}}" alt="{{org_name}}" class="logo">{{/if}}
      <h1>Request Update</h1>
    </div>

    <div class="content">
      <p>Hi {{user_name}},</p>
      
      <p>Thank you for your interest in joining <strong>{{org_name}}</strong>. Unfortunately, your request could not be approved at this time.</p>

      {{#if reason}}
      <div class="reason-box">
        <p><strong>Reason:</strong></p>
        <p>{{reason}}</p>
      </div>
      {{/if}}

      <p>You're welcome to reach out to the organization directly if you have questions or would like to apply again in the future.</p>

      <p style="color: #6b7280; font-size: 14px;">Keep exploring other organizations and teams on VarsityHub!</p>
    </div>

    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Plain Text Fallback**:
```
VARSITYHUB - REQUEST UPDATE

Hi {{user_name}},

Thank you for your interest in joining {{org_name}}. Your request could not be approved at this time.

{{#if reason}}
Reason: {{reason}}
{{/if}}

Feel free to reach out to the organization or try again later.

---
VarsityHub
```

**Subject Line**:
```
Update on your request to join {{org_name}}
```

---

## Summary: Phase 1 Email Fields

| Email | Admin Name | Requester Name | Requester Email | Org Name | Message | Reason | Approval/Deny URLs | Logo | Timestamp |
|-------|-----------|----------------|-----------------|----------|---------|--------|-------------------|------|-----------|
| **Join Request → Admin** | ✅ | ✅ | ✅ | ✅ | ✅ Optional | - | ✅ | ✅ Optional | ✅ |
| **Join Request → Approved** | ✅ | ✅ | - | ✅ | - | - | - | ✅ Optional | - |
| **Join Request → Denied** | - | ✅ | ✅ | ✅ | - | ✅ Optional | - | ✅ Optional | - |

**All Phase 1 templates use data that is:**
- ✅ Currently stored in the database
- ✅ Passed directly from backend routes
- ✅ No seat calculations needed
- ✅ No team association needed
- ✅ No role tracking needed
- ✅ No expiration logic needed
- ✅ No billing data needed

---

## SendGrid Setup Instructions

1. **Create 3 new Dynamic Templates** in SendGrid Dashboard
2. **Copy template code** from above sections (use HTML for main, plain text for fallback)
3. **Replace `{{variable_names}}`** with SendGrid's `{{variable_names}}` syntax
4. **Test with sample data** using the parameters provided above
5. **Add Template IDs to `.env`**:
   ```
   SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID=d-xxxxxxxxxxxxx
   SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID=d-xxxxxxxxxxxxx
   SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID=d-xxxxxxxxxxxxx
   ```

---

## Testing

**Test Endpoint**: `POST /test-emails/join-admin` (and variants)

```bash
curl -X POST http://localhost:3000/test-emails/join-admin \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "admin@example.com",
    "adminName": "Director Johnson",
    "requesterName": "John Smith",
    "requesterEmail": "john@example.com",
    "organizationName": "Texas Elite Sports",
    "message": "I would love to volunteer...",
    "requestId": "req_123",
    "approveUrl": "https://varsityhub.app/...",
    "denyUrl": "https://varsityhub.app/..."
  }'
```

---

## Notes

- All timestamps use **ISO 8601 format**
- All URLs are **deep links** to the mobile app (use `varsityhubmobile://` scheme)
- Org logos are **optional** but recommended for branding
- Messages are **user-provided** and should be sanitized before display
- All emails have **plain text fallbacks** for accessibility

---

**Next**: See `EMAIL_TEMPLATES_PHASE2_VISION.md` for enhanced features coming in future phases.
