# Verification Report — Fixes & Security Borders

**Date:** 2026-03-17  
**Scope:** PDF "LAST 101%" fixes + security boundary audit

---

## 1. Fix Verification

### 1.1 Supporting Documents (Organization Creation)
| Check | Status | Location |
|-------|--------|----------|
| Schema has `supporting_document_url` | ✅ | `server/prisma/schema.prisma` |
| Migration exists | ✅ | `server/prisma/migrations/20260317120000_add_supporting_document_to_organization/` |
| API accepts optional `supporting_document_url` | ✅ | `server/src/routes/organizations.ts` (createOrganizationSchema) |
| Frontend requires upload when creating new org | ✅ | `app/onboarding/step-3-league.tsx` (canContinue, upload flow) |
| Upload before create, pass URL in payload | ✅ | step-3-league.tsx onContinue |

### 1.2 Existing Organizations to Join
| Check | Status | Notes |
|-------|--------|-------|
| Search by name/zip | ✅ | useOrganizationSearch hook |
| Dropdown of org results | ✅ | showOrgDropdown, ScrollView of nearbyOrgs |
| Request to join flow | ✅ | requestToJoin, submitJoinRequest |

### 1.3 Organization Submission UI
| Check | Status | Notes |
|-------|--------|-------|
| No admin email shown to user | ✅ | league-pending-approval shows "VarsityHub is reviewing" |
| "Waiting for approval" messaging | ✅ | "Within 24 hours", "Continue as Fan" |

### 1.4 Back Button Navigation
| Check | Status | Location |
|-------|--------|----------|
| Conditional safeGoBack removed | ✅ | zip-code, feedback, edit-username, contact, dm-restrictions, create |
| Always use safeGoBack(router) | ✅ | All updated |
| Create tab in TAB_ROUTES | ✅ | `context/NavigationHistoryContext.tsx` |

### 1.5 Coaching Tools Error Handling
| Check | Status | Location |
|-------|--------|----------|
| APPROVAL_REQUIRED handling | ✅ | create-team, mobile-community, create-fan-event |
| PAYMENT_REQUIRED handling | ✅ | create-team, mobile-community, create-fan-event |
| "Go to Billing" action | ✅ | All three |

---

## 2. Security Borders Audit

### 2.1 Onboarding Bypass — FIXED
| Vector | Mitigation |
|--------|-------------|
| PATCH /me/preferences with `onboarding_completed: true` | ✅ Removed from schema; `delete incoming.onboarding_completed` |
| PATCH /me/preferences with `role: 'coach'` (fan→coach) | ✅ 403: "Use the upgrade flow to become a coach" |

### 2.2 Coach Role Bypass — FIXED
| Vector | Mitigation |
|--------|-------------|
| POST /me/complete-onboarding with role: coach, no org | ✅ 400: "Coaches must create or join an organization during onboarding" |
| Org creation sets approval_status: PENDING | ✅ organizations.ts transaction |
| Join request sets approval_status: PENDING (for coaches) | ✅ organizations.ts join-requests |

### 2.3 Backend Middleware Chain
| Route | Auth | Verified | Onboarded | Notes |
|-------|------|----------|-----------|-------|
| POST /organizations | ✅ | — | — | By design (onboarding step) |
| POST /organizations/create | ✅ | — | — | Same |
| PATCH /organizations/:id | ✅ | — | ✅ | |
| POST /teams, POST /teams/create | ✅ | ✅ | ✅ | |
| POST /games | ✅ | ✅ | ✅ | |
| POST /events | ✅ | ✅ | ✅ | |
| POST /posts | ✅ | ✅ | ✅ | |

### 2.4 requireOnboarded Logic
- Blocks if `preferences.onboarding_completed !== true`
- Blocks coaches with `approval_status === 'PENDING'`
- Blocks approved coaches who need checkout (Veteran/Legend, payment_pending)

