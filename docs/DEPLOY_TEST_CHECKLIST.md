# Deploy Test Checklist

Run these flows systematically when a new build lands on Railway.

## 1. Coach onboarding step 3 — do Veteran and Legend plans show?

- [ ] Sign up or log in as coach
- [ ] Reach step 3 (plan selection)
- [ ] Verify **Veteran** and **Legend** plans are visible (not greyed out)
- [ ] No "Payments unavailable" or "Checkout unavailable" banner
- [ ] Plan cards show correct pricing ($0.99/month, $20/year)

## 2. Complete coach onboarding as Veteran — does payment go through?

- [ ] Select Veteran plan
- [ ] Enter team count (if prompted)
- [ ] Continue to Stripe checkout
- [ ] Complete payment (test card: 4242 4242 4242 4242)
- [ ] Return to app after payment
- [ ] Onboarding completes successfully
- [ ] User is marked as Veteran plan

## 3. Coach creates a team — does it save correctly?

- [ ] As coach, go to Create Team or Team Hub
- [ ] Create a new team (name, sport, etc.)
- [ ] Team saves without error
- [ ] Team appears in coach's managed teams
- [ ] Team details page loads correctly

## 4. Coach creates an event — does it appear on map?

- [ ] As coach, create an event (date, time, location, opponent)
- [ ] Event saves successfully
- [ ] Event appears on game map (after approval if required)
- [ ] Event detail page loads correctly

## 5. Fan finds event — can they RSVP?

- [ ] As fan, open app and view map or event list
- [ ] Find event created by coach
- [ ] Tap RSVP / Going
- [ ] RSVP saves successfully
- [ ] RSVP status shows correctly on event

## 6. Google sign in — does it work end to end?

- [ ] Sign out (or use fresh install)
- [ ] Tap "Sign in with Google"
- [ ] Complete Google OAuth flow
- [ ] User is signed in and redirected to app
- [ ] Profile and preferences load correctly

---

**Quick smoke test:** 1 → 2 → 3 → 4 → 5 → 6 in order.  
**Critical path:** 1 and 2 unlock revenue; 3–6 validate core flows.
