# SendGrid Setup Guide for v1.0.1 Submission

## Quick Start: 3 Steps to Go

### Step 1: Login to SendGrid
```
URL: https://app.sendgrid.com
Account: [your SendGrid account]
```

### Step 2: Create Email Verification Template

1. **Navigate to Email API → Dynamic Templates**
   - Click "Create Template"
   - Name: `VarsityHub Email Verification`

2. **Create Template Version**
   - Select "Blank Template"
   - Click "Design"

3. **Add Email Subject**
   ```
   Verify your VarsityHub account
   ```

4. **Add HTML Content**
   Use the template from `SENDGRID_TEMPLATE_SAMPLES.md` (lines 15-105)
   - Copy the complete `<!DOCTYPE html>` block
   - Paste into SendGrid template editor
   - Replace all `{{variable}}` with SendGrid's dynamic variable syntax

5. **Test Variables**
   ```json
   {
     "verification_code": "123456",
     "verification_link": "https://varsityhub.app/verify?code=123456",
     "user_name": "Test User"
   }
   ```

6. **Save & Note Template ID**
   - Template ID format: `d-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   - Example: `d-1234567890abcdef1234567890abcdef`
   - **Copy this ID - you'll need it for Railway env vars**

### Step 3: Update Railway Environment Variables

1. **Open Railway Dashboard**
   ```
   https://railway.app → VarsityHub Project → Production
   ```

2. **Add/Update Variables**
   ```
   SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   SENDGRID_VERIFICATION_TEMPLATE_ID=d-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   EMAIL_FROM=noreply@varsityhub.com (must be verified sender)
   ADMIN_EMAILS=xsancastrillonx@hotmail.com
   ```

3. **Verify Sender Email**
   - SendGrid Dashboard → Settings → Sender Authentication
   - Confirm `noreply@varsityhub.com` is verified
   - If not, add and verify it

---

## Verify It Works

### Test Email Delivery

Run this curl command from your backend:

```bash
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H 'Authorization: Bearer SG.XXXXXXX' \
  -H 'Content-Type: application/json' \
  -d '{
    "personalizations": [{
      "to": [{"email": "your-test@gmail.com"}],
      "dynamic_template_data": {
        "verification_code": "123456",
        "verification_link": "https://varsityhub.app/verify?code=123456",
        "user_name": "Test User"
      }
    }],
    "from": {"email": "noreply@varsityhub.com"},
    "template_id": "d-XXXXXXXX"
  }'
```

**Expected Response:**
```json
{"message":"success"}
```

Check your test email inbox - you should receive the verification email.

---

## Optional: Add Welcome Emails (Can do after submission)

SendGrid template samples for additional emails are in `SENDGRID_TEMPLATE_SAMPLES.md`:
- Coach Welcome Email (section 2)
- Fan Welcome Email (section 3)
- Payment Confirmation (section 4)

You can add these templates now or after v1.0.1 submission.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API Key" | Check SG. prefix, full key in Railway |
| "Template not found" | Verify Template ID starts with `d-` |
| "Email from not verified" | Add email to Sender Authentication in SendGrid |
| Email goes to spam | Check sender domain SPF/DKIM records |
| Template variables blank | Use `{{variableName}}` syntax in HTML |

---

## Checklist Before Submission

- [ ] SendGrid account created and API key obtained
- [ ] Email verification template created
- [ ] Template ID noted: `d-________________`
- [ ] Railway env vars updated with:
  - [ ] SENDGRID_API_KEY
  - [ ] SENDGRID_VERIFICATION_TEMPLATE_ID
  - [ ] EMAIL_FROM (verified sender)
  - [ ] ADMIN_EMAILS
- [ ] Test email successfully delivered
- [ ] Email links point to correct APP_BASE_URL
- [ ] All variables populate correctly

---

**Status**: Ready for v1.0.1 if all checklist items complete
**Time Required**: ~15 minutes
**Next Step**: Run QA_TESTS.sh to verify email flow
