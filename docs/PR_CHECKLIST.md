# Pull Request Checklist

> Every line needs a pass/fail answer. `N/A` is valid only with a reason.
> Canonical policy lives in [`AUDIT_STANDARD.md`](./AUDIT_STANDARD.md). This
> file is the operating review gate for PRs.

## Copy/Paste "Secure Borders" Block

Use this block directly in PR descriptions when the change touches auth,
payments, approvals, ownership, geofencing, or other privileged flows.

```md
### Secure Borders (Required)

- [ ] Protected mutations touched here enforce auth + role + plan + ownership server-side where applicable
- [ ] No client-controlled field can set role, plan, approval, payment, or ownership state
- [ ] Privileged flows fail closed on missing/malformed params (public navigation can fail gracefully)
- [ ] Webhook/callback/retry paths touched here are idempotent and replay-safe
- [ ] No fallback/catch/retry path weakens security posture
- [ ] Source of truth is stated for each critical state touched (auth, approval, payment, membership, ownership)
- [ ] Trust boundaries touched are listed (client/API/webhook/job/admin/deep-link/storage)
- [ ] Before/after failure path is documented for security/integrity fixes
- [ ] Observability exists for changed critical flow (logs, audit trail, or metric)
- [ ] Critical regression coverage exists or `N/A` is justified with owner + follow-up
```

## Mechanical Gates

- [ ] `npx tsc --noEmit --project server/tsconfig.json` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run verify:guardrails` passes
- [ ] `npm run test:regressions` passes when touched flows are covered there, or
      `N/A` with reason
- [ ] `npm run verify:error-envelope` is clean when error-envelope behavior is
      touched, or `N/A` with reason
- [ ] Pre-commit or equivalent local verification ran before review

## Audit Framing For Risky Changes

- [ ] If this PR changes a critical state, the source of truth is named in the
      PR description: auth, payment, subscription, approval, membership, or
      ownership
- [ ] Trust boundaries touched by this PR are listed explicitly when relevant:
      client, API, webhook, job, admin, storage, deep link
- [ ] If this PR fixes a security or integrity bug, the failure or exploit path
      is documented before and after the fix

## Drift And Duplication

- [ ] No new inline notification routing outside
      `utils/notificationPresentation.ts`
- [ ] No new user-label fallback chain outside `utils/userDisplay.ts`
- [ ] No new inline upload-alert copy where `utils/uploadErrorAlert.ts` should
      own the behavior
- [ ] If this PR touches `requireAuth`, `requireVerified`, `requireOnboarded`,
      or their bypass behavior, sibling middleware expectations were reviewed in
      the same pass
- [ ] If the client needs new response fields, the server response shape and
      client types were updated together
- [ ] No new duplicated policy helper was introduced where an existing shared
      helper or middleware should have been reused

## Security And Authorization

- [ ] Protected mutations touched here enforce auth, role, plan, and ownership
      server-side as applicable
- [ ] New protected UI actions still fail server-side without permission
- [ ] Organization ownership and team authority remain explicit server-side;
      this PR does not imply ownership from client state or unrelated coach/org
      membership
- [ ] Any new use of `req.user` is behind `requireAuth` or a stronger implied
      middleware
- [ ] No client-controlled field sets payment, approval, privileged role, plan,
      or ownership state
- [ ] No fallback, retry, catch, or redirect path weakens auth, approval, plan,
      payment, or ownership enforcement
- [ ] No new silent `.catch(() => {})` is added on user-expected success paths
- [ ] Logs and Sentry breadcrumbs avoid raw PII or unredacted sensitive values

## Async And Concurrency

- [ ] State transitions based on current state use a race-safe pattern:
      `updateMany` with guarded `WHERE`, atomic increment, or `$transaction`
- [ ] Multi-table critical writes are wrapped in `$transaction` where required
- [ ] Webhook changes are signature-verified, deduped, logged, and replay-safe
- [ ] Retry or callback paths document idempotency or replay behavior when they
      affect critical state
- [ ] Cache invalidation is covered for any mutated cached entity, or `N/A` with
      reason

## Payments And Subscriptions

- [ ] No paid or subscription state is persisted before trusted server
      confirmation
- [ ] Success pages verify backend state rather than trusting query params alone
- [ ] Billing quantities, pricing, and entitlements are derived server-side
- [ ] Refund, reject, cancel, or replay paths preserve financial consistency
- [ ] Webhook event handling remains deduped and auditable

## Deep Links And Navigation

- [ ] New or changed routes resolve in Expo Router
- [ ] Required params are validated before privileged work
- [ ] Missing params fail gracefully for public navigation and fail closed for
      privileged actions
- [ ] Back navigation uses the repo-safe pattern and does not grow stacks on
      fallback paths
- [ ] Routing wrappers stay stateless and do not hide business-state mutation

## UI Reliability

- [ ] New async screens expose loading, success, error, and empty states
- [ ] New forms block double submit with `saving`, `isLoading`, or equivalent
- [ ] New critical controls include accessibility labels and test anchors where
      appropriate
- [ ] User-facing errors are surfaced with contextual recovery, not silently
      swallowed
- [ ] Async effects guard against updates after unmount where needed

## Observability And Audit Trail

- [ ] Critical auth, payment, approval, or admin flows touched here emit enough
      logs or audit records for production debugging
- [ ] Admin or reviewer actions touched here record actor, target, action, and
      timestamp somewhere authoritative
- [ ] New critical flows have at least one named verification path: test, log,
      script, or runtime proof

## Deploy And Rollback

- [ ] If this PR changes server/client contract shape, deploy order is safe and
      documented when needed
- [ ] If this PR changes schema, migration status and rollback notes are
      documented
- [ ] If this PR relies on tracked debt or temporary exceptions, owner and
      follow-up path are named
- [ ] If environment assumptions changed, the PR description says so explicitly;
      otherwise it states that no env behavior changed

## Proof Of Fix

- [ ] Regression coverage exists for the bug or invariant touched, or `N/A` with
      reason
- [ ] Security fixes include before/after reproduction when feasible
- [ ] The finding, issue, Sentry event, or audit note being closed is linked in
      the PR description

## Reviewer Order Of Operations

1. Stop on red mechanical gates.
2. Check drift and duplication next; this repo ships many regressions through
   duplicated logic.
3. Review security, authorization, and concurrency in code, not just in the PR
   description.
4. Use `AUDIT_STANDARD.md` when policy questions come up.
5. Accept `N/A` only when it has a concrete reason.
