# SendGrid Dynamic Template Guide

This document describes all SendGrid dynamic templates used by VarsityHub and their required placeholders.

## Setup Instructions

1. **Create a SendGrid account** at https://sendgrid.com/
2. **Generate API key** at https://app.sendgrid.com/settings/api_keys
3. **Create dynamic templates** at https://mc.sendgrid.com/dynamic-templates
4. **Add template IDs** to your Railway environment variables

---

## Template Schemas

### 1. Email Verification (`SENDGRID_VERIFICATION_TEMPLATE_ID`)

**Purpose:** Sent when user signs up to verify their email address.

**Dynamic Template Data:**

```json
{
  "verification_link": "https://varsityhub.app/verify?token=abc123",
  "user_name": "John Doe",
  "verification_code": "123456"
}
```

**Template Placeholders:**

- `{{verification_link}}` - Link to click to verify email
- `{{user_name}}` - User's display name
- `{{verification_code}}` - 6-digit verification code (alternative to link)

**Subject:** Verify your VarsityHub account

---

### 2. Team Invite (`SENDGRID_TEAM_INVITE_TEMPLATE_ID`)

**Purpose:** Sent when a coach invites someone to join their team.

**Dynamic Template Data:**

```json
{
  "recipient_name": "John Doe",
  "team_name": "Dallas Lady Tigers",
  "org_name": "Texas Elite Sports",
  "role": "Player",
  "inviter_name": "Coach Smith",
  "invite_url": "https://varsityhub.app/invites",
  "hero_image": "https://cloudinary.com/teams/dallas-tigers-hero.jpg",
  "logo_image": "https://cloudinary.com/teams/dallas-tigers-logo.png",
  "primary_color": "#FF6B35"
}
```

**Template Placeholders:**

- `{{recipient_name}}` - Member’s name (displayed under “Congratulations”)
- `{{team_name}}` - Name of the team (e.g., "Dallas Lady Tigers")
- `{{org_name}}` - Organization name (optional, can be empty)
- `{{role}}` - Role being invited to (e.g., "Player", "Assistant Coach")
- `{{inviter_name}}` - Name of person sending invite
- `{{invite_url}}` - Link to view/accept invite
- `{{hero_image}}` - Team hero/cover photo URL
- `{{logo_image}}` - Team logo URL
- `{{primary_color}}` - Team brand color (hex code for button styling)

**Subject:** You're invited to join {{team_name}}

**Design Tips:**

- Use `{{hero_image}}` as banner image at top of email
- Style CTA button background with `{{primary_color}}`
- Display `{{logo_image}}` next to team name

---

### 3. Organization Invite (`SENDGRID_ORG_INVITE_TEMPLATE_ID`)

**Purpose:** Sent when an admin invites someone to join their organization.

**Dynamic Template Data:**

```json
{
  "org_name": "Texas Elite Sports",
  "role": "Coach",
  "inviter_name": "Director Johnson",
  "invite_url": "https://varsityhub.app/invites",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png",
  "primary_color": "#2563EB"
}
```

**Template Placeholders:**

- `{{org_name}}` - Organization name
- `{{role}}` - Role being invited to
- `{{inviter_name}}` - Admin who sent invite
- `{{invite_url}}` - Link to accept invite
- `{{logo_image}}` - Organization logo URL
- `{{primary_color}}` - Organization brand color

**Subject:** You're invited to join {{org_name}}

---

### 4. Password Reset (`SENDGRID_PASSWORD_RESET_TEMPLATE_ID`)

**Purpose:** Sent when user requests password reset.

**Dynamic Template Data:**

```json
{
  "reset_code": "847392",
  "expires_in": "30 minutes"
}
```

**Template Placeholders:**

- `{{reset_code}}` - 6-digit reset code
- `{{expires_in}}` - How long code is valid

**Subject:** Reset your VarsityHub password

---

### 5. Abuse Report (`SENDGRID_ABUSE_REPORT_TEMPLATE_ID`)

