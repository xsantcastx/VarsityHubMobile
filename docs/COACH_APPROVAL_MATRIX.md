# Coach Approval Matrix

Current source of truth: `/auth/me` returns `account_state` plus `next_step`, and the client/router follows that pair directly. Approval status alone is not enough to decide coach access anymore.

## Canonical states

| Scenario                                              | Core server state                | `next_step`                                                                                                | Expected user destination   | Coach tools |
| ----------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------- | ----------- |
| Fan account                                           | `fan_active` or `fan_onboarding` | `/(tabs)` or onboarding step                                                                               | Fan app or onboarding       | No          |
| Coach missing basic info                              | `coach_basic_info_required`      | `/onboarding/step-2-basic`                                                                                 | Step 2                      | No          |
| Coach still needs application/setup                   | `coach_application_required`     | `/onboarding/coach-application` or `/onboarding/step-3-league`                                             | Application/setup flow      | No          |
| New-organization application submitted                | `coach_application_submitted`    | `/onboarding/league-pending-approval` or `/(tabs)` when proceeding as fan                                  | League pending approval     | No          |
| Join-request pending/rejected recovery                | `coach_pending_approval`         | `/onboarding/pending-approval`, `/onboarding/league-pending-approval`, or `/(tabs)` when proceeding as fan | Pending approval recovery   | No          |
| New-organization application rejected                 | `coach_application_rejected`     | `/onboarding/league-pending-approval` or `/(tabs)` when proceeding as fan                                  | League pending/reapply flow | No          |
| Approved, agreement still required                    | `coach_agreement_required`       | `/onboarding/coach-agreement`                                                                              | Agreement screen            | No          |
| Approved, agreement accepted, org/setup still missing | `coach_final_setup_required`     | `/onboarding/step-3-league`                                                                                | Final setup on step 3       | No          |
| Fully active coach                                    | `coach_active`                   | `/(tabs)`                                                                                                  | Main app with coach tools   | Yes         |

## Approval transitions

| Flow                       | Before approval               | Approval action                                  | After approval                                                                                                                               |
| -------------------------- | ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Join existing organization | `coach_pending_approval`      | Org owner/manager approves join request          | `coach_agreement_required` until agreement is accepted, then `coach_active`                                                                  |
| Create new organization    | `coach_application_submitted` | Platform admin approves organization/application | `coach_agreement_required` until agreement is accepted; if setup is still incomplete, `coach_final_setup_required`; otherwise `coach_active` |

## Contract rules

- Protected coach screens and server routes should treat `account_state` and `next_step` as the routing contract.
- `approval_status=APPROVED` is necessary but not sufficient for coach-tool access.
- `proceeding_as_fan=true` only changes waiting/rejected recovery routes. It must not rewrite the role or break later coach recovery.
- Pending join-request coaches stay on `/onboarding/pending-approval`.
- New-organization applicants stay on `/onboarding/league-pending-approval`.

## Verification checklist

- Submit coach upgrade and complete basic info.
- Submit join request or new organization application.
- Confirm `/auth/me` returns the expected waiting state and `next_step`.
- Approve the coach/org.
- Confirm `/auth/me` returns `coach_agreement_required`.
- Accept the agreement and confirm `/auth/me` returns either `coach_final_setup_required` or `coach_active`.
- Finish final setup when required and confirm `/auth/me` returns `coach_active`.
- Confirm coach tools, `/teams/managed`, and `/events/pending` only work once the account is `coach_active`.
