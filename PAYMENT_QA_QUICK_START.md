# Payment Security QA - Quick Start Guide

## 🚀 When to Use Each Document

| Situation | Use This | Duration | Details |
|-----------|----------|----------|---------|
| Starting Flow 7 | `FLOW_7_PAYMENT_QUICKREF.md` | 15 min | 9-step walkthrough, test card, verification |
| Want deep testing | `PAYMENT_SECURITY_VERIFICATION.md` | 60-90 min | 7 comprehensive tests (A-G), database validation |
| Quick validation | `test-payment-security.sh` | 2-3 min | Automated checks (7/8 pass, 1 manual) |
| Troubleshooting | `FLOW_7_PAYMENT_QUICKREF.md` (Issues section) | 5-10 min | Common problems & solutions |

---

## 🔑 Critical Information

### Stripe Test Card
```
Number:    4242 4242 4242 4242
Expiration: 12/25 (or any future date)
CVC:       123 (or any 3-4 digits)
Postal:    12345 (or any code)
```

### Expected Infrastructure Status
```
stripe:     true ✅
smtp:       true ✅ (SendGrid)
sentry:     true ✅
database:   true ✅
```

### Verify Before Starting Flow 7
- [ ] Health endpoint: https://api-production-8ac3.up.railway.app/health
- [ ] Sentry dashboard: Open in separate tab
- [ ] Email account: Ready to check for receipts
- [ ] Test card: 4242 4242 4242 4242 ready

---

## 📋 Quick Path During Phase 2D QA

### Minimum Test (15 minutes)
When you reach **Flow 7** in DAY_3_QA_CHECKLIST.md:

1. Open `FLOW_7_PAYMENT_QUICKREF.md`
2. Follow the **9-step walkthrough** exactly
3. Use test card: `4242 4242 4242 4242`
4. Verify:
   - ✅ Success page appears
   - ✅ User marked as "Joined"
   - ✅ Email receipt arrives (check inbox)
   - ✅ Sentry shows payment event

### Recommended Test (45 minutes)
If you have time after Flow 7:

1. Open `PAYMENT_SECURITY_VERIFICATION.md`
2. Run **Test C** (Ad payment email): 15 min
   - Verifies email formatting
   - Checks dates and amounts
3. Run **Test E** (Membership email): 15 min
   - Verifies plan-specific perks
   - Checks subscription details
4. Run **Test D** (Duplicate prevention): 20 min
   - Confirms no duplicate emails on retries
   - Uses manual webhook retry

---

## 🧪 Automated Tests Anytime

```bash
# Run any time to verify infrastructure
./test-payment-security.sh

# Expected output
✅ Test 1: Health endpoint (stripe=true, smtp=true, sentry=true)
✅ Test 3: TypeScript compilation (0 errors)
✅ Test 4: ESLint validation
✅ Test 5: Security checklist (8/8 items)
✅ Test 6: Email helpers exist
✅ Test 7: Duplicate prevention code
✅ Test 8: Error handling (28 catch blocks)
⏳ Test 2: Session mismatch (requires two test users)
```

---

## 🎯 What Gets Tested

### FLOW_7_PAYMENT_QUICKREF.md Tests
- ✅ Stripe payment sheet appears and accepts test card
- ✅ Success page renders with correct information
- ✅ User is marked as "Joined" in game
- ✅ Sentry logs payment event
- ✅ Email receipt sent within 30 seconds

### PAYMENT_SECURITY_VERIFICATION.md Tests (Optional)
- ✅ Test A: Health endpoint confirms all services live (5 min)
- ✅ Test B: Session mismatch prevents unauthorized access (10 min)
- ✅ Test C: Ad payment email with dates/amount (15 min)
- ✅ Test D: Duplicate emails prevented (20 min)
- ✅ Test E: Membership email with perks (15 min)
- ✅ Test F: SendGrid failure doesn't break payment (10 min)
- ✅ Test G: API response validation (10 min)

### test-payment-security.sh Tests
- ✅ Infrastructure: Stripe, SendGrid, Sentry operational
- ✅ Code quality: 0 TypeScript errors
- ✅ Security: Session validation, duplicate prevention
- ✅ Error handling: Multiple try/catch blocks
- ✅ Email functions: Both sendAdPaymentEmail and sendSubscriptionEmail

---

## 📊 Expected Sentry Events During Flow 7

When you test Flow 7, Sentry should show:

```
✅ Billing notice sent to user@example.com
✅ Ad payment successful: $X.XX for ad ID ...
✅ User added to game: Game ID ...
```

No `ERROR` level events expected (warnings are fine for test data).

---

## 📧 Expected Email Content

### Ad Payment Receipt Should Include
- "VarsityHub Ad Payment" or "Billing Notice"
- Ad ID or reservation reference
- Dates (start/end of reservation)
- Amount in USD format
- Management/support link

