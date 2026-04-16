# VarsityHub Audit Review Gate

This checklist is the enforcement layer for the audit standard. It is one file with two sections because PR review and release readiness happen at different cadences.

Rules:
- Mark each item `Done`, `N/A`, or `Blocked`.
- `N/A` applies only when the change truly does not touch that surface.
- If a protected invariant changed, update this file and `docs/AUDIT_METHODOLOGY.md` in the same PR.

## Section A: PR Review Checklist

### Architecture And Boundaries

- [ ] Route wrappers stay thin; new business logic does not move into `app/` wrappers.
- [ ] Shared behavior was reused instead of duplicating hooks, utils, or API logic.
- [ ] No deep relative cross-feature imports were introduced.
- [ ] Screens did not add direct raw `fetch` calls where typed API clients should exist.

### Validation And Data Integrity

- [ ] Backend validation remains authoritative for protected behavior.
- [ ] Client input cannot set paid plan, approval state, privileged role, or ownership.
- [ ] Frontend validation does not drift from backend rules without an intentional documented reason.
- [ ] Critical multi-step writes remain transactional or otherwise race-safe.
- [ ] Async side-effect failure (promo, notification, billing) does not silently mark protected work complete.

### Auth, Roles, Plans, And Ownership

- [ ] Protected actions enforce auth, role, plan, and ownership on the server.
- [ ] Permission checks were not left UI-only.
- [ ] Deep-link or callback params for protected flows are validated before use.
- [ ] Owner removal, approval, or transfer flows preserve tenant safety and valid ownership state.
- [ ] Pending coach or onboarding flows that continue as fan use explicit server-safe preference updates, not implicit role escalation.

### Reliability And User Recovery

- [ ] Async screens still handle loading, error, success, and empty states explicitly.
- [ ] Forms block duplicate submit while requests are in flight.
- [ ] New user-facing errors are logged with context and surfaced with a recovery path.
- [ ] Async effects avoid unsafe state updates after unmount.

### Observability And Auditability

- [ ] Admin or protected state changes still emit audit logs or equivalent structured logs.
- [ ] Payment, auth, or approval changes preserve useful debugging context.
- [ ] Silent fallback behavior does not weaken security posture.

### Tests And Canonical Docs

- [ ] Relevant tests were added or updated for any changed invariant.
- [ ] If no test exists yet, the PR adds or preserves a grep-able enforcement anchor.
- [ ] `docs/AUDIT_METHODOLOGY.md` was updated if a canonical rule changed.
- [ ] `docs/AUDIT_REVIEW_GATE.md` was updated if reviewer/release checks changed.

## Section B: Release Readiness Checklist

> For security-relevant releases (auth, payments, approvals, ownership), use this section. For deploy mechanics (Railway, EAS, build artifacts), use [docs/release/CHECKLIST.md](./release/CHECKLIST.md).

### Critical Flow Verification

- [ ] Auth, onboarding, payments, approvals, and deep links were smoke-tested if touched.
- [ ] Security fixes include before/after exploit verification or equivalent proof.
- [ ] Payment success, webhook, retry, and cancellation paths were verified if billing changed.

### Quality Gates

- [ ] `lint` passes, or an explicit no-new-errors exception is documented.
- [ ] `typecheck` passes, or an explicit no-new-errors exception is documented.
- [ ] Relevant automated tests pass for touched protected flows.

### Data, Migrations, And Rollback

- [ ] Schema or contract changes include migration state and regeneration steps where needed.
- [ ] A rollback or safe revert path is documented for risky data or payment changes.
- [ ] Source-of-truth ownership is still clear for any changed protected state.

### Observability And Operations

- [ ] Logs, audit trails, or monitoring are sufficient to debug the changed flow in production.
- [ ] New env vars, secrets, or third-party dependencies are documented and verified.
- [ ] Risky launch items have a named owner for post-deploy verification.

## Derived From

- [Audit Standard](./AUDIT_METHODOLOGY.md)
- [Audit Execution Guide](./AUDIT_EXECUTION_GUIDE.md)
