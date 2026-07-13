# Phase 2D Flow 7: Payment Integration Testing - Quick Reference

**Duration:** 15 minutes  
**Location in Plan:** Section 1 - Core User Flows  
**Prerequisites:** App loaded on simulator, test user logged in

---

## Stripe Test Card Details

| Field       | Value                        |
| ----------- | ---------------------------- |
| Card Number | `4242 4242 4242 4242`        |
| Expiration  | `12/25` (or any future date) |
| CVC         | `123` (or any 3-4 digits)    |
| Postal Code | `12345` (or any code)        |

**Note:** This card always succeeds in test mode. No real charges occur.

---

## Test Flow: Find/Create Paid Game → RSVP → Payment

### Step 1: Navigate to Game or Create One (2 min)

Option A - Find Existing Paid Game:

```
Home → Discover Tab
Scroll through games list
Look for game with price tag (e.g., "$10.00")
Tap on game
Go to Step 2
```

Option B - Create New Paid Game:

```
Home → Discover Tab
Tap "Create Game" or "+" button
Fill in details:
  - Sport: Basketball
  - Date/Time: Tomorrow at 3 PM
  - Location: [Select from map]
  - Description: "QA Test Game"
  - Skill Level: Intermediate
  - Max Players: 12
  - Price: $10.00  ← MUST BE PAID (not free)
  - Cover Photo: [Upload photo]
Tap "Create" or "Publish"
Go to Step 2
```

### Step 2: Verify Game Details (2 min)

Check that the paid game shows:

