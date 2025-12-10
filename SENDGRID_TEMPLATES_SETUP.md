# SendGrid Email Templates Setup

VarsityHub requires 4 email templates to be created in SendGrid dashboard. These are referenced in the backend for team invitation workflows.

## Templates to Create

### 1. org_invite
**Purpose:** Inviting users to join an organization

```html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: white; padding: 20px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VarsityHub Organization Invite</h1>
    </div>
    <div class="content">
      <p>Hello {{firstName}},</p>
      <p>You've been invited to join <strong>{{organizationName}}</strong> on VarsityHub!</p>
      <p>VarsityHub is the ultimate platform for sports team management, social connections, and athlete development.</p>
      <a href="{{inviteLink}}" class="button">Accept Invitation</a>
      <p>If the button doesn't work, copy and paste this link:</p>
      <p><code>{{inviteLink}}</code></p>
      <p>This invitation expires in 7 days.</p>
      <p>Questions? Contact us at support@varsityhub.app</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Variables needed:**
- `{{firstName}}`
- `{{organizationName}}`
- `{{inviteLink}}`

---

### 2. join_request_admin
**Purpose:** Notifying admins when someone requests to join their team

```html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: white; padding: 20px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px 10px 0; }
    .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Join Request</h1>
    </div>
    <div class="content">
      <p>Hello {{adminName}},</p>
      <p><strong>{{requestorName}}</strong> has requested to join your team <strong>{{teamName}}</strong>.</p>
      <p><strong>User Profile:</strong></p>
      <ul>
        <li>Email: {{requestorEmail}}</li>
        <li>Position: {{requestorPosition}}</li>
      </ul>
      <p>Review and respond to this request in VarsityHub:</p>
      <a href="{{reviewLink}}" class="button">Review Request</a>
      <p>Best regards,<br/>VarsityHub Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Variables needed:**
- `{{adminName}}`
- `{{requestorName}}`
- `{{teamName}}`
- `{{requestorEmail}}`
- `{{requestorPosition}}`
- `{{reviewLink}}`

---

### 3. join_request_approved
**Purpose:** Notifying user when their join request is approved

```html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: white; padding: 20px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to {{teamName}}!</h1>
    </div>
    <div class="content">
      <p>Great news, {{requestorName}}!</p>
      <p>Your request to join <strong>{{teamName}}</strong> has been <strong style="color: #10b981;">APPROVED</strong>!</p>
      <p>You can now access all team resources, messaging, and events on VarsityHub.</p>
      <a href="{{appLink}}" class="button">Open VarsityHub</a>
      <p>Get started by:</p>
      <ul>
        <li>Updating your profile</li>
        <li>Joining team chats</li>
        <li>Viewing upcoming events</li>
        <li>Connecting with teammates</li>
      </ul>
      <p>Welcome to the team!<br/>VarsityHub Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Variables needed:**
- `{{teamName}}`
- `{{requestorName}}`
- `{{appLink}}`

---

### 4. join_request_denied
**Purpose:** Notifying user when their join request is denied

```html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: white; padding: 20px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Join Request Update</h1>
    </div>
    <div class="content">
      <p>Hello {{requestorName}},</p>
      <p>Thank you for your interest in joining <strong>{{teamName}}</strong>.</p>
      <p>Unfortunately, your request has not been approved at this time.</p>
      <p>You can still explore other teams and communities on VarsityHub or reach out to team management for more information.</p>
      <a href="{{exploreLink}}" class="button">Explore Teams</a>
      <p>If you have questions, contact support@varsityhub.app</p>
      <p>Best regards,<br/>VarsityHub Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 VarsityHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Variables needed:**
- `{{requestorName}}`
- `{{teamName}}`
- `{{exploreLink}}`

---

## How to Create Templates in SendGrid Dashboard

1. Go to **Sendgrid.com** and log in
2. Navigate to **Dynamic Templates** (left sidebar)
3. Click **Create Template**
4. Set **Template Name** to one of the above template names (exact match required):
   - `org_invite`
   - `join_request_admin`
   - `join_request_approved`
   - `join_request_denied`
5. Click **Create** 
6. In the editor, switch to **Code Editor**
7. Paste the HTML above
8. Click **Replace this content** → **Update**
9. **Save Template**
10. Copy the **Template ID** from the template details

## Update Backend Template IDs

Once templates are created, update `server/src/lib/email.ts` with the SendGrid Template IDs:

```typescript
export const EMAIL_TEMPLATES = {
  org_invite: 'TEMPLATE_ID_HERE',
  join_request_admin: 'TEMPLATE_ID_HERE',
  join_request_approved: 'TEMPLATE_ID_HERE',
  join_request_denied: 'TEMPLATE_ID_HERE',
};
```

## Test Templates

After creating, send test emails:
```bash
curl -X POST https://api-production-8ac3.up.railway.app/test-emails/org-invite \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "John",
    "organizationName": "Test Org",
    "inviteLink": "https://varsityhub.app/invite/test"
  }'
```

---

**Status:** ⚠️ Missing - needs to be completed ASAP
