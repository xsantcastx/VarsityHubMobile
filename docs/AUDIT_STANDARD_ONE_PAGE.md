# VarsityHub Security & Architecture Audit Standard (One Page)

Purpose: provide a strict, testable audit baseline for risky changes.

## Rule Types (required)

Every rule must be tagged as one of:

- **Audit Step**: what reviewers must verify
- **Engineering Standard**: how code must be structured
- **Business Rule**: product invariant that must hold
- **Release Gate**: objective pass/fail criteria before ship

## 1) Audit Framework

| Type | Rule | Pass Evidence |
| --- | --- | --- |
| Audit Step | Map full flow (client -> API -> DB -> async/webhook -> client state). | PR includes end-to-end flow note with touched files. |
| Audit Step | Name one source of truth for each critical state (auth, payment, subscription, approval, membership, ownership). | PR has "source of truth" section per changed domain. |
| Audit Step | Explicit trust-boundary check (client, deep link, webhook, admin, storage, third party). | Threat-boundary checklist completed in PR. |
| Audit Step | Anti-drift check across frontend validation, backend validation, schema, and async side effects. | Linked tests or explicit intentional-drift rationale. |
| Audit Step | Severity classification by exploitability, blast radius, recoverability. | Findings table with severity rationale. |

## 2) Engineering Standards

| Type | Rule | Pass Evidence |
| --- | --- | --- |
| Engineering Standard | Thin routes, thick modules. | No business logic added to wrapper-only routing files. |
| Engineering Standard | Screens do not call raw `fetch`; use typed API clients. | Search proof in PR or lint/script output. |
| Engineering Standard | No client-controlled security-critical state. | Server route/middleware proof for protected fields. |
| Engineering Standard | Async critical flows are idempotent and replay-safe. | Guarded writes or dedupe checks with tests. |
| Engineering Standard | No silent user-flow failures. | Errors are surfaced to users and logged with context. |

## 3) Business Rules (VarsityHub invariants)

| Type | Rule | Pass Evidence |
| --- | --- | --- |
| Business Rule | iOS billing paths use Apple IAP, not Stripe checkout. | iOS path proof and runtime checks. |
| Business Rule | Protected actions enforce auth/role/plan/ownership server-side. | Middleware + route-level proof. |
| Business Rule | Team/org ownership invariants remain server-enforced. | Tests or transaction-level checks. |
| Business Rule | Payment and approval state are server-authored only. | No client-authored critical state writes. |
| Business Rule | Admin/reviewer actions are auditable. | Log trail includes actor, target, action, timestamp. |

## 4) Release Gates (hard GO/NO-GO)

Release is **NO-GO** if any required gate fails.

### Required command gates

- `npm run typecheck`
- `npx tsc --noEmit --project server/tsconfig.json`
- `npm run verify:guardrails`
- `npm run verify:release`
- Touched critical-flow tests pass

### Required runtime gates

- Real-device smoke for auth, onboarding, payments, dark/light visibility
- Deep-link safety checks (invalid/missing params fail safely)
- App Review path verified (demo login, account deletion path, IAP discoverability)

### Required operational gates

- Rollback plan exists for risky server/state changes
- Migration/backfill plan documented for schema changes
- No hidden environment dependency left unverified

## 5) Threat Model Minimum (always include)

- Auth bypass
- Privilege escalation
- Payment spoofing
- IDOR
- Webhook replay
- Stale cache / stale state
- Deep-link abuse

## 6) Slide Version ("Commandments")

1. Thin routes, thick features.
2. Backend validation is law; frontend validation is guidance.
3. No client-controlled security-critical state.
4. One source of truth per critical domain state.
5. Every protected action enforces auth, role, plan, ownership server-side.
6. Every async critical flow is idempotent.
7. No silent fallback that weakens security posture.
8. Every finding needs proof; every fix needs verification.
9. Every release change must be testable.
10. Every risky release must be reversible.

## Related

- [`AUDIT_STANDARD.md`](./AUDIT_STANDARD.md)
- [`PR_CHECKLIST.md`](./PR_CHECKLIST.md)
- [`HANDBOOK_SECURITY_GATES.md`](./HANDBOOK_SECURITY_GATES.md)
