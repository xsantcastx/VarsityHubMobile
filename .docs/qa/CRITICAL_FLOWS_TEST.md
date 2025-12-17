# Critical User Flows - End-to-End Testing

**Status:** Ready to test  
**Date:** December 3, 2025  
**Purpose:** Validate all critical features work before launch

---

## Quick Summary

These are the flows that MUST work for launch. If any fail, it's a blocker.

| Flow | Why Critical | Time | Priority |
|------|-------------|------|----------|
| Register → Verify Email | Core feature | 10 min | CRITICAL |
| Onboarding (Coach) | Revenue | 10 min | CRITICAL |
| Post Creation | Core feature | 10 min | CRITICAL |
| Stripe Payment | Revenue | 5 min | CRITICAL |
| Team Creation | Coach feature | 5 min | CRITICAL |
| Notifications | User engagement | 5 min | HIGH |

**Total Time:** ~60 minutes (all flows sequential)

---

## Flow 1: Register → Verify Email (10 min) 🔐

**Why Critical:** Users must verify email to access app

### Steps
1. **Launch app** - `npm start` from root
2. **Go to Sign Up**
   - Tap "Sign Up" on login screen
3. **Enter credentials**
   - Email: `test-email-$(date +%s)@varsityhub.app`
   - Password: `TestPassword123!`
   - Display name: `Test User`
4. **Tap Create Account**
   - Should NOT crash
   - Should NOT show errors
5. **Auto-route to verify screen**
   - Location: `app/verify-email.tsx` line 14
   - Should show code input
   - Should show "Resend Code" button
6. **Check email inbox**
   - From: `noreply@varsityhub.app`
   - Contains: 6-digit code
   - Arrives within 30 seconds
7. **Enter code & verify**
   - Copy code from email
   - Paste into app
   - Tap Verify
   - Should show success message
8. **Auto-redirect to onboarding**
   - Should NOT stay on verify screen
   - Should go to onboarding or feed

### Expected Outcome
✅ Email received  
✅ Code works  
✅ Database marked `email_verified=true`  
✅ User can log in

### If Failed
```
❌ Email not arriving
  - Check health: curl /health | jq .integrations.sendgrid
  - Should be: sendgrid=true
  - Run test: scripts/email-verification-test.sh

❌ Code verification fails
  - Check database: npx prisma studio → users table
  - Verify code in DB matches code from email
  - Check timestamp hasn't expired (30 min window)

❌ Crashes during registration
  - Check logs: `npm run dev` output
  - Check TypeScript: `npm run typecheck`
  - Check Sentry for error details
```

### Success Criteria Checklist
- [ ] Registration endpoint returns access_token
- [ ] Email arrives in inbox within 30s
- [ ] Code from email matches what's in DB
- [ ] /auth/verify/confirm accepts code and marks user verified
- [ ] User can log in without "needs_verification" flag
- [ ] Sentry shows no errors during flow

---

## Flow 2: Onboarding (Coach) (10 min) 💰

**Why Critical:** Revenue flow - coaches pay for plan access

### Prerequisites
- Fresh account registered and verified (from Flow 1)
- Stripe test card: `4242 4242 4242 4242`

### Steps
1. **After email verification, should see onboarding**
   - Location: `app/onboarding/*`
2. **Step 1: Select Role**
   - Tap "Coach"
   - Tap Next
3. **Step 2: Profile Info**
   - Upload photo (or skip)
   - Enter profile details
   - Tap Next
4. **Step 3: Select Plan**
   - See three options: Rookie (Free), Veteran, Legend
   - Tap "Veteran" (paid plan)
5. **Checkout**
   - Stripe modal opens
   - Enter test card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - Tap Pay
6. **Payment success**
   - Should show success screen
   - Should NOT show error
7. **Redirect to feed/dashboard**
   - Should be able to create team
   - Should NOT see "Upgrade" prompts

### Expected Outcome
✅ Payment processed  
✅ Coach role persists  
✅ Can access coaching features  
✅ Database shows subscription active

### If Failed
```
❌ Stripe checkout doesn't open
  - Check: STRIPE_PUBLIC_KEY in Railway
  - Check: STRIPE_SECRET_KEY in Railway
  - Check logs for "Stripe not configured"

❌ Payment fails
  - Check test card is correct (4242 4242 4242 4242)
  - Check Stripe dashboard for error details
  - Check expiry/CVC format

❌ Crashes after payment
  - Check Sentry for error
  - Check database schema for subscription columns
```

