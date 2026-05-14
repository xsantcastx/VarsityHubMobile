# Coach Device UAT Results Template

## Session Metadata

| Field                 | Value                        |
| --------------------- | ---------------------------- |
| Tester                |                              |
| Date                  |                              |
| App build             |                              |
| Backend environment   |                              |
| Seed command used     | `npm run coach:uat:prepare`  |
| Baseline command used | `npm run coach:uat:baseline` |

## Account Matrix

| Account state             | Email used | Login | Expected gate                            | Actual outcome | Pass/Fail | Notes |
| ------------------------- | ---------- | ----- | ---------------------------------------- | -------------- | --------- | ----- |
| Rookie approved           |            |       | Coach tools open                         |                |           |       |
| Veteran approved + paid   |            |       | Paid entitlements persist                |                |           |       |
| Legend approved + paid    |            |       | Paid entitlements persist                |                |           |       |
| Paid by owner             |            |       | No self-checkout prompt                  |                |           |       |
| Missing agreement         |            |       | Coach tools still open                   |                |           |       |
| Pending/rejected fan mode |            |       | Coach tools blocked, fan-safe paths work |                |           |       |

## Quick Actions

| Account state             | Manage Teams | Team Schedule | Approvals | Manage Org | Back nav | Refresh | Notes |
| ------------------------- | ------------ | ------------- | --------- | ---------- | -------- | ------- | ----- |
| Rookie approved           |              |               |           |            |          |         |       |
| Veteran approved + paid   |              |               |           |            |          |         |       |
| Legend approved + paid    |              |               |           |            |          |         |       |
| Paid by owner             |              |               |           |            |          |         |       |
| Missing agreement         |              |               |           |            |          |         |       |
| Pending/rejected fan mode |              |               |           |            |          |         |       |

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

## Billing / Agreement / Relaunch

| Check                                                               | Result | Notes |
| ------------------------------------------------------------------- | ------ | ----- |
| Missing-agreement account keeps coach access without forced relogin |        |       |
| Veteran account retains entitlements after app restart              |        |       |
| Legend account retains entitlements after app restart               |        |       |
| Paid-by-owner account shows covered billing state                   |        |       |
| Rookie account sees correct premium upsell path                     |        |       |

## Deep Link / Notification Entry

| Entry path                                            | Result | Notes |
| ----------------------------------------------------- | ------ | ----- |
| Coach-approval follow-up to approved coach experience |        |       |
| Event/game approval deep link                         |        |       |

## Issues

| Severity | Surface | Account | Repro steps | Expected | Actual | Evidence |
| -------- | ------- | ------- | ----------- | -------- | ------ | -------- |
|          |         |         |             |          |        |          |
