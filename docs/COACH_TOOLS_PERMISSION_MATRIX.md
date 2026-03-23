# Coach Tools & Permissions Matrix (Release Checklist)

Last updated: 2026-03-23  
Audit method: static authorization review of backend route guards + frontend role gating.

## Personas

- **Admin**: platform admin email in `ADMIN_EMAILS`
- **Coach (Approved)**: `preferences.role=coach`, `approval_status=APPROVED`, onboarding complete
- **Coach (Pending/Rejected)**: `preferences.role=coach`, `approval_status!=APPROVED`
- **Fan**: non-coach account

## Gate behavior baseline

- `requireOnboarded` blocks unapproved coaches (`PENDING`/`REJECTED`) and incomplete onboarding.
- `requireOnboarded` bypasses checks for platform admins.
- Additional route-level ownership/membership checks still apply.

---

## Backend critical route matrix

| Route | Admin | Coach (Approved) | Coach (Pending/Rejected) | Fan | Status |
|---|---|---|---|---|---|
| `POST /teams` | Conditionally allowed by route logic | Allowed **only** if active org member + plan + coach checks | Blocked (`requireOnboarded`) | Blocked (`COACH_ROLE_REQUIRED`) | PASS |
| `POST /teams/create` | Conditionally allowed by route logic | Allowed with plan/org constraints; existing org requires active membership | Blocked (`requireOnboarded`) | Blocked (`COACH_ROLE_REQUIRED`) | PASS |
| `PUT /teams/:id` (incl org move) | Allowed | Allowed only if staff/org-owner and (if moving org) active member of target org | Blocked (`requireOnboarded`) | Blocked | PASS |
| `POST /teams/:id/invite` | Allowed | Allowed only for active staff; role whitelist enforced (no owner escalation) | Blocked (`requireOnboarded`) | Blocked | PASS |
| `POST /team-invites` | Allowed | Allowed only for active staff; requires verified + onboarded; role whitelist enforced | Blocked (`requireOnboarded`) | Blocked | PASS |
| `POST /ads/:id/submit-for-approval` | Allowed | Allowed (verified + onboarded) | Blocked (`requireOnboarded`) | Blocked | PASS |
| `DELETE /ads/:id` | Allowed if owner/admin | Allowed if owner + onboarded | Blocked (`requireOnboarded`) | Blocked (not owner/coach path) | PASS |
| `GET /events/pending` | Allowed | Allowed if coach/org-admin and scoped to managed teams/orgs | Blocked (`requireOnboarded`) | Blocked | PASS |
| `POST /events` | Allowed (auto-approve) | Auto-approve only if staff on selected home team or owner/manager of that team’s org; otherwise pending flow | Blocked (`requireOnboarded`) | Blocked (`requireOnboarded`) | PASS |
| `GET /games?show_pending=true` or non-approved `approval_status` | Allowed | Allowed only if active coach/org-admin membership | Blocked | Blocked | PASS |
| `GET /organizations` | Sees all | Sees admin-approved + own active/pending orgs | Sees admin-approved + own active/pending orgs | Sees admin-approved only | PASS |
| `GET /organizations/:id` (unapproved org) | Allowed | Allowed only if active member or pending join | Allowed only if active member or pending join | Hidden as 404 | PASS |
| `POST /organizations/:id/coaches/:userId/approve` | Allowed if owner path + onboarded; org must be admin-approved | Allowed only for org owner + onboarded; org must be admin-approved | Blocked (`requireOnboarded`) | Blocked | PASS |
| `POST /organizations/join-requests/:requestId/approve|deny` | Allowed if org admin + onboarded | Allowed only for org owner/manager + onboarded | Blocked (`requireOnboarded`) | Blocked | PASS |
| `PUT /games/:id/approve` | Allowed | Allowed only if active team staff on home/away team | Blocked (`requireOnboarded`) | Blocked | PASS |

---

## Frontend coach-gating matrix

| Surface | Admin | Coach (Approved) | Coach (Pending/Rejected) | Fan | Status |
|---|---|---|---|---|---|
| Global auth routing (`AuthProvider`) | Allowed | Allowed | Redirected to pending-approval flow unless proceeding as fan | Allowed | PASS |
| Coach checkout gate (manage-subscription redirect) | Enforced only for coach plans | Enforced across native + web for pending paid checkout | N/A (blocked earlier) | N/A | PASS |
| `Manage Teams` screen | Admin bypass not direct UI path | Requires `role=coach` + `approval_status=APPROVED` | Blocked client-side + server-side | Blocked | PASS |
| `Event Approvals` screen | Admin via backend capabilities | Requires `role=coach` + `approval_status=APPROVED` | Blocked client-side + server-side | Blocked | PASS |
| Discover quick actions | Admin/coach tools shown appropriately | Coach tools shown when approved | Hidden/blocked | Hidden/blocked | PASS |

---

## Notes / intentional behavior

- Some organization onboarding endpoints remain `requireAuth` (not `requireOnboarded`) to support onboarding-time organization setup.
- Ads listing/edit paths are owner/admin scoped and not strictly coach-only by product design.

## Commits covering this matrix

- `1e6acf13` — coach authorization + hierarchy hardening
- (current turn) additional consistency hardening:
  - org join-request moderation requires `requireOnboarded`
  - game approval requires active team membership
  - frontend approved-coach guard improvements + cross-platform checkout gate