- [ ] Sport/Name clearly visible
- [ ] Price displayed: "$10.00" (or your test amount)
- [ ] Date/Time showing tomorrow
- [ ] Location mapped correctly
- [ ] RSVP button (not "Joined" - you shouldn't be registered yet)

### Step 3: Tap RSVP Button (1 min)

```
Look for "RSVP", "Join Game", or "Register" button
Tap it
Expected: Stripe payment sheet appears within 2-3 seconds
```

**Expected Sheet Elements:**

- Card input field labeled "Card details"
- Amount: "$10.00" (should match game price)
- Description: Game name or "Game Registration"
- "Pay" button (blue or primary color)

### Step 4: Enter Test Payment Details (3 min)

Fill in payment form:

```
Card Number:     4242 4242 4242 4242
Expiration:      12/25
CVC:             123
(Postal code:    12345 or auto-filled)
```

**What to verify while filling:**

- [ ] Fields accept input (not disabled)
- [ ] Card number has spacing (xxxx xxxx xxxx xxxx)
- [ ] No validation errors appear yet
- [ ] All fields populated

### Step 5: Submit Payment (2 min)

```
Tap "Pay" button
Expected:
  - Loading indicator appears
  - Wait 3-5 seconds
  - Success screen OR
  - Automatic redirect to success page
```

**Expected Success Response:**

```
✅ Payment successful
"Your ad dates will appear shortly. You can return to the app now."

[Return to app] [Close] buttons
```

### Step 6: Verify Post-Payment (3 min)

Back in app:

```
Go to Discover tab
Find the game you just paid for
Verify it now shows:
  [ ] Status: "Joined" or "Registered" (not "RSVP")
  [ ] Your name in attendee list
  [ ] Payment confirmed
```

Or check your profile:

```
Go to Profile tab
Tap "My Games" or "Registered Games"
Verify paid game appears in list
```

### Step 7: Check Email Receipt (2 min - Optional)

```
Go to your inbox
Look for email from: VarsityHub <noreply@varsityhub.com>
Subject: "Your VarsityHub Payment Confirmation"

Email should contain:
  ✅ Amount: "$10.00"
  ✅ Plan: "Game Registration" or game name
  ✅ Your name or user greeting
  ✅ Perks/details about the game
  ✅ VarsityHub branding/footer
```

**If email doesn't arrive:**

- [ ] Check spam/junk folder
- [ ] Wait 2-3 minutes (SendGrid may be delayed)
- [ ] Check Sentry logs: https://sentry.io → VarsityHub project
  - Look for "Billing notice sent" or email errors
- [ ] Note issue for documentation

### Step 8: Check Sentry for Payment Event (1 min)

```
https://sentry.io/
Select VarsityHub project
Look in Events for last 10 minutes

Expected events:
  ✅ "Payment succeeded" or similar
  ✅ "[payments] Payment processed"
  ✅ "✅ Billing notice sent to [email]"

Any errors?
  ❌ "Failed to send billing notice" → Email failed (still OK, payment succeeded)
  ❌ "Session not found" → Stripe communication issue
  ❌ Other payment errors → Document and investigate
```

### Step 9: Verify Database (Backend Dev Only)

```sql
-- Check transaction was recorded
SELECT * FROM transactions
WHERE session_id = '[your_session_id]'
AND status = 'COMPLETED';

-- Check game attendee was added
SELECT * FROM "GameAttendee"
WHERE game_id = '[game_id]'
AND user_id = '[your_user_id]';

-- Expected: Both queries return 1 row
```

---

## Validation Checklist

✅ **Core Payment Flow**

- [ ] Stripe payment sheet appears
- [ ] Test card accepted (no validation errors)
- [ ] Payment submitted
- [ ] Success page displays
- [ ] No crashes or unexpected errors

✅ **Post-Payment State**

- [ ] User shown as "Joined" in game
- [ ] User appears in game attendees list
- [ ] User's own profile shows "Registered" for game

✅ **Notifications**

- [ ] Email receipt received (within 5 minutes)
- [ ] Email contains amount and game details
- [ ] Sentry shows payment event logged
- [ ] No critical errors in Sentry

✅ **Error Handling**

- [ ] No "Network error" messages during payment
- [ ] No "Invalid card" errors with test card
- [ ] No "Session expired" messages
- [ ] No unhandled exceptions in logs

---

## Common Issues & Fixes

| Issue                        | Cause                                   | Fix                                     |
| ---------------------------- | --------------------------------------- | --------------------------------------- |
| Payment sheet doesn't appear | RSVP didn't trigger checkout            | Tap RSVP again, check browser console   |
| Card rejected                | Test card not recognized                | Use `4242 4242 4242 4242` exactly       |
| "Session expired"            | Too much delay between RSVP and payment | Redo RSVP, pay within 30 minutes        |
| Email not received           | SendGrid misconfigured or delayed       | Check Sentry, wait 5 min, check spam    |
| Success page stuck loading   | Server finishing background tasks       | Wait 5-10 seconds, refresh if needed    |
| User not added to game       | Database transaction failed             | Check Sentry, check database, try again |

---

## Documentation & Reporting

### If Test PASSES (Expected):

```
✅ Flow 7: Payment Integration - PASS
   - Stripe payment sheet appeared
   - Test card accepted
   - Success confirmed
   - User added to game
   - Email receipt received (or logged)
   - Sentry clean
```

### If Test FAILS:

```
❌ Flow 7: Payment Integration - FAIL
   Issue: [Describe what went wrong]

   Screenshots:
   - [Stripe payment sheet error]
   - [Success page status]

   Sentry URL:
   - https://sentry.io/...

   Steps to reproduce:
   1. ...
   2. ...
   3. ...

   Expected vs Actual:
   Expected: [what should happen]
   Actual:   [what happened instead]
```

---

## Additional Testing (Phase 2D Tests C-E)

This quick reference covers the basic Flow 7 (15 min) test.

For comprehensive payment testing, see:

- **PAYMENT_SECURITY_VERIFICATION.md** → Tests A-G
- **Test C:** Ad payment email (15 min)
- **Test E:** Membership email (15 min)

These should be run during Phase 2D if time permits.

---

## Timeline Summary

| Step                      | Time        | Status |
| ------------------------- | ----------- | ------ |
| 1. Navigate/Create Game   | 2 min       | 🎮     |
| 2. Verify Details         | 2 min       | 👀     |
| 3. Tap RSVP               | 1 min       | 🔘     |
| 4. Enter Test Card        | 3 min       | 💳     |
| 5. Submit Payment         | 2 min       | ⏳     |
| 6. Verify Game Joined     | 3 min       | ✅     |
| 7. Check Email (Optional) | 2 min       | 📧     |
| 8. Check Sentry           | 1 min       | 🔍     |
| **TOTAL**                 | **~15 min** | ✅     |

---

## Key Success Indicators

✅ **Payment succeeded** - Green success page appeared  
✅ **User in game** - "Joined" status shows in Discover  
✅ **Email received** - Billing notice in inbox (or Sentry shows sent)  
✅ **Sentry clean** - No payment errors in dashboard  
✅ **No crashes** - App stayed stable throughout

If all 5 are true: **Flow 7 PASSES** ✅

---

**Questions?** See PAYMENT_SECURITY_VERIFICATION.md (Tests A-G) for detailed test procedures.

**Report findings in:** Phase 2D QA Session notes (to be compiled before Phase 3 launch)
