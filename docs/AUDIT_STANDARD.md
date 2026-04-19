# VarsityHub Audit Standard

This document is the canonical source for VarsityHub security and architecture audits. It separates audit steps, engineering standards, business rules, and release gates so reviewers can check code against an explicit spec instead of rediscovering invariants from the implementation.

Use this doc for:

- full-system security and architecture audits
- targeted reviews of risky changes
- PR review when a change touches protected behavior
- release sign-off for auth, payments, approvals, org/team ownership, or deep links

## How To Use This Standard

- Treat every rule below as pass/fail.
- If a rule changes, update this document and the PR checklist in the same PR.
- If a past finding becomes a false positive because main already fixed it, update the rule or verification anchor here rather than relying on tribal knowledge.
- For business rules, reviewers must verify at least one concrete anchor: a test file, an enforcement path, or a grep-able symbol.

## 1. Audit Steps

### 1.1 System Mapping

An audit is incomplete unless it maps:

- client entrypoints and deep links
- API routes and middleware
- database writes and source-of-truth tables
- async paths such as webhooks, queues, retries, and approval jobs
- third-party boundaries such as Stripe, Apple/Google IAP, SendGrid, Cloudinary, OAuth providers

Pass/fail checks:

- Every critical flow has a documented path from UI or external trigger to final persisted state.
- Every privileged mutation identifies the exact middleware and ownership checks that guard it.
- Every async completion path identifies the authoritative state writer.

### 1.2 Threat Model

Each audit must explicitly check for:

- auth bypass
- privilege escalation
- IDOR / cross-tenant access
- payment spoofing or duplicate finalization
- webhook replay or stale callback replay
- validation drift between client, API, and persistence
- deep-link abuse or malformed params
- silent fallback that weakens security posture

Pass/fail checks:

- Each critical flow is reviewed against the threat list above.
- Findings state which threat boundary was crossed or attempted.

### 1.3 Trust Boundaries

VarsityHub trust boundaries are:

- untrusted client input
- authenticated client input
- privileged admin or owner actions
- third-party callbacks and webhooks
- background jobs and scheduled cleanup
- external storage and messaging providers

Pass/fail checks:

- Each boundary crossing identifies what is trusted, what is revalidated, and what is ignored.
- No security-critical transition relies only on client-provided state.

### 1.4 Source Of Truth

Every critical state must have one authoritative owner:

- auth/session state: server-issued tokens and server-side token records
- plan/subscription state: verified server-side payment completion, not client checkout intent
- org and team ownership: membership and role records in the database
- approval state: server-owned approval fields and approval services
- notification/email recipients: centralized server-side recipient helpers, not client hints

Pass/fail checks:

- Audits identify the canonical owner for each critical state they touch.
- Any duplicate or cached representation is treated as derived, never authoritative.

### 1.5 Validation Drift Review

Pass/fail checks:

- Frontend validation is UX-only and may not loosen or tighten server rules by accident.
- Backend validation is authoritative for auth, role, plan, payment, and approval state.
- Database constraints or transactional checks backstop critical invariants where practical.
- Missing or malformed params fail closed for privileged actions and fail safely for public navigation.

### 1.6 Async And Idempotency Review

Pass/fail checks:

- Webhooks, polling finalizers, retryable jobs, and approval side effects are safe to replay.
- Multi-step financial or approval writes are transactional or otherwise race-safe.
- Async failure does not silently mark protected work as complete.

### 1.7 Findings And Proof

Every finding must include:

- affected behavior
- exploit or failure path
- expected behavior
- actual behavior
- fix direction
- verification steps

High and critical findings must also include:

- exploitability
- blast radius
- violated trust boundary or source of truth
- release risk if shipped unfixed

## 2. Engineering Standards

These standards apply repo-wide and are reviewable in code.

