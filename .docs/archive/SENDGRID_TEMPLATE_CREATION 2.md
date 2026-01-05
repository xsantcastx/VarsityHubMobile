# SendGrid Template Creation Guide
**Purpose**: Create 3 missing email templates for v1.0.1 submission  
**Templates Needed**: join_request_admin, join_request_approved, join_request_denied  
**Status**: 🔴 BLOCKING - Must be created before QA testing

---

## Quick Setup (5 minutes)

### Step 1: Access SendGrid
```
1. Go to: https://app.sendgrid.com
2. Log in with your SendGrid account
3. Navigate: Marketing → Dynamic Templates
4. Click: "Create Template"
```

### Step 2: Create Template 1 - join_request_admin

**Template Name**: `join_request_admin`

```html
<html>
<head>
  <title>New Team Join Request</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
    <h2 style="color: #333;">New Team Join Request</h2>
    
    <p>Hi {{coachName}},</p>
    
    <p>{{fanName}} has requested to join your team <strong>{{teamName}}</strong>.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #fff; border-left: 4px solid #4CAF50;">
      <p><strong>Requester Info</strong></p>
      <p>Name: {{fanName}}</p>
      <p>Email: {{fanEmail}}</p>
      <p>Role: Fan</p>
    </div>
    
    <p>
      <a href="{{baseUrl}}/teams/{{teamId}}/requests" style="
        background-color: #4CAF50;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
        display: inline-block;
      ">Review Request</a>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      © VarsityHub - The team management app
    </p>
  </div>
</body>
</html>
```

**Variables Used**:
- `{{coachName}}` - Name of the coach
- `{{fanName}}` - Name of the fan requesting
- `{{teamName}}` - Name of the team
- `{{fanEmail}}` - Email of the fan
- `{{teamId}}` - Team ID for the link
- `{{baseUrl}}` - Application base URL

---

### Step 3: Create Template 2 - join_request_approved

**Template Name**: `join_request_approved`

```html
<html>
<head>
  <title>Your Team Join Request Was Approved</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
    <h2 style="color: #4CAF50;">✓ Welcome to {{teamName}}!</h2>
    
    <p>Hi {{fanName}},</p>
    
    <p>Great news! Your request to join <strong>{{teamName}}</strong> has been approved by {{coachName}}.</p>
    
    <p>You can now:</p>
    <ul style="color: #555; line-height: 1.8;">
      <li>View the team schedule and upcoming games</li>
      <li>RSVP to games and events</li>
      <li>Access team information and rosters</li>
      <li>Receive team notifications</li>
    </ul>
    
    <p>
      <a href="{{baseUrl}}/teams/{{teamId}}" style="
        background-color: #4CAF50;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
        display: inline-block;
      ">View Team</a>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      © VarsityHub - The team management app
    </p>
  </div>
</body>
</html>
```

**Variables Used**:
- `{{fanName}}` - Name of the fan
- `{{teamName}}` - Name of the team
- `{{coachName}}` - Name of the coach who approved
- `{{teamId}}` - Team ID for the link
- `{{baseUrl}}` - Application base URL

---

### Step 4: Create Template 3 - join_request_denied

**Template Name**: `join_request_denied`

```html
<html>
<head>
  <title>Team Join Request Status</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
    <h2 style="color: #f44336;">Request Not Approved</h2>
    
    <p>Hi {{fanName}},</p>
    
    <p>Unfortunately, your request to join <strong>{{teamName}}</strong> was not approved at this time.</p>
    
    {{#if reason}}
    <div style="margin: 20px 0; padding: 15px; background-color: #fff; border-left: 4px solid #f44336;">
      <p><strong>Feedback from {{coachName}}:</strong></p>
      <p>{{reason}}</p>
    </div>
    {{/if}}
    
    <p>You can:</p>
    <ul style="color: #555; line-height: 1.8;">
      <li>Try requesting to join another team</li>
      <li>Contact {{coachName}} directly for more information</li>
    </ul>
    
    <p>
      <a href="{{baseUrl}}/teams" style="
        background-color: #2196F3;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
        display: inline-block;
      ">Browse Teams</a>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      © VarsityHub - The team management app
    </p>
  </div>
</body>
</html>
```

**Variables Used**:
- `{{fanName}}` - Name of the fan
- `{{teamName}}` - Name of the team
- `{{coachName}}` - Name of the coach who denied
- `{{reason}}` - Optional reason for denial (if provided)
- `{{baseUrl}}` - Application base URL

