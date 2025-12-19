# SendGrid UI Testing Guide - Visual Walkthrough

**Quick verification that all CTA buttons and links fire correctly**

---

## How to Test in SendGrid Dashboard

### Part 1: Access the Template Preview

```
1. Go to https://sendgrid.com and log in
2. Click "Email API" in the left sidebar
3. Click "Templates" → "Dynamic Templates"
4. Search for "password-reset" template
5. Click on the template to open it
6. Click the "Preview" button (top right area)
```

---

## Part 2: Test Password Reset Template

### Preview Window Will Show:
```
┌─────────────────────────────────────────┐
│ Email Preview: password-reset           │
├─────────────────────────────────────────┤
│                                         │
│ [Test Data Input Area]                  │
│ ┌───────────────────────────────────┐   │
│ │ {                                 │   │
│ │   "name": "Jordan Wright",        │   │
│ │   "resetLink": "https://..."      │   │
│ │   ...                             │   │
│ │ }                                 │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [Clear Data] [Use File] [Live Loader]   │
│                                         │
└─────────────────────────────────────────┘
```

### Actions to Take:

1. **Clear any existing test data**
   - Select all text in the test data box
   - Delete it

2. **Paste this JSON block exactly:**
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

3. **Wait for preview to update** (should happen automatically)

### What You Should See in Preview:

```
┌────────────────────────────────────────────┐
│              VarsityHub Logo               │
├────────────────────────────────────────────┤
│                                            │
│  Reset your password                       │
│                                            │
│  Hi Jordan Wright,                         │
│  we received a request to reset your       │
│  password. Use the secure link below       │
│  within 60 minutes.                        │
│                                            │
│  ┌──────────────────────────┐              │
│  │ Reset Password           │  ← CLICK!    │
│  └──────────────────────────┘              │
│                                            │
│  If the button does not work, copy:        │
│  https://varsityhub.app/reset?code=...    │
│                                            │
│  Prefer the app?                           │
│  Open reset in VarsityHub mobile ← CLICK!  │
│                                            │
│  Or enter this code manually:              │
│  ABCD1234                                  │
│                                            │
│  [!] For security, this expires in 60 min  │
│                                            │
│  Didn't request? Email support@...         │
│                                            │
│  Follow us on social media:                │
│  [📷] [🎵] [▶️] [f] [🌐] ← CLICK EACH!    │
│                                            │
│  Privacy Policy ← CLICK!                   │
│                                            │
└────────────────────────────────────────────┘
```

### Test Each Link:

✅ **CTA Button "Reset Password"**
- Click: Should show `https://varsityhub.app/reset?code=ABCD1234&email=jordan%40varsityhub.app`
- Result: **PASS** if URL opens

✅ **Mobile Link "Open reset in VarsityHub mobile"**
- Click: Should show `varsityhubmobile://reset/ABCD1234`
- Result: **PASS** if deep link appears (will only work on mobile)

✅ **URL Text Link**
- Click: Should open `https://varsityhub.app/reset?code=ABCD1234&email=jordan%40varsityhub.app`
- Result: **PASS** if URL opens

✅ **Support Email**
- Click: Should open mail client with `support@varsityhub.app`
- Result: **PASS** if mail client opens

✅ **Social Media - Instagram**
- Click: Should open `https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13`
- Result: **PASS** if opens in new tab

✅ **Social Media - TikTok**
- Click: Should open `https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi`
- Result: **PASS** if opens in new tab

✅ **Social Media - YouTube**
- Click: Should open `https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-`
- Result: **PASS** if opens in new tab

✅ **Social Media - Facebook**
- Click: Should open `https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr`
- Result: **PASS** if opens in new tab

✅ **LimeProd Globe (🌐 icon)**
- Click: Should open `https://limeprod.com`
- Result: **PASS** if globe link fires correctly

✅ **Privacy Policy**
- Click: Should open `https://limeprod.com/VarsityHubPrivacy`
- Result: **PASS** if privacy page opens

---

## Part 3: Test Password Changed Template

### Process:

1. **Go back to Templates list**
   - Click "Templates" in breadcrumb or sidebar

2. **Find and open "password-changed" template**
   - Search for "password-changed"
   - Click to open

3. **Click "Preview" button**

### Paste This JSON Block:
```json
{
  "name": "Jordan Wright",
  "date": "December 17, 2025 at 6:45 PM CT",
  "email": "jordan@varsityhub.app"
}
```

