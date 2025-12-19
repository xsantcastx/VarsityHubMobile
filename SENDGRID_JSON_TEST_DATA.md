# SendGrid Preview JSON Blocks

**For Testing in SendGrid UI**

Copy and paste these JSON blocks directly into SendGrid's preview test data field to verify all CTA buttons and links fire correctly.

---

## Password Reset Template
**File:** sendgrid-templates/password-reset.html

### Test Data JSON Block:
```json
{
  "name": "Jordan Wright",
  "resetLink": "https://varsityhub.app/reset?code=ABCD1234&email=jordan%40varsityhub.app",
  "webResetLink": "https://varsityhub.app/reset?code=ABCD1234&email=jordan%40varsityhub.app",
  "mobileResetLink": "varsityhubmobile://reset/ABCD1234",
  "expiresIn": "60 minutes",
  "code": "ABCD1234"
}
```

### Links This Tests:
✅ **CTA Button** → {{resetLink}}  
✅ **Mobile Link** → {{mobileResetLink}}  
✅ **Fallback URL** → {{resetLink}}  
✅ **Support Email** → mailto:support@varsityhub.app  
✅ **Social Links** → Instagram, TikTok, YouTube, Facebook  
✅ **LimeProd Globe** → https://limeprod.com  
✅ **Privacy Policy** → https://limeprod.com/VarsityHubPrivacy  

**Expected Result:** All 9+ links should be clickable and functional

---

## Password Changed Template
**File:** sendgrid-templates/password-changed.html

### Test Data JSON Block:
```json
{
  "name": "Jordan Wright",
  "date": "December 17, 2025 at 6:45 PM CT",
  "email": "jordan@varsityhub.app"
}
```

### Links This Tests:
✅ **Security Center Link** → https://varsityhub.app/security  
✅ **Privacy Policy** → https://limeprod.com/VarsityHubPrivacy  
✅ **Support Email** → mailto:support@varsityhub.app  
✅ **Social Links** → Instagram, TikTok, YouTube, Facebook  
✅ **LimeProd Globe** → https://limeprod.com  

**Expected Result:** All 8+ links should be clickable and functional

---

## Account Recovery Template
**File:** sendgrid-templates/account-recovery.html

### Test Data JSON Block:
```json
{
  "USERNAME": "Jordan Wright",
  "userEmail": "jordan@varsityhub.app"
}
```

### Links This Tests:
✅ **Security Center** → https://varsityhub.app/security  
✅ **Privacy Policy** → https://limeprod.com/VarsityHubPrivacy  
✅ **Social Links** → Instagram, TikTok, YouTube, Facebook  
✅ **LimeProd Globe** → https://limeprod.com  

---

## How to Use These JSON Blocks in SendGrid

### Method 1: Direct Paste in SendGrid UI
1. Log in to SendGrid Dashboard (sendgrid.com)
2. Go to Email → Templates
3. Select the template you want to test
4. Click the **"Preview"** button
5. In the preview dialog, you'll see a field for test data
6. **Delete the existing JSON** (if any)
7. **Paste one of the JSON blocks above** exactly as shown
8. The template will immediately update with the test data
9. **Click each link** to verify they work:
   - Check CTA buttons open correct URLs
   - Check deep links show mobile protocol
   - Check social media links open in new tabs
   - Check LimeProd globe links to https://limeprod.com

### Method 2: Upload JSON File
1. Save the JSON block to a file in `sendgrid-templates/test-data/`
2. Click "Upload" in SendGrid preview
3. Select your JSON file
4. Same verification steps as above

### Method 3: Use sendgrid-preview-validator.js
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
node sendgrid-preview-validator.js
```

This automatically tests all templates with their JSON data and generates a report.

---

## What You'll See When Testing

### Password Reset Template Preview:
```
Hi Jordan Wright,

We received a request to reset your password. Use the secure link 
below within 60 minutes.

[Reset Password]  ← Click this to test {{resetLink}}

If the button does not work, copy this URL:
https://varsityhub.app/reset?code=ABCD1234&email=jordan%40varsityhub.app

Prefer the app?
Open reset in VarsityHub mobile  ← Click to test {{mobileResetLink}}