| Standard                                 | Pass Condition                                                                                                           | Verification Anchor                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Thin routes, thick features              | `app/` files stay as route wrappers; feature logic lives in `src/features/*` or shared modules instead of route wrappers | Grep `app/` for business logic and network calls            |
| Shared code stays shared                 | Reused hooks, components, utils, and constants are imported from shared paths instead of duplicated per screen           | Grep duplicate helpers before adding new ones               |
| No deep cross-feature relative imports   | Imports use aliases such as `@/shared/*` and `@/features/*` rather than brittle deep relatives                           | Grep for `../../../../` in app and src                      |
| Screens do not call raw `fetch`          | UI code uses typed API clients or feature adapters rather than ad hoc network calls                                      | Grep `fetch(` in `app/` and `src/features/`                 |
| Async screens render all states          | Loading, success, error, and empty states are explicitly handled for async list/detail views                             | Screen review plus relevant UI tests                        |
| Forms block duplicate submit             | Submit buttons guard on loading or saving state before firing network requests                                           | Grep `isLoading`, `saving`, `disabled` near submit handlers |
| No silent user-flow failure              | User-facing async flows do not use silent `catch {}` or `.catch(() => {})` without logging and recovery                  | Grep `.catch(() => {})` and `catch {}` in app/server        |
| Security posture never degrades silently | Fallback behavior may not bypass auth, approval, payment, or role checks                                                 | Review fallback branches in auth, payments, organizations   |
| Security-critical state is server-owned  | Client payloads cannot set paid plan, approval state, privileged role, or ownership                                      | Review request schemas and protected field filtering        |
| Privileged actions are observable        | Admin or owner actions that change protected state emit logs or audit records                                            | `server/src/lib/adminActivityLogger.ts`, route logging      |

## 3. Business Rules

These are VarsityHub-specific invariants. Each rule includes a concrete verification anchor.

### 3.1 Auth, Session, And Onboarding

| Rule                                          | Pass Condition                                                                                                             | Verification Anchor                                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Protected preference fields stay protected    | Client updates to `/me/preferences` cannot set paid plan, approval state, or other protected keys                          | `server/src/routes/auth.ts`, grep `PROTECTED_PREF_KEYS`; `server/src/__tests__/api-auth.test.ts`                                 |
| Coach-only tools require approved coach state | Server blocks unapproved or incomplete coaches even if UI paths are reachable                                              | `requireOnboarded` in server middleware; `server/src/__tests__/coach-approval.test.ts`; `server/scripts/smoke-test-approvals.sh` |
| Verification and reset flows fail safely      | Missing or invalid tokens/codes do not reveal sensitive state and do not succeed partially                                 | `server/src/routes/auth.ts`; `app/reset-password.tsx`; grep `/verify/confirm` and reset-password routes                          |
| Provider redirects are observable             | Provider-owned redirects do not silently reroute without telemetry or a shared redirect helper                             | Grep `router.replace(` in auth/onboarding providers and contexts; grep `breadcrumb` or redirect telemetry helpers                |
| Proceed-as-fan stays explicit                 | Pending coach flows may continue as fan only through explicit server-safe preference updates, not implicit role escalation | `app/onboarding/pending-approval.tsx`, `app/onboarding/league-pending-approval.tsx`, `server/src/routes/auth.ts`                 |

### 3.2 Plans, Payments, And Billing

| Rule                                                          | Pass Condition                                                                                                                   | Verification Anchor                                                                                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paid plan state changes only after verified server completion | Checkout intent alone cannot persist a paid plan                                                                                 | `server/src/routes/payments.ts`; `app/payment-success.tsx`; `server/src/__tests__/payment-flow.test.ts`; `server/src/__tests__/payments-finalization.test.ts` |
| Payment success UI verifies backend state                     | Success screens do not trust query params and provide retry/recovery states                                                      | `app/payment-success.tsx`, grep `Try Again`; payment tests above                                                                                              |
| Webhook and client finalization are replay-safe               | `checkout.session.completed`, retries, and polling do not double-apply entitlements                                              | `server/src/routes/payments.ts`, grep `checkout.session.completed`; `processedStripeEvent`; finalization tests                                                |
| Promo failure cannot silently complete protected work         | If promo redemption or billing side effects fail, the transaction is flagged for failure/review instead of being marked complete | `server/src/routes/payments.ts`, grep `needs_review` and transaction status handling                                                                          |
| Pricing and entitlements are server-derived                   | Team counts, plan limits, and billable quantities are computed server-side                                                       | `server/src/routes/payments.ts`; `server/src/__tests__/payments.test.ts`; `server/src/__tests__/team-creation.test.ts`                                        |

### 3.3 Teams, Organizations, And Approvals

