# Coach Tools & Permissions Matrix

Last updated: 2026-05-30

Coach UI should follow the same staged contract as the server. The correct question is not "is `approval_status=APPROVED`?" but "is this account `coach_active` and therefore allowed to use coach tools?"

## Personas

- `Admin`: platform admin override.
- `Coach (Active)`: `role=coach`, `approval_status=APPROVED`, `account_state=coach_active`.
- `Coach (Recovering)`: coach account in any staged state such as `coach_pending_approval`, `coach_agreement_required`, or `coach_final_setup_required`.
- `Fan`: non-coach account.

## Route baseline

- `requireOnboarded` is still the backend enforcement layer.
- Client routing should mirror server `account_state` and `next_step`.
- Coach surfaces should use shared access helpers so staged approved coaches do not see active-coach actions early.

## Critical surfaces

| Surface                               | Admin   | Coach (Active)                | Coach (Recovering)                | Fan                                          |
| ------------------------------------- | ------- | ----------------------------- | --------------------------------- | -------------------------------------------- |
| `Manage Teams`                        | Allowed | Allowed                       | Redirect to server recovery route | Blocked                                      |
| `Event Approvals`                     | Allowed | Allowed                       | Redirect to server recovery route | Blocked                                      |
| `Create Team`                         | Allowed | Allowed                       | Blocked until `coach_active`      | Blocked unless org-manager exception applies |
| Coach quick actions in Discover       | Allowed | Visible                       | Hidden                            | Hidden                                       |
| Quick Add Game / coach event creation | Allowed | Coach mode                    | Fan mode until `coach_active`     | Fan mode                                     |
| Org join-request moderation           | Allowed | Allowed when org role permits | Blocked                           | Blocked                                      |

## Release checks

- A `coach_agreement_required` user must not see active coach quick actions.
- A `coach_final_setup_required` user must be sent back to step 3 instead of coach tools.
- A `coach_active` user must reach coach tools without redirect loops.
- Admin override must still bypass coach recovery screens.
