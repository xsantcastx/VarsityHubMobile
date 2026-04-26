# Coach Device UAT

This is the focused manual certification bundle for the coach surface. It assumes the backend/client guard audit is already green and uses real-device runtime checks to certify navigation, billing UX, blocked-state messaging, and state transitions.

## Commands

```bash
# Static/runtime baseline before manual testing
npm run coach:uat:baseline

# Seed the six coach UAT accounts in the current DATABASE_URL
npm run coach:uat:prepare
```

The seed script creates the account matrix below, one shared password, one managed team per approved coach, and rookie fixtures for the approvals screen.

## Seeded Account Matrix

Default password: `CoachUAT2026!`

The script prints the final emails if you override `COACH_UAT_EMAIL_DOMAIN` or `COACH_UAT_PASSWORD`.

| State | Default email | Expected first meaningful check |
|---|---|---|
| Approved rookie coach + agreement | `coach-uat-rookie@varsityhub.test` | Coach screens open; premium-only upsells remain gated |
| Approved veteran coach + paid | `coach-uat-veteran@varsityhub.test` | Veteran entitlements persist after restart |
| Approved legend coach + paid | `coach-uat-legend@varsityhub.test` | Legend entitlements persist after restart |
| Paid-by-owner coach | `coach-uat-owner-covered@varsityhub.test` | Premium access works without self-checkout |
| Approved coach missing agreement | `coach-uat-missing-agreement@varsityhub.test` | Direct coach navigation redirects to `/onboarding/coach-agreement` |
| Pending/rejected coach in fan mode | `coach-uat-rejected-fan@varsityhub.test` by default | Coach tools blocked, fan-safe actions still usable |

Note: set `COACH_UAT_FAN_MODE_STATUS=PENDING` before `npm run coach:uat:prepare` if you want the sixth account seeded as pending instead of rejected.

## Surface To Certify

### Coach-only screens

- `/manage-teams`
- `/manage-season`
- `/manage-users`
- `/event-approvals`
- `/approvals`
- `/team-contacts`
- `/my-team`
- `/team-hub`
- `/create-team`
- `/edit-team`

### Quick Actions

- `Manage Teams`
- `Team Schedule`
- `Approvals`
- `Manage Org`

## Manual Pass

### 1. Allowed-state checks

Run these on rookie, veteran, legend, and paid-by-owner accounts.

- Sign in, land on Discover, and confirm the 4 coach Quick Actions render on first load.
- Open each Quick Action and verify first-tap navigation, data load, and back navigation.
- Open each coach-only screen directly from app navigation or deep link and confirm no blank state, spinner loop, or redirect bounce.
- Pull to refresh on `manage-teams`, `event-approvals`, and any screen that exposes refresh; confirm coach access is retained.
- Kill and relaunch the app on veteran and legend; confirm paid entitlements and coach access still match the signed-in account.

### 2. Blocked-state checks

- Missing-agreement account:
  - Attempt each coach-only route directly.
  - Confirm redirect or CTA lands on `/onboarding/coach-agreement`.
  - Accept the agreement and confirm coach tools unlock without a forced logout/login cycle.
- Pending/rejected fan-mode account:
  - Attempt each coach-only route directly.
  - Confirm coach tools stay blocked.
  - Confirm normal fan-safe actions still work.
  - If using rejected mode, verify rejected messaging and reapply affordance/cooldown copy.

### 3. Billing checks

- Rookie account:
  - Confirm coach tools load.
  - Confirm premium-only subscription prompts are distinct from generic auth failures.
- Veteran and legend accounts:
  - Confirm plan state is visible in billing/settings UI.
  - Confirm no regression after app restart.
- Paid-by-owner account:
  - Open `settings/manage-subscription`.
  - Confirm the user is shown as covered by the owner league and is not asked to self-pay.

### 4. Approval and deep-link checks

- Rookie account:
  - Open `Approvals` and verify the seeded pending event/game list loads.
- If a live notification/deep link is available:
  - Coach approval follow-up should land on the agreement flow when agreement is missing.
  - Event/game approval links should land on the approval screen without losing auth state.

## Acceptance Criteria

- No non-approved coach reaches a functional coach screen.
- No approved coach with current agreement and valid billing is incorrectly blocked.
- Quick Actions route correctly on first tap.
- No stale offline/auth latch appears after refresh or relaunch.
- `COACH_AGREEMENT_REQUIRED`, `APPROVAL_REQUIRED`, `APPROVAL_REJECTED`, and `PAYMENT_REQUIRED` are surfaced with distinct UX.
- Paid-by-owner never falls into self-checkout.

## Evidence

Use [COACH_DEVICE_UAT_RESULTS_TEMPLATE.md](/Users/varsityhub/VarsityHubMobile/docs/COACH_DEVICE_UAT_RESULTS_TEMPLATE.md) for sign-off.

- Record pass/fail per account and surface.
- Capture screenshots or video only for failures or ambiguous behavior.
- Add request/response evidence only when runtime behavior contradicts the existing coach gate audit.