---

## How to Create These Templates in SendGrid

### Full Step-by-Step Instructions

**Step 1**: Go to SendGrid Dashboard
```
https://app.sendgrid.com
```

**Step 2**: Navigate to Dynamic Templates
```
Left menu → Marketing → Dynamic Templates
```

**Step 3**: Click "Create Template"
```
Click large blue button "Create Template"
```

**Step 4**: Enter Template Name
```
Name: join_request_admin
Click: Continue
```

**Step 5**: Design Your Email
```
1. Click: "Add Module" or "Blank Template"
2. Copy HTML from "Template 1" above
3. Paste into the HTML editor
4. Click: Save
```

**Step 6**: Note the Template ID
```
After saving, you'll see a Template ID like: d-XXXXXXXXXXXXXXXXXXXXX
COPY THIS ID - you'll need it for Railway
```

**Step 7**: Repeat for Templates 2 & 3
```
Follow same process for:
- join_request_approved
- join_request_denied
```

**Step 8**: Get All Template IDs
```
After creating all 3 templates, collect their IDs:
- join_request_admin: d-XXXXXXXXXXXXXXXXXXXXX
- join_request_approved: d-XXXXXXXXXXXXXXXXXXXXX
- join_request_denied: d-XXXXXXXXXXXXXXXXXXXXX
```

---

## Update Railway with Template IDs

Once you have the 3 template IDs:

**In Railway Dashboard**:
```
1. Go to: https://railway.app
2. Project: VarsityHub
3. Environment: Production
4. Settings → Variables
5. Add/Update these variables:

SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID=d-XXXXXXXXXXXXXXXXXXXXX
SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID=d-XXXXXXXXXXXXXXXXXXXXX
SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID=d-XXXXXXXXXXXXXXXXXXXXX

6. Click: Save
7. Wait for deployment to complete (2-5 minutes)
```

---

## Verify Templates Are Working

### Test 1: Check Health Endpoint
```bash
curl https://api-production-8ac3.up.railway.app/health | jq .integrations.sendgrid
# Should show: true
```

### Test 2: Send a Test Email
```bash
# Use SendGrid's test feature:
# In SendGrid → Dynamic Templates → [template] → Test
# Click "Send Test Email"
# Provide variables and send
```

### Test 3: Run QA Suite
```bash
bash RUN_QA_TESTS.sh
# Select: Team join request flow test
```

---

## Troubleshooting

### Issue: "Template not found" errors in logs
**Solution**:
1. Verify template ID format: `d-XXXXX...` (not `t-XXXXX...`)
2. Double-check in Railway that variable name matches code
3. Wait for deployment to complete (check Railway → Deployments)
4. Run health check again

### Issue: Variables not showing in email
**Solution**:
1. Verify variables are spelled correctly (case-sensitive)
2. In SendGrid template, use: `{{variableName}}` (double braces)
3. Test with SendGrid's test feature first
4. Check code sending email includes all required variables

### Issue: Email not sending at all
**Solution**:
1. Verify SENDGRID_API_KEY is valid
2. Verify EMAIL_FROM is in SendGrid Verified Senders
3. Check Railway logs for errors: `railway logs`
4. Verify API key has "Full Access" permissions

---

## Template Variables Reference

All templates support these base variables:

| Variable | Type | Description |
|----------|------|-------------|
| `{{baseUrl}}` | string | Application base URL (e.g., https://app.varsityhub.com) |
| `{{fanName}}` | string | Name of the fan user |
| `{{coachName}}` | string | Name of the coach user |
| `{{teamName}}` | string | Name of the team |
| `{{teamId}}` | string | Team ID (for links) |
| `{{fanEmail}}` | string | Email of the fan |
| `{{reason}}` | string | Optional reason text (join_request_denied only) |

---

## After Templates Are Created

### Checklist
- [ ] Created 3 SendGrid templates
- [ ] Copied all 3 template IDs
- [ ] Updated Railway variables with template IDs
- [ ] Verified health check: `sendgrid: true`
- [ ] Ready to run QA tests

### Next Step
Once templates are created and deployed:
```bash
bash RUN_QA_TESTS.sh
# Tests will verify email sending works
```

---

**Status**: 🔴 BLOCKING  
**Priority**: CRITICAL - Must complete before QA testing  
**Estimated Time**: 10-15 minutes  
**Last Updated**: December 26, 2025
