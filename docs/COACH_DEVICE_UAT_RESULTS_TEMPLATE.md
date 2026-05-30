# Coach Device UAT Results Template

## Session Metadata

| Field                 | Value                                               |
| --------------------- | --------------------------------------------------- |
| Tester                |                                                     |
| Date                  |                                                     |
| App build             |                                                     |
| Backend environment   |                                                     |
| Seed command used     | `npm run coach:uat:prepare`                         |
| Baseline command used | `npm run coach:uat:baseline`                        |
| Manager verify script | `npm --prefix server run verify:org-manager-access` |

## Account Matrix

| Account state             | Email used | Login | Expected gate                                      | Actual outcome | Pass/Fail | Notes |
| ------------------------- | ---------- | ----- | -------------------------------------------------- | -------------- | --------- | ----- |
| Rookie approved           |            |       | Coach tools open                                   |                |           |       |
| Veteran approved + paid   |            |       | Paid entitlements persist                          |                |           |       |
| Legend approved + paid    |            |       | Paid entitlements persist                          |                |           |       |
| Paid by owner             |            |       | No self-checkout prompt                            |                |           |       |
| Missing agreement         |            |       | Coach tools blocked until agreement acceptance     |                |           |       |
| Pending/rejected fan mode |            |       | Coach tools blocked, fan-safe paths work           |                |           |       |
| Fan-role org manager      |            |       | Org admin surfaces open, owner-only actions hidden |                |           |       |
| Public fan                |            |       | Org profile has no false join CTA                  |                |           |       |

## Quick Actions

| Account state             | Manage Teams | Team Schedule | Approvals | Manage Org | Back nav | Refresh | Notes |
| ------------------------- | ------------ | ------------- | --------- | ---------- | -------- | ------- | ----- |
| Rookie approved           |              |               |           |            |          |         |       |
| Veteran approved + paid   |              |               |           |            |          |         |       |
| Legend approved + paid    |              |               |           |            |          |         |       |
| Paid by owner             |              |               |           |            |          |         |       |
| Missing agreement         | blocked      | blocked       | blocked   | blocked    | n/a      | n/a     |       |
| Pending/rejected fan mode |              |               |           |            |          |         |       |
| Fan-role org manager      |              |               |           |            |          |         |       |
| Public fan                |              |               |           |            |          |         |       |

## Coach Screens

| Screen             | Rookie | Veteran | Legend | Paid by owner | Missing agreement | Pending/rejected fan mode | Notes |
| ------------------ | ------ | ------- | ------ | ------------- | ----------------- | ------------------------- | ----- |
| `/manage-teams`    |        |         |        |               |                   |                           |       |
| `/manage-season`   |        |         |        |               |                   |                           |       |
| `/manage-users`    |        |         |        |               |                   |                           |       |
| `/event-approvals` |        |         |        |               |                   |                           |       |
| `/approvals`       |        |         |        |               |                   |                           |       |
| `/team-contacts`   |        |         |        |               |                   |                           |       |
| `/my-team`         |        |         |        |               |                   |                           |       |
| `/team-hub`        |        |         |        |               |                   |                           |       |
| `/create-team`     |        |         |        |               |                   |                           |       |
| `/edit-team`       |        |         |        |               |                   |                           |       |

## Org admin and public fan surfaces

| Surface                  | Owner | Fan-role manager | Public fan | Notes |
| ------------------------ | ----- | ---------------- | ---------- | ----- |
| `/approvals`             |       |                  |            |       |
| `/event-approvals`       |       |                  |            |       |
| Org profile admin tools  |       |                  |            |       |
| `Invite Coach` visible   |       |                  |            |       |
| `Edit Profile` visible   |       |                  |            |       |
| `Coach Requests` visible |       |                  |            |       |
| `Request to Join` shown  |       |                  |            |       |

## Billing / Agreement / Relaunch

| Check                                                                    | Result | Notes |
| ------------------------------------------------------------------------ | ------ | ----- |
| Missing-agreement account redirects to agreement until acceptance         |        |       |
| Missing-agreement account gains coach access immediately after acceptance |        |       |
| Veteran account retains entitlements after app restart              |        |       |
| Legend account retains entitlements after app restart               |        |       |
| Paid-by-owner account shows covered billing state                   |        |       |
| Rookie account sees correct premium upsell path                     |        |       |

## Deep Link / Notification Entry

| Entry path                                            | Result | Notes |
| ----------------------------------------------------- | ------ | ----- |
| Coach-approval follow-up to approved coach experience |        |       |
| Event/game approval deep link                         |        |       |
| Manager account can open org-admin surfaces           |        |       |
| Public fan org profile hides false join CTA           |        |       |

## Issues

| Severity | Surface | Account | Repro steps | Expected | Actual | Evidence |
| -------- | ------- | ------- | ----------- | -------- | ------ | -------- |
|          |         |         |             |          |        |          |
