# State Machines

## Coach Approval

- `PENDING -> APPROVED`
  - requires organization context
  - activates organization membership
  - emits `COACH_APPROVED`
- `PENDING -> REJECTED`
  - may archive organization membership
  - emits `COACH_REJECTED`

## Ad Lifecycle

- `draft`
  - editable, not submitted, not live
- `pending`
  - submitted for moderation
  - may already be paid
  - never live
- `approved`
  - moderation passed
  - awaiting payment or activation
- `active`
  - approved and paid
  - eligible for feed delivery
- `rejected`
  - not eligible for checkout or delivery
- `archived`
  - inactive terminal state

### Allowed transitions

- `draft -> pending`
  - checkout submission
- `pending -> approved`
  - admin approval while unpaid
- `pending -> active`
  - admin approval while paid
- `approved -> active`
  - successful payment finalization
- `pending|approved -> rejected`
  - admin rejection

### Forbidden transitions

- `draft -> active`
- `draft -> approved`
- `pending -> active` from payment finalization alone
- any client-controlled write to `payment_status`
