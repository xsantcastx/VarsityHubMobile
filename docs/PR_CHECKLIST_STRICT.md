# PR Checklist (Strict)

Use this checklist for changes touching auth, approvals, payments, ownership, billing, deep links, or moderation.

`N/A` is allowed only with a concrete reason.

## Rule-Type Coverage

- [ ] Each requirement in this PR is tagged as: Audit Step, Engineering Standard, Business Rule, or Release Gate.

## Flow and Boundary Proof

- [ ] Full flow is documented: client -> API -> DB -> async/webhook -> final client state.
- [ ] Source of truth is stated for each changed critical domain state.
- [ ] Trust boundaries touched are listed: client, deep link, webhook, admin, storage, third party.
- [ ] Threat-model impacts are addressed (auth bypass, escalation, IDOR, replay, spoofing, stale state).

## Validation and Drift

- [ ] Frontend and backend validation are intentionally aligned.
- [ ] No client-controlled field can set role, plan, approval, payment, or ownership state.
- [ ] Privileged actions fail closed on missing/malformed input.
- [ ] Public navigation/deep links fail gracefully without side effects.

## Auth, Role, Plan, Ownership

- [ ] Protected routes enforce server-side auth + role + plan + ownership where applicable.
- [ ] UI visibility is not the only gate for privileged actions.
- [ ] Sensitive response payloads are sanitized.
- [ ] Admin/reviewer mutations create audit evidence (actor, target, action, timestamp).

## Payments and Async Safety

- [ ] Payment/subscription state changes only occur after trusted server verification.
- [ ] Webhooks/callbacks/retries are replay-safe and idempotent.
- [ ] Success screens verify backend state, not only query params.
- [ ] Refund/reject/cancel paths preserve financial consistency.

## Reliability and UX

- [ ] Async screens include loading, success, error, and empty states.
- [ ] Forms block double-submit and expose recovery actions.
- [ ] No silent `catch {}` on user-expected success paths.
- [ ] Critical controls expose loading/disabled state while requests are in flight.

## Verification Evidence (Required)

- [ ] `npm run typecheck` passes
- [ ] `npx tsc --noEmit --project server/tsconfig.json` passes
- [ ] `npm run verify:guardrails` passes
- [ ] `npm run verify:release` passes
- [ ] Critical tests for touched scope pass (or `N/A` with owner and follow-up)
- [ ] Runtime smoke evidence attached for touched critical flows

## Deploy and Rollback

- [ ] Deploy order is safe for contract/schema changes.
- [ ] Rollback path is documented.
- [ ] Migration/backfill plan is documented (if applicable).
- [ ] Residual risk and follow-up owners are recorded.
