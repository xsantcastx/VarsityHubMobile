# Coach Onboarding Smoke Test

Use this as the release gate for coach-onboarding changes. If Tests 1–4 all pass, ship. If Test 4 fails, do not ship.

## Prereqs

- Dev client built on a real iOS or Android device
- Two fresh test emails, both age 18+
- Admin console access to approve orgs and reject coaches
- Railway logs open for debugging

## Test 1 — Fresh Coach Sign-Up + Org Pending

1. Launch the app fresh.
2. Sign up with a new coach test email and verify the email.
3. Upgrade to Coach and select `Rookie`.
4. Complete Step 2.
5. In Step 3, create a new league and submit.

Pass:

- Lands on `/onboarding/league-pending-approval`
- Shows waiting-for-admin-approval messaging
- Railway logs show periodic `GET /auth/me`

Fail:

- Stuck on Step 3
- Lands on coach tools without pending approval

## Test 2 — Approval Polling → Agreement Acceptance

1. Approve the coach org or coach in the admin console.
2. Wait for polling to detect approval.
3. Tap `Go to Coach Tools`.
4. Confirm the app lands on `/onboarding/coach-agreement`.
5. Accept the agreement.

Pass:

- Redirects to `/(tabs)/team-hub` or the next required coach step
- Coach tools are accessible
- Railway logs show `PATCH /auth/me/preferences`

Fail:

- Stuck on the agreement screen
- Visible error or failed redirect after approval

## Test 3 — Rejection Cooldown UX

1. Reject a second coach application in the admin console.
2. Refresh the pending screen in the app.
3. Confirm rejection reason is shown.
4. Tap `Try Again`.

Pass:

- Visible cooldown message
- Shows remaining hours or retry timestamp
- No silent failure

Fail:

- Button does nothing
- Generic error without cooldown details

## Test 4 — Paid-Tier Checkout Gate

1. Create a fresh coach and select `Veteran`.
2. Cancel the payment sheet.
3. Return to the app with `payment_pending=true`.
4. Attempt a coach-only action such as `Create Team`.

Pass:

- Server returns `403 PAYMENT_REQUIRED`, or
- Client redirects to `/settings/manage-subscription`

Fail:

- Unpaid coach can access coach tools or create a team

This is a ship blocker.

## Test 5 — Org Not Admin Approved Edge

1. Create a coach and org.
2. Approve the coach but leave the org `admin_approved=false`.
3. Attempt to use coach tools.

Pass:

- User sees a clear org-approval message

Fail:

- Blank screen
- Silent 403
- Generic error without explanation

This is non-blocking unless the failure spills into the main coach flows.

## Ship Rule

- Tests 1–4 pass: ship
- Test 4 fails: do not ship
- Test 5 fails: log it and defer unless it blocks the main flow

## If All Pass

1. Push the release commits.
2. Watch Railway auto-deploy.
3. Run the client OTA release step.
4. Monitor Sentry for transport or response-shape spikes.

## If A Critical Test Fails

1. Do not push.
2. Revert the offending commit if needed.
3. Save the exact repro for follow-up.