### What You Should See:

```
┌────────────────────────────────────────┐
│            VarsityHub Logo             │
├────────────────────────────────────────┤
│                                        │
│  Password Changed                      │
│                                        │
│  Hi Jordan Wright,                     │
│  your password was successfully        │
│  changed                               │
│                                        │
│  Updated: Dec 17, 2025 at 6:45 PM CT   │
│  Email: jordan@varsityhub.app          │
│                                        │
│  Manage your security settings:        │
│  https://varsityhub.app/security ← ✅  │
│                                        │
│  Support: support@varsityhub.app ← ✅  │
│                                        │
│  Follow us on social media:            │
│  [📷] [🎵] [▶️] [f] [🌐] ← CLICK EACH! │
│                                        │
│  Privacy Policy ← CLICK!               │
│                                        │
└────────────────────────────────────────┘
```

### Test Each Link:

✅ **Security Center Link**
- Should link to `https://varsityhub.app/security`
- Result: **PASS** if URL opens

✅ **Support Email**
- Should link to `mailto:support@varsityhub.app`
- Result: **PASS** if mail client opens

✅ **All Social Media Links**
- Instagram, TikTok, YouTube, Facebook
- Result: **PASS** if each opens in new tab

✅ **LimeProd Globe**
- Should link to `https://limeprod.com`
- Result: **PASS** if opens

✅ **Privacy Policy**
- Should link to `https://limeprod.com/VarsityHubPrivacy`
- Result: **PASS** if opens

---

## Verification Checklist

### Password Reset Template ✅
- [ ] CTA button is blue/green and clickable
- [ ] CTA button links to reset URL with code and email
- [ ] Mobile link shows deep link protocol
- [ ] All 5 social media icons visible and clickable
- [ ] LimeProd globe displays and links to production
- [ ] All text links are underlined
- [ ] Support email is clickable
- [ ] Privacy policy link works

### Password Changed Template ✅
- [ ] Security center link points to /security
- [ ] Support email link works
- [ ] All 5 social media icons visible
- [ ] LimeProd globe displays and links correctly
- [ ] Privacy policy link works
- [ ] All security links are clickable
- [ ] Template variables rendered correctly

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Variables show as `{{name}}` | JSON not pasted | Clear box, paste JSON |
| Links not clickable | Preview limitation | Send test email instead |
| Mobile link error | Expected on desktop | Test on mobile device |
| Globe not displaying | SVG encoding issue | Refresh page and retry |
| Email opens in new tab | Browser setting | Check popup blockers |

---

## Sending Test Email

After preview verification:

### Step 1: Click "Send Test Email"
```
In the template editor, look for:
[Send Test Email] button or
[Actions] → [Send Test Email]
```

### Step 2: Enter Your Email
```
Test Email Address: ___________________
[Send]
```

### Step 3: Check Your Inbox
- Wait 1-2 minutes
- Look for test email from SendGrid
- Click each link to verify it works in actual email client

### Step 4: Verify on Mobile
- Forward test email to your phone
- Tap mobile deep link (should open app)
- Click each social link to verify they work

---

## Success Criteria

✅ **All links fire correctly when clicked**  
✅ **CTA buttons render with proper styling**  
✅ **Mobile deep links show correct protocol**  
✅ **Social media links open in new tabs**  
✅ **LimeProd globe links to production**  
✅ **Security links accessible**  
✅ **Template variables substitute correctly**  
✅ **Email renders properly in test email client**  

---

## What "Fires Correctly" Means

Each link should:
1. ✅ Be clickable (either in preview or actual email)
2. ✅ Navigate to the correct destination
3. ✅ Not show variable names ({{name}}, {{resetLink}}, etc.)
4. ✅ Render with proper styling
5. ✅ Work across different email clients
6. ✅ Function on both desktop and mobile

---

## Final Sign-Off

When all links pass the checklist above, you can:

✅ Deploy templates to production  
✅ Enable click tracking in SendGrid  
✅ Set up automated email workflows  
✅ Monitor click analytics  
✅ A/B test subject lines and content  

---

**Quick Reference:**
- Password Reset JSON: sendgrid-templates/test-data/password-reset.json
- Password Changed JSON: sendgrid-templates/test-data/password-changed.json
- Validator Script: sendgrid-preview-validator.js
- Full Report: sendgrid-preview-report.json

**Status:** ✅ READY TO TEST IN SENDGRID UI