| Rule                                           | Pass Condition                                                                                            | Verification Anchor                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership checks are server-side               | Team/org mutations enforce auth, role, plan, and ownership on the server even if the UI hides the action  | `server/src/routes/organizations.ts`, `server/src/routes/team-memberships.ts`, `server/src/routes/admin.ts`                                                         |
| Sole owners cannot be removed accidentally     | Member deletion or ownership transfer cannot leave an org or team without an owner                        | `server/src/routes/team-memberships.ts`; grep `sole owner`; relevant ownership tests                                                                                |
| Coach approval is tenant-safe                  | Owners can approve or reject only coaches for organizations they control                                  | `server/src/routes/organizations.ts`; `server/src/lib/approvalService.ts`; `server/src/__tests__/coach-approval.test.ts`; `server/scripts/verify-coach-approval.ts` |
| Join request review is race-safe               | Approval/rejection uses transactional state checks so a request cannot be reviewed twice under contention | `server/src/routes/organizations.ts`; grep `Serializable` and join-request approval transaction                                                                     |
| Team creation respects org and plan invariants | Team creation associates an org, enforces plan gates, and fails clearly on permission or plan violations  | `app/create-team.tsx`; `server/src/__tests__/team-creation.test.ts`; server org/team routes                                                                         |

### 3.4 Ads, Notifications, And Email

| Rule                                             | Pass Condition                                                                                                  | Verification Anchor                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Ad confirmation is explicit                      | Users can review banner, dates, amount, and target URL before or after purchase without relying on hidden state | `app/payment-success.tsx`; ad confirmation screens and payment tests                 |
| Admin notification recipients are centralized    | Approval and review emails use centralized admin-recipient helpers rather than hardcoded personal addresses     | `server/src/lib/adminEmails.ts`; `server/src/lib/email.ts`; grep `getAllAdminEmails` |
| Notification failure does not block primary work | Push/email side effects may fail, but the main mutation path remains correct and observable                     | `server/src/lib/notifications.ts`; grep `[notif]`; email send helpers                |
| Admin actions are auditable                      | Approvals, rejections, and protected moderation actions write audit records                                     | `server/src/lib/adminActivityLogger.ts`; admin and organization routes               |

### 3.5 Navigation And Deep Links

| Rule                               | Pass Condition                                                                                         | Verification Anchor                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Deep links resolve safely          | All push, email, OAuth, and payment routes resolve in Expo Router and handle missing params gracefully | `app/payment-success.tsx`, `app/reset-password.tsx`, grep `callback` in `app/`, and `app/_layout.tsx` route registration |
| Navigation wrappers stay stateless | Route wrappers do not mutate business state directly                                                   | Review `app/` wrappers for side effects                                                                                  |
| Back navigation is safe            | Fallback back behavior does not grow stacks or skip required state checks                              | Grep `safeGoBack` in app navigation flows                                                                                |

## 4. Release Gates

These gates are required when a change touches auth, payments, approvals, ownership, or other protected behavior.

| Gate                                       | Pass Condition                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Tests updated with invariant changes       | If a protected invariant changed, the same PR updates the relevant automated test or adds a concrete verification anchor |
| Security fixes prove before/after behavior | High/critical fixes include exploit reproduction or equivalent proof before and after the fix                            |
| No new quality regressions                 | `lint`, `typecheck`, and relevant tests pass, or the PR documents a no-new-errors exception with tracked debt            |
| Migration safety documented                | Schema-affecting changes include migration state, rollback notes, and any required client regeneration                   |
| Payment and webhook safety checked         | Payment-related changes confirm signature verification, idempotency, and retry behavior                                  |
| Auditability preserved                     | Protected state changes remain logged, observable, and debuggable in production                                          |
| Risky launches are smoke-tested            | Auth, payments, approvals, and deep links receive targeted smoke coverage before release                                 |

## 5. Standard Maintenance

Update this standard and `docs/PR_CHECKLIST.md` in the same PR when:

- a protected invariant changes
- a high/critical finding is fixed
- a false positive is retired because main already enforces the rule
- a new verification anchor becomes the preferred source of truth

Maintenance rules:

- Historical audit reports remain historical evidence, not canonical policy.
- The canonical rule must say what is true now, not what used to be broken.
- If automation is missing, add a grep-able enforcement anchor until a test exists.

## Related Documents

- `docs/AUDIT_EXECUTION_GUIDE.md` — operational workflow for running audits and recording findings
- `docs/PR_CHECKLIST.md` — PR review and release readiness checklist derived from this standard
- `docs/SECURITY_ARCHITECTURE_AUDIT_2026-03.md` — historical audit evidence
- `docs/COMPREHENSIVE_SECURITY_ARCHITECTURE_AUDIT_2026.md` — historical audit evidence
