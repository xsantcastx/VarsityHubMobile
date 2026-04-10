# Overnight Tasks: 2026-04-10

## Goal

Get the app into a stable, testable state this week by finishing the highest-risk gaps that are still open after the latest security, privacy, admin, approval, and payment fixes.

## Done Today

- Scoped pending event approvals so coaches and organization admins only see and review events tied to teams or organizations they manage.
- Fixed ad checkout to return through `payment-success` instead of leaving users stranded on the calendar screen.
- Blocked admin approval of unpaid ads.
- Aligned free-promo ad reservations with the paid path by setting ads to `active` when payment is fully covered.

## P0: Must Finish Next

### 1. Billing and pricing parity

- Align live billing values to the feature matrix:
  - Veteran: `$1.00` per team per month
  - Legend: `$29.99/year`
  - First 100 Legend promo: `$14.99/year`
  - Ad weekday slot: `$4.99`
  - Ad weekend slot: `$7.99`
- Verify these files together:
  - `app/ad-calendar.tsx`
  - `src/config/plan-definitions.json`
  - `server/src/routes/payments.ts`
  - `server/src/lib/adPricing.ts`
- Manual check:
  - create checkout session for Veteran
  - create checkout session for Legend
  - create ad checkout with weekday and weekend dates

### 2. iOS paid subscriptions are still blocked

- Decide whether this week ships with:
  - Apple IAP implemented, or
  - paid plans temporarily hidden on iOS with a documented launch limitation
- Current gap:
  - `app/subscription-paywall.tsx` hides Veteran and Legend on iOS
- If shipping without IAP this week:
  - document it in README and release notes
  - remove any misleading upgrade copy on iOS

### 3. CI is still giving false confidence

- Database-backed server tests are skipped in GitHub Actions because `CI=true`.
- Fix one of these paths:
  - provision a CI test database and run DB tests for real
  - or invert/remove the `shouldSkipDbTests` logic
- Validate:
  - `npm --prefix server test -- --runInBand`
  - GitHub Actions run shows real DB tests executed, not skipped

## P1: Revenue and user-flow correctness

### 4. Subscription cancellation state

- Current issue:
  - UI downgrades the user plan immediately even when Stripe remains active until period end
- Fix:
  - preserve paid plan access until `current_period_end`
  - show scheduled cancellation instead of immediate downgrade

### 5. Team creation payment rollback path

- Current issue:
  - quantity update or checkout can succeed before team creation fails
- Fix:
  - make post-payment team creation idempotent
  - add compensation path when Stripe succeeded but DB creation failed

### 6. Ad rejection refund path

- Current issue:
  - rejection logic still resets payment state without an automated refund flow
- Fix one of these:
  - create Stripe refund on reject
  - or stop clearing paid reservations until refund is completed

## P1: Onboarding blockers

### 7. Reconcile tracked vs untracked onboarding screens

- Current repo state includes untracked onboarding files:
  - `app/onboarding/pending-approval.tsx`
  - `app/onboarding/league-pending-approval.tsx`
  - `app/onboarding/step-3-league.tsx`
- Before more onboarding fixes:
  - decide whether these should be tracked
  - reconcile them with the committed router tree

### 8. Fix remaining onboarding runtime issues in tracked routes

- Verify and patch:
  - E2E bypass cannot affect production builds
  - no silent downgrade to Rookie after payment failure
  - step navigation cannot loop when role hydration is late
  - authorized-user step cannot be skipped

## P2: Admin and moderation follow-through

### 9. Finish organization join-request management in primary coach/admin flows

- `app/organization-join-requests.tsx` exists, but the main approvals experience should route admins to it consistently.
- Ensure org admins can actually reach approve/reject actions from the current navigation.

### 10. Expand admin audit logging coverage

- Confirm high-impact actions are logged:
  - organization approve/reject
  - coach approve/reject
  - moderation warning/strike/suspend
  - content takedown

### 11. Add unread notification count endpoint

- Needed for badge correctness without fetching the full notification list.

## Manual Verification Checklist

- `npm --prefix server run typecheck`
- `npx eslint app/ad-calendar.tsx 'app/(tabs)/event-approvals.tsx'`
- Start server and app locally
- Verify:
  - fan-created event shows only to the right coach/admin reviewer
  - another coach from an unrelated team cannot approve it
  - ad checkout returns to `payment-success`
  - free promo ad ends in `status=active` and `payment_status=paid`
  - unpaid ad approval is blocked in admin ads

## Shipping Order For This Week

1. Pricing parity
2. CI with real DB tests
3. iOS subscription decision
4. team/payment rollback protections
5. onboarding cleanup after tracked/untracked file reconciliation