### Success Criteria Checklist
- [ ] Onboarding screens load without errors
- [ ] Stripe checkout modal opens
- [ ] Payment succeeds with test card
- [ ] User's subscription_tier updated in database
- [ ] User can create team (coach-only feature)
- [ ] No "Upgrade Now" prompts for Veteran tier

---

## Flow 3: Post Creation (10 min) 📸

**Why Critical:** Core feature - creating posts is what users do

### Prerequisites
- Logged in as verified user (from Flow 1)
- Device/simulator with camera access

### Steps
1. **Navigate to Create Post**
   - Location: `app/create-post.tsx`
   - Tap + button or "Create" tab
2. **Allow location permission**
   - Should NOT block UI
   - Can say "Don't allow" and still post
3. **Upload media**
   - Tap camera icon
   - Choose image or take photo
4. **Add caption**
   - Type something: "Test post"
5. **Select game/event (optional)**
   - Should see auto-suggested nearby events
   - Based on device location
6. **Post creation**
   - Tap "Post" or "Share"
   - Should show loading state
   - Should show success message
7. **Verify in feed**
   - Navigate to feed
   - Should see your post
   - Photo should display correctly
   - Caption should show

### Expected Outcome
✅ Post created  
✅ Media uploaded  
✅ Visible in feed  
✅ Location captured (if permission granted)

### If Failed
```
❌ Image upload fails (large file)
  - Check: CLOUDINARY_URL in Railway
  - Check: File size < 100MB
  - Check logs for Cloudinary errors

❌ Location not working
  - Check: Device location enabled on simulator
  - Location is optional - should NOT block posting
  - See: hooks/useDeviceLocation.ts

❌ Post doesn't appear
  - Check database: npx prisma studio → posts table
  - Verify post was inserted
  - Check media_url has a valid Cloudinary URL
  - Check feed query isn't filtering it out
```

### Success Criteria Checklist
- [ ] Media file uploads successfully
- [ ] Device location captured (if permission granted)
- [ ] Post created in database
- [ ] Post visible in feed
- [ ] Photos/videos display correctly
- [ ] Caption displays correctly
- [ ] No errors in Sentry

---

## Flow 4: Stripe Payment (5 min) 💳

**Why Critical:** Revenue - must work reliably

### Prerequisites
- Stripe test keys configured in Railway
- Account with Veteran plan (active subscription — no trials)

### Steps
1. **Go to Settings → Billing**
   - Or navigate to payment screen
2. **Tap "Upgrade Plan"**
   - Should see Stripe checkout
3. **Enter test card**
   - Number: `4242 4242 4242 4242`
   - Expiry: `12/25` (or any future date)
   - CVC: `123`
   - Name: `Test User`
4. **Tap "Pay"**
   - Should show loading
   - Should complete within 5 seconds
5. **Success page**
   - Should show confirmation
   - Should show receipt/order number

### Expected Outcome
✅ Payment succeeds  
✅ Subscription updated  
✅ Invoice email sent  
✅ No "Upgrade" prompts afterward

### If Failed
```
❌ Stripe not working
  - Check: STRIPE_PUBLIC_KEY set in Railway
  - Check: STRIPE_SECRET_KEY set in Railway
  - Both must start with pk_live_ and sk_live_ (not test keys)

❌ Payment declined
  - Use test card: 4242 4242 4242 4242 (exactly)
  - Use any future expiry: 12/25, 01/26, etc
  - Use any 3-digit CVC: 123, 456, etc

❌ Database not updated
  - Check: users table has subscription_tier column
  - Check: Stripe webhook is configured (if needed)
```

### Success Criteria Checklist
- [ ] Stripe checkout opens
- [ ] Test card accepted
- [ ] Payment succeeds
- [ ] Database subscription_tier updated
- [ ] Invoice email sent
- [ ] User sees success confirmation

---

## Flow 5: Team Creation (5 min) 👥

**Why Critical:** Coach feature - coaches need to create teams

### Prerequisites
- Logged in as Coach (Veteran plan from Flow 2)
- Verified email

### Steps
1. **Navigate to Teams**
   - Tap Teams tab
   - Should show empty or existing teams
2. **Tap "Create Team"**
   - Should open team creation modal
3. **Enter team info**
   - Name: `Test Team`
   - Sport: Select one (Football, Basketball, etc)
   - Description: `Test team for QA`
4. **Tap "Create"**
   - Should NOT crash
   - Should show loading
5. **Team appears in list**
   - Navigate back to Teams
   - Should see new team