### Membership Payment Receipt Should Include
- Plan name ("Veteran Membership" or "Legend Membership")
- Subscription end date
- Perks or benefits list
- Amount in USD format
- Management link

If emails don't arrive:
1. Check spam/junk folder
2. Wait 30 seconds (SendGrid can be slow)
3. Check Sentry console (might see SendGrid error)
4. Look for "Billing notice sent" message in Sentry

---

## 🚨 Troubleshooting

### Payment Sheet Doesn't Appear
- Check: Does the game have a price > 0?
- Check: Is RSVP button actually triggering payment?
- Try: Force close app, reopen, try again

### Test Card Rejected
- Use exactly: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3-4 digits (e.g., 123)
- Postal: Any code (e.g., 12345)

### Email Never Arrives
- Step 1: Check spam/junk folder
- Step 2: Wait 5 minutes (could be delayed)
- Step 3: Check Sentry console → Payment logs
- Step 4: Look for "Unable to send email" error message
- Note: Payment still succeeds even if email fails (graceful degradation)

### Success Page Doesn't Show
- Check: Is Stripe payment sheet actually processing?
- Check: Any errors in Sentry console?
- Try: Complete payment again (test card won't charge)

### User Not Added to Game
- Check: Did the success page have the "Joined" indicator?
- Check: Sentry logs for "User added to game" message
- Try: Refresh game detail page to see updated join status

---

## ✅ Sign-Off Checklist

After completing Flow 7 payment test:

- [ ] Payment sheet appeared without errors
- [ ] Test card processed successfully
- [ ] Success page displayed correctly
- [ ] User marked as "Joined" in game
- [ ] Email receipt received (or logged in Sentry)
- [ ] No ERROR level events in Sentry
- [ ] Results documented in QA checklist

---

## 📚 Documentation Map

```
FLOW_7_PAYMENT_QUICKREF.md
├─ 9-step payment flow (15 min)
├─ Stripe test card details
├─ Verification checklist
├─ Common issues & fixes
├─ Sentry monitoring
└─ Database validation

PAYMENT_SECURITY_VERIFICATION.md
├─ Test A: Health endpoint (5 min)
├─ Test B: Session security (10 min)
├─ Test C: Ad payment email (15 min)
├─ Test D: Duplicate prevention (20 min)
├─ Test E: Membership email (15 min)
├─ Test F: Error handling (10 min)
├─ Test G: API validation (10 min)
└─ Architecture diagrams

test-payment-security.sh
├─ Health endpoint check
├─ TypeScript validation
├─ ESLint check
├─ Security checklist
├─ Email function check
├─ Duplicate prevention check
└─ Error handling verification
```

---

## 🎯 Success Criteria

### Minimum (Flow 7 Only)
✅ Payment test completed  
✅ User added to game  
✅ Email receipt received  
✅ Sentry shows no errors  

### Recommended (With Optional Tests)
✅ All of above, plus:  
✅ Test C: Ad email validated  
✅ Test E: Membership email validated  
✅ Test D: Duplicate prevention confirmed  
✅ Comprehensive payment security verified  

### Before Phase 3A Gate
✅ Payment feature sign-off  
✅ No critical issues found  
✅ All tests documented  
✅ Ready to proceed with store submission  

---

## 📞 Quick Reference

| Need | Look Here | Time |
|------|-----------|------|
| 9-step walkthrough | FLOW_7_PAYMENT_QUICKREF.md | 15 min |
| Detailed test procedures | PAYMENT_SECURITY_VERIFICATION.md | 60-90 min |
| Automated validation | `./test-payment-security.sh` | 2-3 min |
| Troubleshooting issues | FLOW_7_PAYMENT_QUICKREF.md Issues | 5-10 min |
| Test card number | Above ↑ or this doc | immediate |
| Expected Sentry events | Above ↑ or PAYMENT_SECURITY_VERIFICATION.md | immediate |
| Email format check | PAYMENT_SECURITY_VERIFICATION.md Test C/E | 15-20 min |

---

## 🚀 You're Ready!

All three deliverables are in place:
- ✅ PAYMENT_SECURITY_VERIFICATION.md (comprehensive)
- ✅ FLOW_7_PAYMENT_QUICKREF.md (quick reference)
- ✅ test-payment-security.sh (automated)

Infrastructure verified:
- ✅ Stripe operational
- ✅ SendGrid operational
- ✅ Sentry monitoring active

When you reach **Flow 7** in Phase 2D QA:
1. Open FLOW_7_PAYMENT_QUICKREF.md
2. Follow the 9 steps
3. Use test card: 4242 4242 4242 4242
4. Document results

**Proceed with Phase 2D QA! 🚀**
