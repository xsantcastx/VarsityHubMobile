# Runtime Verification Checklist — v1.0.2 OTA

Prerequisites:

- Device running App Store binary v1.0.2
- App fully closed twice after the most recent OTA publish
- Fresh coach account created in the last 5 minutes
- Account is unverified to test the verification gate

## 1. Supporting-document upload (closes #1, #2a, #9b)

- Go to onboarding Step 3 (organization)
- Tap Supporting Documents
- Pick a real PDF from Files
- Tap Continue
- Expected (unverified): verification modal appears, enter code, tap Verify, upload resumes, land on Application Submitted
- Expected (verified): upload completes directly, land on Application Submitted
- If you see "Please complete onboarding before creating content": OTA not picked up; close app fully, open twice, retry

## 2. iCloud photo upload (closes #1 iCloud class)

- Take a photo on another device that syncs to iCloud
- Wait ~30 seconds so it shows as an iCloud photo on this device
- In VarsityHub, open a picker that uses the library (avatar, banner, etc.)
- Pick the iCloud photo
- Expected: brief download pause, then upload succeeds
- If upload fails: note screen path and picker file path

## 3. Approval email round-trip (closes #5, confirms #4)

- From Application Submitted, wait up to 2 minutes
- Check SendGrid Activity for a delivered JOIN_REQUEST_ADMIN email
- If delivered: click the 48h approve link
- If admin sign-in required, complete it
- Submit approve form
- Expected: org flips to APPROVED immediately
- Expected: coach device receives ORG_APPROVED push within 30 seconds
- Tap notification: should route to /onboarding/coach-agreement
- If no email in SendGrid Activity, check:
  - Railway env SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID
  - getAllAdminEmails() list contains expected recipients
  - DKIM/SPF status for the from-domain
  - Admin spam folder

## 4. Keyboard white tab (closes #2b)

- On each keyboard screen (Submit Ad description, Step 2 basic info, etc.), focus an input
- Expected: keyboard animates up with no white bar above it
- If it appears: note the exact screen path; that screen needs the same safe-area handling pattern

## Pass Criteria

All four items pass. If any item fails, record the exact screen path and error text.
