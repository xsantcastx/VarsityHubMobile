# Source Of Truth Registry

## coach approval_status

- Owner: server
- Canonical storage: `User.preferences.approval_status`
- Writers:
  - organization invite acceptance
  - organization join-request approval/rejection
  - admin coach moderation with organization context
- Readers:
  - team creation
  - game creation
  - onboarding pending screens
  - coach agreement screen
  - profile badge
- Invariants:
  - `APPROVED` requires organization context
  - approval transitions emit `COACH_APPROVED` or `COACH_REJECTED`
  - route handlers must call shared coach approval helpers instead of mutating preferences inline

## organization status

- Owner: server
- Canonical storage: `Organization.status`
- Writers:
  - admin organization review
- Readers:
  - league pending approval flow
  - admin organization screens
  - organization discovery and onboarding
- Invariants:
  - activating an organization must sync the owner coach approval path
  - rejecting an organization must archive the owner membership and reject coach approval

## ad status

- Owner: server
- Canonical storage: `Ad.status`
- Valid states:
  - `draft`
  - `pending`
  - `approved`
  - `active`
  - `rejected`
  - `archived`
- Writers:
  - ad creation
  - checkout submission
  - admin ad review
  - payment finalization
- Readers:
  - admin ads
  - my ads
  - feed ad delivery
- Invariants:
  - checkout submission moves `draft -> pending`
  - admin approval moves `pending -> approved` when unpaid
  - admin approval moves `pending -> active` when already paid
  - payment finalization moves `approved -> active`
  - payment finalization on `draft|pending` must not auto-activate the ad

## ad payment_status

- Owner: server
- Canonical storage: `Ad.payment_status`
- Writers:
  - ad creation
  - payment finalization
  - refund flows
- Readers:
  - feed ad delivery
  - admin ads
  - my ads
- Invariants:
  - clients cannot set `payment_status`
  - paid ads are not necessarily active
  - feed requires both `payment_status='paid'` and `status='active'`

## subscription plan

- Owner: server
- Canonical storage: `User.preferences.plan`
- Writers:
  - subscription checkout finalization
  - explicit downgrade/reset flows
- Readers:
  - onboarding plan step
  - manage subscription
  - team and organization plan gates
- Invariants:
  - paid plans are only persisted after successful payment finalization
  - platform purchase rules must match UI messaging