**Purpose:** Sent to customer service when user reports abuse.

**Dynamic Template Data:**

```json
{
  "reporter_name": "Jane Doe",
  "reporter_email": "jane@example.com",
  "subject": "Inappropriate content",
  "message": "This post contains...",
  "user_id": "user_123",
  "submitted_at": "12/2/2025, 3:45 PM"
}
```

**Template Placeholders:**

- `{{reporter_name}}` - Person who filed report
- `{{reporter_email}}` - Reporter's email
- `{{subject}}` - Report subject line
- `{{message}}` - Full report message
- `{{user_id}}` - ID of reported user (if applicable)
- `{{submitted_at}}` - Timestamp

**Subject:** [ABUSE REPORT] {{subject}}

**Recipient:** `CUSTOMER_SERVICE_EMAIL` env var

---

### 6. Join Request (Admin Notification) (`SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID`)

**Purpose:** Sent to org admin when someone requests to join their organization.

**Dynamic Template Data:**

```json
{
  "admin_name": "Director Johnson",
  "requester_name": "John Smith",
  "org_name": "Texas Elite Sports",
  "message": "I'd like to join as a volunteer coach...",
  "approve_url": "https://varsityhub.app/organizations/join-requests/req_123/approve",
  "deny_url": "https://varsityhub.app/organizations/join-requests/req_123/deny",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Template Placeholders:**

- `{{admin_name}}` - Admin receiving notification
- `{{requester_name}}` - Person requesting to join
- `{{org_name}}` - Organization name
- `{{message}}` - Optional message from requester (can be empty)
- `{{approve_url}}` - Link to approve request
- `{{deny_url}}` - Link to deny request
- `{{logo_image}}` - Organization logo

**Subject:** New join request for {{org_name}}

---

### 7. Join Request Approved (`SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID`)

**Purpose:** Sent to user when their join request is approved.

**Dynamic Template Data:**

```json
{
  "user_name": "John Smith",
  "org_name": "Texas Elite Sports",
  "admin_name": "Director Johnson",
  "org_url": "https://varsityhub.app/organizations",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Template Placeholders:**

- `{{user_name}}` - User who requested to join
- `{{org_name}}` - Organization name
- `{{admin_name}}` - Admin who approved
- `{{org_url}}` - Link to organization dashboard
- `{{logo_image}}` - Organization logo

**Subject:** Welcome to {{org_name}}!

---

### 8. Join Request Denied (`SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID`)

**Purpose:** Sent to user when their join request is denied.

**Dynamic Template Data:**

```json
{
  "user_name": "John Smith",
  "org_name": "Texas Elite Sports",
  "reason": "We're currently at capacity for volunteer coaches.",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Template Placeholders:**

- `{{user_name}}` - User who requested to join
- `{{org_name}}` - Organization name
- `{{reason}}` - Optional denial reason (can be empty)
- `{{logo_image}}` - Organization logo

**Subject:** Update on your {{org_name}} request

---

### 9. League Pending Approval (`SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID`)

**Purpose:** Sent to super admin when a new league is created and needs approval.

**Dynamic Template Data:**

```json
{
  "league_name": "Dallas Lady Tigers",
  "owner_name": "Jane Smith",
  "owner_email": "jane@example.com",
  "sport": "Basketball",
  "org_type": "Youth League",
  "created_date": "3/17/2026",
  "approve_url": "https://api.../organizations/org_123/approve?token=...",
  "reject_url": "https://api.../organizations/org_123/reject?token=..."
}
```

**Template Placeholders:**

- `{{league_name}}` - League name
- `{{owner_name}}` - League owner display name
- `{{owner_email}}` - League owner email
- `{{sport}}` - Sport type
- `{{org_type}}` - Organization type
- `{{created_date}}` - Creation date
- `{{approve_url}}` - One-click approve link (signed JWT)
- `{{reject_url}}` - One-click reject link (signed JWT)

**Subject:** New League Awaiting Approval: {{league_name}}

---

### 10. Admin Action Confirmation (`SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID`)

**Purpose:** Internal confirmation to super admin when a league is approved or rejected.

**Dynamic Template Data:**

```json
{
  "action": "league_approved",
  "league_name": "Dallas Lady Tigers",
  "owner_name": "Jane Smith",
  "owner_email": "jane@example.com",
  "reason": ""
}
```

**Template Placeholders:**

- `{{action}}` - One of: `league_approved`, `league_rejected`
- `{{league_name}}` - League name
- `{{owner_name}}` - League owner name
- `{{owner_email}}` - League owner email
- `{{reason}}` - Rejection reason (only for league_rejected)

**Subject:** League Approved/Rejected: {{league_name}}

---

### 11. Organization Approval (`SENDGRID_ORG_APPROVAL_TEMPLATE_ID`)

**Purpose:** Sent when admin approves organization-related action.

**Dynamic Template Data:**

```json
{
  "org_name": "Texas Elite Sports",
  "dashboard_url": "https://varsityhub.app/team-hub",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Template Placeholders:**

- `{{org_name}}` - Organization name
- `{{dashboard_url}}` - Link to dashboard
- `{{logo_image}}` - Organization logo

**Subject:** Welcome to {{org_name}}!

---

### 12. Organization Denial (`SENDGRID_ORG_DENIAL_TEMPLATE_ID`)

**Purpose:** Sent when admin denies organization-related action.

**Dynamic Template Data:**

```json
{
  "org_name": "Texas Elite Sports",
  "reason": "Missing required documentation.",
  "logo_image": "https://cloudinary.com/orgs/texas-elite-logo.png"
}
```

**Template Placeholders:**

- `{{org_name}}` - Organization name
- `{{reason}}` - Optional denial reason (can be empty)
- `{{logo_image}}` - Organization logo

**Subject:** Update on your {{org_name}} request

---

### 13. Content Moderation (`SENDGRID_CONTENT_MODERATION_TEMPLATE_ID`)

**Purpose:** Sent when content is moderated (removed, flagged, or restored).

**Dynamic Template Data:**

```json
{
  "action": "removed",
  "post_id": "post_abc123",
  "reason": "Violated community guidelines regarding hate speech.",
  "next_steps": "If you believe this is a mistake, reply to this email."
}
```

**Template Placeholders:**

- `{{action}}` - One of: "removed", "flagged", "restored"
- `{{post_id}}` - Post ID (optional, can be empty)
- `{{reason}}` - Reason for action (optional)
- `{{next_steps}}` - What user can do next

**Subject:** Your content has been {{action}}

**Conditional Logic:**
Use `{{#if reason}}{{reason}}{{/if}}` to show reason only when provided.

---

### 14. Billing Notice (`SENDGRID_BILLING_NOTICE_TEMPLATE_ID`)

**Purpose:** Sent for billing events (payment success/failure, subscription changes). Trials are not offered.

**Dynamic Template Data:**

```json
{
  "notice_type": "payment_succeeded",
  "plan_name": "VarsityHub Pro",
  "amount": "$49.99",
  "manage_url": "https://varsityhub.app/settings/manage-subscription",
  "team_name": "Dallas Lady Tigers",
  "org_name": "Texas Elite Sports",
  "perks": ["Unlimited posts", "Advanced analytics", "Custom branding"]
}
```

**Template Placeholders:**

- `{{notice_type}}` - One of: `payment_succeeded`, `payment_failed`, `subscription_canceled`, `subscription_renewed`
- `{{plan_name}}` - Subscription plan name
- `{{amount}}` - Dollar amount (e.g., "$49.99")
- `{{manage_url}}` - Link to subscription management page
- `{{team_name}}` - Associated team name (optional, can be empty)
- `{{org_name}}` - Associated organization name (optional, can be empty)
- `{{perks}}` - Array of plan benefits

**Subject (varies by type):**

- `payment_succeeded`: "Payment received — thank you!"
- `payment_failed`: "Payment failed — action required"
- `subscription_canceled`: "Your subscription has been canceled"
- `subscription_renewed`: "Your subscription has been renewed"

**Conditional Logic:**

```handlebars
{{#if team_name}}
  <p>Your
    {{plan_name}}
    plan for
    <strong>{{team_name}}</strong>
    {{#if org_name}}in {{org_name}}{{/if}}
    has been renewed.</p>
{{else}}
  <p>Your {{plan_name}} plan has been renewed.</p>
{{/if}}

{{#each perks}}
  <li>{{this}}</li>
{{/each}}
```

---

## Design Best Practices

### Color Usage

- **Primary CTA buttons:** Use `{{primary_color}}` when available, fallback to VarsityHub blue (#2563EB)
- **Success actions:** Green (#10b981) for approvals, confirmations
- **Warning actions:** Red (#ef4444) for denials, errors
- **Neutral actions:** Gray (#6b7280) for informational links

### Image Sizing

- **Hero images:** 600px wide, maintain aspect ratio
- **Logo images:** 120px max width, centered or left-aligned
- **Fallback images:** Always provide default images if placeholders are empty

### Mobile Responsiveness

- Use single-column layout
- Minimum 44px touch target for buttons
- 16px minimum font size for body text
- Test on iOS Mail, Gmail app, Outlook mobile

### Accessibility

- Use semantic HTML (`<h1>`, `<p>`, `<a>`)
- Ensure sufficient color contrast (4.5:1 minimum)
- Include alt text for all images
- Make links descriptive (avoid "click here")

---

## Testing Templates

Before deploying to production:

1. **Create test templates** with sample data in SendGrid dashboard
2. **Send test emails** to multiple email clients:
   - Gmail (web, iOS, Android)
   - Apple Mail (macOS, iOS)
   - Outlook (web, desktop)
3. **Verify all placeholders** render correctly
4. **Check mobile responsiveness** on actual devices
5. **Test fallback scenarios** (missing images, empty optional fields)

---

## Migration Checklist

- [ ] Create all 12 templates in SendGrid dashboard
- [ ] Copy template IDs to Railway environment variables
- [ ] Set `SENDGRID_API_KEY` in Railway
- [ ] Set `FROM_EMAIL` (must be verified sender in SendGrid)
- [ ] Update `CUSTOMER_SERVICE_EMAIL` for abuse reports
- [ ] Test each template with sample data
- [ ] Deploy code changes to Railway
- [ ] Monitor server logs for email send confirmations
- [ ] Verify actual emails arrive in inbox (not spam)

---

## Environment Variables Summary

```bash
# Required
SENDGRID_API_KEY=SG.abc123...
FROM_EMAIL=noreply@varsityhub.app
CUSTOMER_SERVICE_EMAIL=customerservice@varsityhub.app
APP_BASE_URL=https://varsityhub.app

# Template IDs (all required)
SENDGRID_VERIFICATION_TEMPLATE_ID=d-...
SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-...
SENDGRID_ORG_INVITE_TEMPLATE_ID=d-...
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-...
SENDGRID_ABUSE_REPORT_TEMPLATE_ID=d-...
SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID=d-...
SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID=d-...
SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID=d-...
SENDGRID_ORG_APPROVAL_TEMPLATE_ID=d-...
SENDGRID_ORG_DENIAL_TEMPLATE_ID=d-...
SENDGRID_CONTENT_MODERATION_TEMPLATE_ID=d-...
SENDGRID_BILLING_NOTICE_TEMPLATE_ID=d-...
```

---

## Support

- **SendGrid Docs:** https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-transactional-templates
- **Template Editor:** https://mc.sendgrid.com/dynamic-templates
- **API Reference:** https://docs.sendgrid.com/api-reference/mail-send/mail-send