### 2.5 Frontend Routing (AuthProvider)
- Unauthenticated → sign-in
- Pending verification → verify-email
- Pending coach (no proceeding_as_fan) → pending-approval or league-pending-approval
- Needs onboarding → onboarding/step-1-role
- Coach needs checkout → settings/manage-subscription
- Server is source of truth for `onboarding_completed` (User.me())

---

## 3. Remaining Considerations

1. **Migration:** Run `npx prisma migrate deploy` (or `npm run server:db:migrate`) to add `supporting_document_url` column.
2. **complete-onboarding:** Now requires `organization_id` or `join_request_pending` when role is coach. Both league-pending-approval and pending-approval pass these.
3. **Profile layout:** Avatar has `overflow: 'hidden'`; profileDetailsContainer has `paddingTop: 64`.

---

## 4. Approval Systems Verification (2026-03-17)

### 4.1 League/Organization Approval (Super Admin)

| Check | Status | Location |
|-------|--------|----------|
| Email sent on org create | ✅ | `sendLeagueApprovalRequestEmail` in organizations.ts |
| Recipient configurable | ✅ | Uses `ADMIN_EMAILS` first entry, fallback `emancero@varsityhub.app` |
| Token-based approve/reject links | ✅ | `GET/POST /organizations/:id/approve?token=...` |
| Sets `admin_approved: true` on approve | ✅ | organizations.ts atomic update |
| Sets creator `approval_status: APPROVED` | ✅ | organizations.ts transaction |

**Production check:** Ensure `ADMIN_EMAILS` is set on Railway (e.g. `emancero@varsityhub.app`) and email delivery works (SendGrid configured).

### 4.2 Coach Join Request Approval (League Owner)

| Check | Status | Location |
|-------|--------|----------|
| `Organization.mine()` returns owner/manager/admin orgs | ✅ | `GET /organizations/mine` — role in ['owner','manager','administrator'] |
| `pendingCoaches` requires owner role | ✅ | `GET /:id/pending-coaches` — 403 if not owner |
| `approveCoach` sets approval_status + paid_by_owner | ✅ | `POST /:id/coaches/:userId/approve` |
| `approveJoinRequest` (by request ID) aligned | ✅ | `POST /join-requests/:id/approve` now also sets approval_status + paid_by_owner |
| approvals.tsx uses pendingCoaches + approveCoach | ✅ | app/(tabs)/approvals.tsx |
| organization-join-requests uses getJoinRequests + approveJoinRequest | ✅ | app/organization-join-requests.tsx (fixed to map user-based API) |

**Note:** Only org owners can approve coaches. Managers see org in `mine()` but get 403 on pending-coaches.

### 4.3 Event Approvals

| Check | Status | Location |
|-------|--------|----------|
| `GET /events/pending` returns pending events | ✅ | events.ts — coaches/admins only |
| `PUT /events/:id/approve` | ✅ | requireVerified, requireOnboarded, team/org scope |
| `PUT /events/:id/reject` | ✅ | Same guards |
| event-approvals.tsx loads and approves | ✅ | app/(tabs)/event-approvals.tsx |

**Scope:** Coaches of the event's team, or org owners/managers, or platform admins can approve.

### 4.4 Ad Approval

| Check | Status | Notes |
|-------|--------|-------|
| Ads go to `pending` | ✅ | ads.ts |
| Admin approves via `POST /ads/:id/review` | ✅ | Admin-only |

---

## 5. Summary

All PDF fixes are implemented. Security borders are enforced:

- **Backend:** PATCH /me/preferences cannot set onboarding_completed or elevate role to coach. complete-onboarding requires org/join for coaches.
- **Backend:** requireOnboarded blocks non-onboarded users, pending coaches, and coaches who need checkout.
- **Frontend:** AuthProvider routes users to onboarding, verify, or pending screens based on server state.

**Approval systems:** League approval email uses ADMIN_EMAILS; coach join approval (both paths) sets user approval_status; event approvals scoped to team/org; all flows verified.