6. **Can manage team**
   - Tap team name
   - Should open team detail/edit screen
   - Can add members
   - Can create games

### Expected Outcome
✅ Team created  
✅ Team visible in list  
✅ Can manage team  
✅ Can add members

### If Failed
```
❌ Team creation blocked
  - Check: User has Coach role
  - Check: User has paid subscription (if required)
  - Check: No duplicate team names

❌ Team doesn't appear
  - Check database: npx prisma studio → teams table
  - Verify team was inserted
  - Check user_id matches logged-in user

❌ Crashes when opening team
  - Check logs for error details
  - Check Sentry for exception
```

### Success Criteria Checklist
- [ ] Team creation form opens
- [ ] Team created in database
- [ ] Team appears in team list
- [ ] Can open team detail screen
- [ ] No "Not authorized" errors
- [ ] Can manage team (edit, delete)

---

## Flow 6: Notifications (5 min) 🔔

**Why Critical:** User engagement - must alert users to activity

### Prerequisites
- Two accounts (send from Account A, receive on Account B)
- Both logged in

### Steps
1. **On Account A: Send message**
   - Go to Messages
   - Create new conversation
   - Search for Account B user
   - Send: "Test message"
2. **On Account B: Check notification**
   - Should see badge on Messages tab (red dot)
   - Should receive push notification (if enabled)
3. **On Account B: Open message**
   - Tap Messages
   - Should see conversation
   - Should see the message
4. **Send reply from Account B**
   - Type: "Reply"
   - Tap Send
5. **On Account A: Receive notification**
   - Should see badge
   - Should receive notification (if enabled)

### Expected Outcome
✅ Messages send  
✅ Badges appear  
✅ Push notifications work (if enabled)  
✅ Can reply

### If Failed
```
❌ Messages don't appear
  - Check database: npx prisma studio → messages table
  - Verify message was inserted with correct user_id

❌ No badges
  - Check notification permission granted on device
  - Check: Notifications not disabled in Settings

❌ Push notification not working
  - Check: Device has notification permission
  - Check: Background notification service running
  - Might require additional Expo Push Notification setup
```

### Success Criteria Checklist
- [ ] Message sent successfully
- [ ] Receiver sees badge on Messages tab
- [ ] Can open conversation and read message
- [ ] Can reply to message
- [ ] Message appears in sender's inbox
- [ ] No errors sending/receiving

---

## Full Test Run (60 minutes)

Use this checklist to run all flows:

### Setup (5 min)
- [ ] Backend running: `cd server && npm run dev`
- [ ] App ready: `npm start` (select iOS/Android)
- [ ] Test email account ready: `test-$(date +%s)@varsityhub.app`
- [ ] Stripe test card ready: `4242 4242 4242 4242`

### Flows (55 min)
- [ ] Flow 1: Register → Verify Email (10 min)
- [ ] Flow 2: Onboarding → Coach → Payment (10 min)
- [ ] Flow 3: Post Creation (10 min)
- [ ] Flow 4: Stripe Payment (5 min)
- [ ] Flow 5: Team Creation (5 min)
- [ ] Flow 6: Notifications (5 min)

### Results
- [ ] All flows completed
- [ ] No crashes
- [ ] No errors in Sentry
- [ ] No errors in console
- [ ] All features working as expected

---

## Logging Results

Create a test report:

```markdown
# QA Test Report - December 3, 2025

**Tester:** [Your Name]  
**Date:** December 3, 2025  
**Platform:** iOS / Android (select one)  
**Duration:** 60 minutes

## Results

| Flow | Status | Issues | Notes |
|------|--------|--------|-------|
| Register → Verify | ✅ PASS | None | Email arrived in 28 seconds |
| Onboarding | ✅ PASS | None | Payment processed successfully |
| Post Creation | ✅ PASS | None | 5MB image uploaded fine |
| Stripe Payment | ✅ PASS | None | Test card worked |
| Team Creation | ✅ PASS | None | Team visible immediately |
| Notifications | ✅ PASS | None | Badge appeared, notification sent |

## Issues Found
None

## Ready for Launch?
✅ YES - All critical flows working

**Tester Signature:** ________________  
**Date:** December 3, 2025
```

---

## Next Steps

1. **Run all flows** - Use checklist above
2. **Log results** - Note any failures
3. **Fix blockers** - If any flow fails, fix immediately
4. **Run QA_CHECKLIST** - Comprehensive regression tests
5. **Get sign-off** - From QA lead before launch

---

**Status:** Ready to test  
**Next Action:** Start with Flow 1 (Register → Verify Email)

