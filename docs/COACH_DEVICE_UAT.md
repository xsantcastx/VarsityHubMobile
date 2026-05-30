# Coach Device UAT

This is the focused manual certification bundle for the coach surface. It assumes the backend/client guard audit is already green and uses real-device runtime checks to certify navigation, billing UX, blocked-state messaging, and state transitions.

Current policy: coach-feature access is controlled by the full server recovery contract, not approval alone. An approved coach who has not accepted the current agreement must remain in `coach_agreement_required` and be redirected to `/onboarding/coach-agreement` until that step is completed.

## Commands

```bash
# Static/runtime baseline before manual testing
npm run coach:uat:baseline

# Seed the six coach UAT accounts in the current DATABASE_URL
npm run coach:uat:prepare

# Runtime verification for fan signup + org manager access + public fan join block
npm --prefix server run verify:org-manager-access
```

The seed script creates the account matrix below, one shared password, one managed team per approved coach, and rookie fixtures for the approvals screen.

## Seeded Account Matrix

Default password: `CoachUAT2026!`

The script prints the final emails if you override `COACH_UAT_EMAIL_DOMAIN` or `COACH_UAT_PASSWORD`.

| State                              | Default email                                       | Expected first meaningful check                           |
| ---------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Approved rookie coach + agreement  | `coach-uat-rookie@varsityhub.test`                  | Coach screens open; premium-only upsells remain gated     |
| Approved veteran coach + paid      | `coach-uat-veteran@varsityhub.test`                 | Veteran entitlements persist after restart                |
| Approved legend coach + paid       | `coach-uat-legend@varsityhub.test`                  | Legend entitlements persist after restart                 |
| Paid-by-owner coach                | `coach-uat-owner-covered@varsityhub.test`           | Premium access works without self-checkout                |
| Approved coach missing agreement   | `coach-uat-missing-agreement@varsityhub.test`       | Coach tools blocked; recovery routes redirect to agreement |
| Pending/rejected coach in fan mode | `coach-uat-rejected-fan@varsityhub.test` by default | Coach tools blocked, fan-safe actions still usable        |

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

### Org admin and public fan surfaces

- `/organization?id=<org_id>`
- `/organization-join-requests`
- `/approvals`
- `/event-approvals`
- Public org profile opened while signed in as a normal fan

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
  - Confirm coach tools remain blocked until the agreement is accepted.
  - Confirm recovery lands on `/onboarding/coach-agreement` without a redirect loop.
  - Accept the agreement and confirm coach access unlocks cleanly without a forced logout/login cycle.
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
- Missing-agreement account:
  - Confirm missing agreement blocks coach access until acceptance.
  - Confirm any billing UI still behaves as informational or premium-specific, not as the reason for the block.

### 4. Approval and deep-link checks

- Rookie account:
  - Open `Approvals` and verify the seeded pending event/game list loads.
- If a live notification/deep link is available:
  - Coach approval follow-up should land in the agreement screen first when the agreement is still missing, and continue into the approved coach experience after acceptance.
  - Event/game approval links should land on the approval screen without losing auth state.

### 5. Org manager and public fan checks

Run these with one real org owner account, one fan-role org manager account, and one normal fan.

- Fan-role org manager:
  - Open `/approvals` and confirm it opens instead of redirecting away.
  - Open `/event-approvals` and confirm it opens instead of redirecting away.
  - Open the organization profile and confirm:
    - admin tools render
    - `Invite Coach` is visible
    - `Edit Profile` is not visible
    - `Coach Requests` only appears if the account is the owner, not just a manager
  - Confirm pending event/game moderation data loads from the seeded org/team.
- Normal public fan:
  - Open the same organization profile.
  - Confirm `Request to Join` is not shown on the org profile.
  - Confirm the fan can still follow/unfollow normally.
  - If testing via the dedicated join-organization flow, confirm the API still blocks the request with the coach-upgrade message.

### 6. Runtime evidence to capture

- Save the output from `npm --prefix server run verify:org-manager-access`.
- If the device UI contradicts the script result, capture:
  - account email used
  - exact route/screen entered
  - screenshot or short video
  - matching API response if available

## Acceptance Criteria

- No non-approved coach reaches a functional coach screen.
- No fully completed approved coach is incorrectly blocked.
- Missing-agreement fixtures are blocked only on the agreement gate and recover cleanly after acceptance.
- A fan-role user with active `manager` org membership can reach org-admin surfaces without being treated as org owner.
- A normal fan is not shown a false `Request to Join` CTA on the organization profile.
- Quick Actions route correctly on first tap.
- No stale offline/auth latch appears after refresh or relaunch.
- `APPROVAL_REQUIRED` and `APPROVAL_REJECTED` are surfaced with distinct UX for blocked users.
- Paid-by-owner never falls into self-checkout.

## Evidence

Use [COACH_DEVICE_UAT_RESULTS_TEMPLATE.md](/Users/varsityhub/VarsityHubMobile/docs/COACH_DEVICE_UAT_RESULTS_TEMPLATE.md) for sign-off.

- Record pass/fail per account and surface.
- Capture screenshots or video only for failures or ambiguous behavior.
- Add request/response evidence only when runtime behavior contradicts the existing coach gate audit.