Or enter this code manually:
ABCD1234

⏰ For security, this password reset link and code expire in 60 minutes.

Didn't request a reset? Let us know at support@varsityhub.app

Follow us on social media:
[📷] [🎵] [▶️] [f] [🌐]  ← Click any to test social links
     Instagram TikTok YouTube Facebook LimeProd

Privacy Policy
```

### Password Changed Template Preview:
```
Hi Jordan Wright,

Your password was successfully changed.

Updated on: December 17, 2025 at 6:45 PM CT
Email: jordan@varsityhub.app

Didn't recognize this? Click to secure your account:
[Manage Security] → https://varsityhub.app/security

Have questions? Email us: support@varsityhub.app

Follow us on social media:
[📷] [🎵] [▶️] [f] [🌐]  ← Click any to test social links
     Instagram TikTok YouTube Facebook LimeProd

Privacy Policy
```

---

## Verification Checklist

When testing each template, verify:

### CTA Buttons
- [ ] Main CTA button is clickable
- [ ] Mobile deep link shows varsityhubmobile:// protocol
- [ ] Fallback URL text is clickable
- [ ] All URLs match the JSON test data values

### Security Links
- [ ] Privacy Policy link works
- [ ] Security Center link works
- [ ] Support email opens mail client

### Social Media Links
- [ ] Instagram link opens in new tab
- [ ] TikTok link opens in new tab
- [ ] YouTube link opens in new tab
- [ ] Facebook link opens in new tab
- [ ] LimeProd globe opens https://limeprod.com in new tab

### Visual Elements
- [ ] VarsityHub logo displays correctly
- [ ] LimeProd globe SVG renders properly
- [ ] All images load without errors
- [ ] Layout looks good on mobile (if testing on mobile)

---

## Common Issues & Solutions

### Issue: Links don't appear clickable
**Solution:** SendGrid preview may not show links as clickable. Send a test email to your inbox to see actual rendering.

### Issue: {{variableName}} shows instead of actual value
**Solution:** Check that the JSON key name matches the template variable name exactly (case-sensitive).

### Issue: Mobile deep link doesn't work
**Solution:** This is normal in email preview. It will work when users click the link on their mobile device.

### Issue: LimeProd globe doesn't display
**Solution:** Check that the SVG is properly encoded in base64. The validator output will confirm if it's present.

### Issue: Social media links don't open
**Solution:** They should open in new tabs. Check browser popup blockers.

---

## SendGrid Template Variables Reference

### password-reset.html Variables
```
{{name}}              - User's display name
{{resetLink}}         - Web URL for password reset
{{webResetLink}}      - Alternative web reset URL
{{mobileResetLink}}   - Deep link for mobile app (varsityhubmobile://)
{{expiresIn}}         - Expiration time string (e.g., "60 minutes")
{{code}}              - Manual entry code for fallback
```

### password-changed.html Variables
```
{{name}}              - User's display name
{{date}}              - Timestamp of password change
{{email}}             - User's email address
```

### account-recovery.html Variables
```
{{USERNAME}}          - User's name/username
{{userEmail}}         - User's email address
```

---

## Sending Test Emails

After verifying in the preview:

1. In SendGrid template page, click **"Send Test"** button
2. Enter your personal email address
3. Click **"Send"**
4. Check your inbox for the test email
5. Click each link to verify they work in a real email client
6. Test on mobile if possible

---

## Production Deployment

Once verified:

1. ✅ Confirm all links fire correctly
2. ✅ Verify on mobile devices
3. ✅ Set up click tracking in SendGrid
4. ✅ Configure reply-to address
5. ✅ Enable unsubscribe link
6. ✅ Deploy templates to production

---

## Quick Reference

| Template | File | Variables | Test Data |
|----------|------|-----------|-----------|
| Password Reset | password-reset.html | name, resetLink, mobileResetLink, expiresIn, code | password-reset.json |
| Password Changed | password-changed.html | name, date, email | password-changed.json |
| Account Recovery | account-recovery.html | USERNAME, userEmail | account-recovery.json |

---

**Status:** ✅ All JSON blocks verified and ready for SendGrid testing
