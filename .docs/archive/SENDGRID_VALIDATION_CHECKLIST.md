# SendGrid Template Validation Checklist

All 39 SendGrid templates now have `data-analytics="false"` on every anchor tag to prevent URL wrapping.

## 🔍 Quick Validation Steps

### 1. SendGrid UI Preview Test
For each critical template, paste the test JSON and verify:

**Authentication Templates:**
```bash
# Test in SendGrid UI with:
sendgrid-templates/test-data/password-reset.json
sendgrid-templates/test-data/password-changed.json
sendgrid-templates/test-data/verification-email.json
```

**Event Templates:**
```bash
sendgrid-templates/test-data/event-reminder.json
sendgrid-templates/test-data/event-canceled.json
sendgrid-templates/test-data/event-rsvp-confirmed.json
```

**Ad/Billing Templates:**
```bash
sendgrid-templates/test-data/ad-payment-required.json
sendgrid-templates/test-data/ad-reservation-confirmation.json
sendgrid-templates/test-data/ad-goes-live.json
```

✅ **Expected:** No `{{token}}` or `{{variable}}` placeholders visible in rendered output
✅ **Expected:** All links are direct (not wrapped with SendGrid tracking domains)
✅ **Expected:** Optional blocks (like `{{#if preview}}`) only render when data provided

---

### 2. Railway Environment Variables

Verify all template IDs are set and match SendGrid:

```bash
# Critical IDs to verify in Railway dashboard:
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-...
SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID=d-...
SENDGRID_VERIFICATION_TEMPLATE_ID=d-...
SENDGRID_EVENT_REMINDER_TEMPLATE_ID=d-...
SENDGRID_EVENT_CANCELED_TEMPLATE_ID=d-...
SENDGRID_AD_PAYMENT_REQUIRED_TEMPLATE_ID=d-...
SENDGRID_AD_RESERVATION_CONFIRMATION_TEMPLATE_ID=d-...
SENDGRID_AD_GOES_LIVE_TEMPLATE_ID=d-...
```

✅ Restart Railway service after any env var changes

---

### 3. Payload Field Naming

**Templates use camelCase:**
- `recipientName` (not `recipient_name`)
- `eventName` (not `event_name`)
- `checkInLink` (not `check_in_link`)
- `checkoutLink` (not `checkout_link` or `checkout_url`)

**Backend must match exactly:**
```typescript
// ✅ Correct
await sendEmail({
  to: user.email,
  templateId: process.env.SENDGRID_EVENT_REMINDER_TEMPLATE_ID,
  dynamicTemplateData: {
    recipientName: user.name,  // camelCase
    eventName: event.title,
    checkInLink: `https://varsityhub.app/events/${event.id}/check-in`,
    // ...
  }
});

// ❌ Wrong
dynamicTemplateData: {
  recipient_name: user.name,  // snake_case won't render
}
```

---

### 4. Trigger Real Flows (Staging/Local)

**Authentication:**
- [ ] Sign up → receives verification email with working link
- [ ] Forgot password → reset email with working reset link
- [ ] Change password → confirmation email

**Events:**
- [ ] RSVP to event → confirmation email with calendar/directions CTAs
- [ ] Event updated → notification email with "View Changes" CTA
- [ ] Event canceled → cancellation email

**Billing/Ads:**
- [ ] Reserve ad slot → reservation confirmation with checkout link
- [ ] Payment pending (15-min trigger) → payment reminder with hours_remaining: 1
- [ ] Ad goes live → live notification with analytics dashboard link

**Moderation:**
- [ ] Submit report → receive acknowledgment
- [ ] Report resolved → resolution email

---

### 5. Server Logs Check

Watch for SendGrid errors:
```bash
# Railway logs or local console
grep -i "sendgrid" logs.txt
grep -i "template" logs.txt
grep -i "email" logs.txt
```

✅ **Expected:** No "missing dynamic_template_data" errors
✅ **Expected:** No "template not found" errors
✅ **Expected:** 2xx response codes from SendGrid API

---

### 6. Footer & Social Links

Every template footer should have:
- [ ] Instagram, TikTok, YouTube, Facebook, X (Twitter), LimeProd icons
- [ ] Privacy Policy and Community Guidelines links
- [ ] All links have `data-analytics="false"`
- [ ] All links work (open in browser)

---

## 🚀 Next Actions

### Immediate (Before Production):
1. **Test 3-5 critical flows** (auth, event RSVP, ad payment) in staging
2. **Verify template IDs** match between SendGrid UI and Railway env vars
3. **Confirm payload casing** matches templates (camelCase)
4. **Monitor logs** for first 24 hours after deployment

### Optional (Long-term):
1. **Configure branded tracking domain** (see `SENDGRID_CLICK_TRACKING.md`)
   - Requires DNS CNAME setup
   - Enables tracking without breaking links
   - Can remove `data-analytics="false"` after setup

2. **Deploy backend ad-email senders**
   - Ensure `sendAdReservationEmail()`, `sendPaymentRequiredEmail()`, `sendAdGoesLiveEmail()` deployed
   - Wire to queue with 15-min trigger
   - Verify `hours_remaining: 1` in payment reminder

3. **Configure GitHub Actions secrets**
   - `SNYK_TOKEN` for full security scanning
   - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for Snyk→Sentry integration

---

## ✅ Current Status

- **Templates Fixed:** 39/39 (100%)
- **Tracking Suppression:** ✅ Complete (data-analytics="false" on all anchors)
- **Local Snyk Scan:** ✅ 0 high-severity issues
- **Lint Check:** ✅ Pass (1 minor unused import warning)
- **CI/CD:** ✅ Expo Doctor passing; Snyk gated on secrets (optional)
- **Build:** ✅ TypeScript errors resolved

---

## 📧 Template Inventory

### Authentication (3)
- ✅ password-reset.html
- ✅ password-changed.html
- ✅ verification-email.html

### Events (7)
- ✅ event-reminder.html
- ✅ event-canceled.html
- ✅ event-updated.html
- ✅ event-approved.html
- ✅ event-denied.html
- ✅ event-rsvp-confirmed.html
- ✅ event-submission-received.html

### Billing/Ads (7)
- ✅ ad-payment-required.html
- ✅ ad-reservation-confirmation.html
- ✅ ad-goes-live.html
- ✅ payment-failed.html
- ✅ payment-receipt.html
- ✅ subscription-canceled.html
- ✅ subscription-expiring.html
- ✅ billing-notice.html

### Moderation (7)
- ✅ report-resolved.html
- ✅ report-dismissed.html
- ✅ content-removed.html
- ✅ account-warning.html
- ✅ account-suspension-7-days.html
- ✅ account-suspension-45-days.html
- ✅ permanent-ban.html

### Organization/Team (8)
- ✅ organization-invitation.html
- ✅ athlete-invitation.html
- ✅ role-assignment.html
- ✅ staff-member-joined.html
- ✅ team-roster-update.html
- ✅ invitation-declined.html
- ✅ coach-onboarding.html
- ✅ roster-threshold.html

### Security (2)
- ✅ security-alert.html
- ✅ login-from-new-device.html

### Misc (5)
- ✅ user-confirmation.html
- ✅ account-recovery.html
- ✅ plan-limit-warning.html
- ✅ _footer-snippet.html (reusable component)

**Total:** 39 templates, all hardened against link wrapping
