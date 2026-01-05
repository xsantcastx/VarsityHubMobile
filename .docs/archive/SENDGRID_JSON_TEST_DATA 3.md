# SendGrid Preview JSON Blocks

**For Testing in SendGrid UI**

Copy and paste these JSON blocks directly into SendGrid's preview test data field to verify all CTA buttons and links fire correctly.  
Need a single file with every template’s payload? Use `sendgrid-templates/test-data/all-templates.sample.json`.

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
  "ACCOUNT_EMAIL": "jordan@varsityhub.app"
}
```

### Links This Tests:
✅ **Security Center** → https://varsityhub.app/security  
✅ **Privacy Policy** → https://limeprod.com/VarsityHubPrivacy  
✅ **Social Links** → Instagram, TikTok, YouTube, Facebook  
✅ **LimeProd Globe** → https://limeprod.com  

---

## Account Suspension – 7 Days
**File:** sendgrid-templates/account-suspension-7-days.html  
**Test Data File:** sendgrid-templates/test-data/account-suspension-7-days.json

### Test Data JSON Block:
```json
{
  "userName": "Jordan Wright",
  "reportId": "VH-2025-77821",
  "reportType": "Harassment",
  "suspensionDate": "December 18, 2025",
  "reinstatementDate": "December 25, 2025",
  "suspensionDuration": "7 days",
  "suspensionDays": 7,
  "suspensionReason": "Multiple reports confirmed repeated harassment against other members during live events.",
  "appealUrl": "https://varsityhub.app/help/appeal?vh=VH-2025-77821",
  "communityGuidelinesUrl": "https://varsityhub.app/community-guidelines",
  "privacyPolicyUrl": "https://limeprod.com/VarsityHubPrivacy"
}
```

### Links This Tests:
✅ **Review Community Guidelines** → {{communityGuidelinesUrl}}  
✅ **Submit an Appeal** → {{appealUrl}}  
✅ **Footer Privacy Policy** → {{privacyPolicyUrl}}  
✅ **Social Links** → Instagram, TikTok, YouTube, Facebook, LimeProd

**Expected Result:** Suspension duration badge, details table, and CTA buttons render populated with suspension metadata.

---

## Account Suspension – 45 Days
**File:** sendgrid-templates/account-suspension-45-days.html  
**Test Data File:** sendgrid-templates/test-data/account-suspension-45-days.json

### Test Data JSON Block:
```json
{
  "userName": "Maya Chen",
  "reportId": "VH-2025-88314",
  "reportType": "Severe Abuse",
  "suspensionDate": "December 18, 2025",
  "reinstatementDate": "February 1, 2026",
  "suspensionDuration": "45 days",
  "suspensionDays": 45,
  "suspensionReason": "Severe and repeated violations involving abusive messages and targeted harassment toward student-athletes.",
  "appealUrl": "https://varsityhub.app/help/appeal?vh=VH-2025-88314",
  "communityGuidelinesUrl": "https://varsityhub.app/community-guidelines",
  "privacyPolicyUrl": "https://limeprod.com/VarsityHubPrivacy"
}
```

### Links This Tests:
✅ **Start an Appeal** → {{appealUrl}}  
✅ **Review Community Guidelines** → {{communityGuidelinesUrl}}  
✅ **Footer Privacy Policy** → {{privacyPolicyUrl}}  
✅ **Social Links** → Instagram, TikTok, YouTube, Facebook, LimeProd

**Expected Result:** Extended suspension badge, reinstatement date, and detail cards display provided values without missing-handlebars errors.

---

## Permanent Ban
**File:** sendgrid-templates/permanent-ban.html  
**Test Data File:** sendgrid-templates/test-data/permanent-ban.json

### Test Data JSON Block:
```json
{
  "user_name": "Kendall Price",
  "userName": "Kendall Price",
  "report_id": "VH-2025-99110",
  "reportId": "VH-2025-99110",
  "violation_type": "Severe Harassment",
  "violationType": "Severe Harassment",
  "ban_date": "December 18, 2025 at 5:12 PM CT",
  "ban_reason": "Multiple substantiated reports of targeted harassment toward athletes and repeated evasion of temporary suspensions.",
  "appeal_url": "https://varsityhub.app/help/appeal?vh=VH-2025-99110",
  "appealUrl": "https://varsityhub.app/help/appeal?vh=VH-2025-99110",
  "support_email": "customerservice@varsityhub.app",
  "community_guidelines_url": "https://limeprod.com/VarsityHubPrivacy",
  "privacy_policy_url": "https://limeprod.com/VarsityHubPrivacy"
}
```

### Links This Tests:
✅ **Appeal Decision** → {{appeal_url}}  
✅ **Contact Support** → mailto:{{support_email}}  
✅ **Community Guidelines + Privacy Policy** → static footer links  
✅ **All Social Icons** → Instagram, TikTok, YouTube, Facebook, X, LimeProd

**Expected Result:** Ban date stamp, violation summary, and CTA button all populate with supplied payload so SendGrid preview can confirm deliverability.

---

## Team Invitation
**File:** sendgrid-templates/athlete-invitation.html  
**Test Data File:** sendgrid-templates/test-data/team-invitation.json

### Test Data JSON Block:
```json
{
  "athleteName": "Lena Harper",
  "coachName": "Coach Ramirez",
  "teamName": "Varsity Lions",
  "acceptLink": "https://varsityhub.app/invite/accept?token=TEAM-12345",
  "declineLink": "https://varsityhub.app/invite/decline?token=TEAM-12345",
  "privacyPolicyUrl": "https://limeprod.com/VarsityHubPrivacy",
  "communityGuidelinesUrl": "https://varsityhub.app/community-guidelines"
}
```

### Links This Tests:
✅ **Accept Invitation** → {{acceptLink}}  
✅ **Decline Invitation** → {{declineLink}}  
✅ **Footer Privacy Policy / Community Guidelines** → dynamic URLs  
✅ **Social Icons** → Instagram, TikTok, YouTube, Facebook, X, LimeProd

**Expected Result:** Both CTA buttons work, and footer links use the injected policy URLs (with fallbacks if omitted).

---

## Organization Invitation
**File:** sendgrid-templates/organization-invitation.html  
**Test Data File:** sendgrid-templates/test-data/organization-invitation.json

### Test Data JSON Block:
```json
{
  "recipientName": "Taylor Reese",
  "inviterName": "Jordan Miles",
  "teamName": "Varsity Hawks",
  "organizationName": "Hawks Athletics",
  "role": "Assistant Coach",
  "expiresIn": "January 15, 2026",
  "acceptLink": "https://varsityhub.app/org-invite/accept?token=ORG-67890",
  "privacyPolicyUrl": "https://limeprod.com/VarsityHubPrivacy",
  "communityGuidelinesUrl": "https://varsityhub.app/community-guidelines"
}
```

### Links This Tests:
✅ **Join Team Roster** → {{acceptLink}}  
✅ **Support Email** → mailto link in copy  
✅ **Footer Privacy Policy / Community Guidelines** → dynamic URLs  
✅ **Social Icons** → Instagram, TikTok, YouTube, Facebook, X, LimeProd

**Expected Result:** CTA button renders with injected URL, and footer uses the consistent social block with working links.

---

## Ad Reservation Confirmation
**File:** sendgrid-templates/ad-reservation-confirmation.html  
**Test Data File:** sendgrid-templates/test-data/ad-reservation-confirmation.json

### Test Data JSON Block:
```json
{
  "advertiser_name": "Jordan Miles",
  "business_name": "Miles Orthodontics",
  "reserved_dates": "Mar 3-7 • Mar 10-14",
  "total_cost": "$750.00",
  "target_zip": "75024",
  "checkout_link": "https://varsityhub.app/ads/checkout?token=abc123",
  "ad_preview_url": "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&w=900&q=80"
}
```

### Links This Tests:
✅ **Finish Checkout** → {{checkout_link}}  
✅ **Review Reservation Details** → {{checkout_link}}  
✅ **Ad preview image** (if provided)  
✅ **Footer links/social icons** → your canonical URLs

**Expected Result:** Reserved dates and cost highlight, CTA uses checkout link, optional preview displays when URL provided.

---

## Ad Payment Required
**File:** sendgrid-templates/ad-payment-required.html  
**Test Data File:** sendgrid-templates/test-data/ad-payment-required.json

### Test Data JSON Block:
```json
{
  "advertiser_name": "Jordan Miles",
  "business_name": "Miles Orthodontics",
  "total_cost": "$750.00",
  "checkout_link": "https://varsityhub.app/ads/checkout?token=abc123",
  "hours_remaining": 12
}
```

### Links This Tests:
✅ **Complete Payment** → {{checkout_link}}  
✅ **Footer links/social icons** → canonical URLs

**Expected Result:** Amount due and countdown render correctly; CTA opens checkout link.

---

## Ad Goes Live
**File:** sendgrid-templates/ad-goes-live.html  
**Test Data File:** sendgrid-templates/test-data/ad-goes-live.json

### Test Data JSON Block:
```json
{
  "advertiser_name": "Jordan Miles",
  "business_name": "Miles Orthodontics",
  "ad_title": "Braces for Game Day Smiles",
  "target_zip": "Frisco, TX 75034",
  "go_live_date": "March 3, 2026",
  "live_until": "March 31, 2026",
  "analytics_dashboard_url": "https://varsityhub.app/ads/analytics?ad=123",
  "ad_preview_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&w=900&q=80"
}
```

### Links This Tests:
✅ **Open Analytics Dashboard** → {{analytics_dashboard_url}}  
✅ **Footer links/social icons** → canonical URLs

**Expected Result:** Go-live window, region, and CTA populate, and optional preview image renders.

---

## Coach Onboarding
**File:** sendgrid-templates/coach-onboarding.html  
**Test Data File:** sendgrid-templates/test-data/coach-onboarding.json

```json
{
  "coach_name": "Coach Ellis",
  "plan_name": "Veteran",
  "team_name": "North Shore Tigers",
  "organization_name": "North Shore Athletics",
  "plan_features": [
    "Unlimited staff invites",
    "Advanced analytics dashboard",
    "$1.50 per extra team"
  ],
  "dashboard_url": "https://varsityhub.app/manage-teams",
  "support_url": "https://varsityhub.app/support"
}
```

---

## Plan Limit Warning
**File:** sendgrid-templates/plan-limit-warning.html  
**Test Data File:** sendgrid-templates/test-data/plan-limit-warning.json

```json
{
  "plan_name": "Veteran Plan",
  "resource_type": "team",
  "used_count": 2,
  "limit": 3,
  "upgrade_url": "https://varsityhub.app/upgrade?from=team_limit"
}
```

---

## Billing Notice
**File:** sendgrid-templates/billing-notice.html  
**Test Data File:** sendgrid-templates/test-data/billing-notice.json

```json
{
  "notice_type": "payment_succeeded",
  "plan_name": "Veteran Plan",
  "amount": "$99.00",
  "manage_url": "https://varsityhub.app/billing",
  "team_name": "North Shore Tigers",
  "org_name": "North Shore Athletics",
  "perks": [
    "Unlimited staff invites",
    "Advanced analytics",
    "Season highlight packages"
  ]
}
```

---

## Payment Receipt
**File:** sendgrid-templates/payment-receipt.html  
**Test Data File:** sendgrid-templates/test-data/payment-receipt.json

```json
{
  "plan_name": "Veteran Plan",
  "amount": "$99.00",
  "billing_period": "March 2026",
  "invoice_url": "https://varsityhub.app/invoices/INV-00123"
}
```

---

## Subscription Canceled
**File:** sendgrid-templates/subscription-canceled.html  
**Test Data File:** sendgrid-templates/test-data/subscription-canceled.json

```json
{
  "plan_name": "Veteran Plan",
  "renewal_date": "March 31, 2026",
  "reactivate_url": "https://varsityhub.app/billing/reactivate"
}
```

---

## Security Alert
**File:** sendgrid-templates/security-alert.html  
**Test Data File:** sendgrid-templates/test-data/security-alert.json

```json
{
  "alert_type": "new_device",
  "ip_address": "104.23.18.42",
  "location": "Denver, CO, USA",
  "manage_url": "https://varsityhub.app/settings/security",
  "secure_account_link": "https://varsityhub.app/settings/security",
  "change_password_link": "https://varsityhub.app/reset-password",
  "contact_support_link": "https://varsityhub.app/support"
}
```

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
| Account Recovery | account-recovery.html | USERNAME, ACCOUNT_EMAIL | account-recovery.json |
| Account Suspension – 7 Days | account-suspension-7-days.html | userName, reportId, reportType, suspensionDuration, suspensionDate, reinstatementDate, suspensionReason, appealUrl, communityGuidelinesUrl, privacyPolicyUrl | account-suspension-7-days.json |
| Account Suspension – 45 Days | account-suspension-45-days.html | userName, reportId, reportType, suspensionDuration, suspensionDate, reinstatementDate, suspensionReason, appealUrl, communityGuidelinesUrl, privacyPolicyUrl | account-suspension-45-days.json |
| Permanent Ban | permanent-ban.html | user_name, report_id, violation_type, ban_date, ban_reason, appeal_url, support_email, community_guidelines_url, privacy_policy_url | permanent-ban.json |
| Team Invitation | athlete-invitation.html | athleteName, coachName, teamName, acceptLink, declineLink, privacyPolicyUrl?, communityGuidelinesUrl? | team-invitation.json |
| Organization Invitation | organization-invitation.html | recipientName, inviterName, teamName, organizationName, role, expiresIn, acceptLink, privacyPolicyUrl?, communityGuidelinesUrl? | organization-invitation.json |
| Ad Reservation Confirmation | ad-reservation-confirmation.html | advertiser_name, business_name, reserved_dates, total_cost, target_zip, checkout_link, ad_preview_url? | ad-reservation-confirmation.json |
| Ad Payment Required | ad-payment-required.html | advertiser_name, business_name, total_cost, checkout_link, hours_remaining | ad-payment-required.json |
| Ad Goes Live | ad-goes-live.html | advertiser_name, business_name, ad_title, target_zip, go_live_date, live_until, analytics_dashboard_url, ad_preview_url? | ad-goes-live.json |

---

**Status:** ✅ All JSON blocks verified and ready for SendGrid testing
