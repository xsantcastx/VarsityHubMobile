# How to Fix: Verification Email Not Showing Code

## Problem

The verification email shows "You're in!" confirmation page instead of the 6-digit verification code.

## Root Cause

The SendGrid template with ID `d-584a4a9fe16449078e2cbc6d9d7be0d7be0d0` in your SendGrid dashboard is using the OLD template content. The code correctly sends the verification code, but the template doesn't display it.

## Solution: Update SendGrid Template

### Step 1: Open SendGrid Dashboard

1. Go to https://app.sendgrid.com/
2. Navigate to **Email API** → **Dynamic Templates**

### Step 2: Find Your Verification Template

1. Look for template with ID: `d-584a4a9fe16449078e2cbc6d9d7be0d0`
2. Or search for template named: "User Confirmation - VH" or "Verification Email"

### Step 3: Replace Template Content

1. Click **Edit** on the template
2. Open your local file: `sendgrid-templates/verification-email.html`
3. Copy **ALL** the HTML content from the local file
4. Paste it into SendGrid's HTML editor (replace everything)
5. Make sure these placeholders exist:
   - `{{verification_code}}` - Should display the 6-digit code prominently
   - `{{user_name}}` - User's display name
   - `{{verification_link}}` - Optional verification link

### Step 4: Verify Template Settings

1. **Subject Line:** Should be "Verify your VarsityHub account"
2. **Template Version:** Make sure you're editing the active version
3. **Save & Publish:** Click Save, then Publish to make it live

### Step 5: Test

1. Sign up with a test email
2. Check your email - you should now see the 6-digit code displayed prominently

## What the Email Should Look Like

- **Heading:** "Verify Your Email Address" (not "You're in!")
- **Code Display:** Large 6-digit code in a gray box (e.g., `123456`)
- **Instructions:** "To verify your email address, please enter the 6-digit code below in the app:"
- **Expiry Note:** "This code will expire in 30 minutes"

## Quick Reference

- **Template ID:** `d-584a4a9fe16449078e2cbc6d9d7be0d0`
- **Local File:** `sendgrid-templates/verification-email.html`
- **Required Placeholders:**
  - `{{verification_code}}` (the 6-digit code)
  - `{{user_name}}` (user's name)
  - `{{verification_link}}` (optional verification URL)

## Backend Status

✅ Code is correct - backend sends `verification_code` in template data (line 602 in `server/src/lib/email.ts`)
✅ Template file is correct - local HTML file includes `{{verification_code}}` placeholder

The only missing piece is updating the SendGrid dashboard template!
