# VarsityHub Audit Execution Guide

This guide explains how to run an audit against [AUDIT_STANDARD.md](./AUDIT_STANDARD.md), how to document findings, and how to verify fixes without turning routine audits into documentation-heavy theater. For a **short, testable checklist** (slides or PR self-review), use [AUDIT_COMMANDMENTS.md](./AUDIT_COMMANDMENTS.md) when present.

## When To Run Which Audit

Run a **full-system audit** when:

- preparing a major release
- changing auth, payments, org approvals, ownership, or onboarding flows
- merging a broad refactor that crosses app, server, and persistence boundaries
- closing a significant security report and verifying adjacent flows

Run a **targeted audit** when:

- adding or changing a single risky route, screen, middleware, or webhook
- fixing a focused finding and checking for regression nearby
- reviewing a PR that modifies a protected invariant

## Audit Workflow

### 1. Map The Flow

For the feature under review, identify:

- UI entrypoints or external triggers
- route handlers and middleware
- persistence writes and reads
- async callbacks, retries, and jobs
- third-party boundaries

Output required:

- one end-to-end flow description from trigger to persisted outcome
- one list of trust boundaries crossed
- one statement of the source of truth for each critical state

### 2. Run The Threat Model

Review the flow against the explicit threat list from the audit standard:

| Threat                      | What To Check                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Auth bypass                 | Can the action execute without a valid token? Does middleware enforce `requireAuth`?              |
| Privilege escalation        | Can a non-owner/non-admin trigger owner/admin behavior? Are role checks server-side?             |
| IDOR / cross-tenant access  | Can user A operate on user B's resources by manipulating IDs in params or body?                   |
| Payment spoofing            | Can checkout intent alone persist a paid plan? Are webhooks signature-verified?                   |
| Duplicate finalization      | Can the same webhook/callback apply entitlements twice? Is there an idempotency key or guard?    |
| Webhook/callback replay     | Are stale or replayed callbacks handled safely? Do they check current state before acting?        |
| Validation drift            | Does the frontend allow values the backend rejects, or vice versa?                               |
| Deep-link abuse             | Can malformed or missing deep-link params bypass auth gates or produce undefined behavior?       |
| Silent fallback degradation | Does any catch block or fallback path skip auth, approval, payment, or role checks?              |
| Stale cache                 | Does cached data gate security-critical decisions? Is it invalidated on the relevant mutations?   |
| Client-controlled state     | Can the client set paid plan, approval status, role, or ownership through request payloads?       |

For each applicable threat, record: checked/not applicable, and if a gap is found, fill out a finding.

### 3. Verify Trust Boundaries

For each boundary crossing in the flow:

| Boundary                            | Verification Question                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Untrusted client input              | Is it validated server-side before any persistence or privileged action?                |
| Authenticated client input          | Does the server re-derive ownership/role from the token, not from request body?        |
| Admin or owner actions              | Is the caller verified as admin/owner server-side, not just UI-gated?                  |
| Third-party callbacks (Stripe, IAP) | Is the callback signature-verified? Is the handler idempotent? Is failure non-silent?  |
| Background jobs                     | Can the job replay safely? Does it check current state before mutating?                |
| External providers (SendGrid, etc.) | Is failure handled without blocking the primary operation? Is it logged?                |

### 4. Check Controls

Review:

- auth, role, plan, and ownership enforcement
- request validation and protected field filtering
- frontend/backend/schema drift (compare Zod schemas, regexes, enums)
- transactions, idempotency, and replay safety
- logging, audit logs, and failure visibility
- deep-link or navigation safety where routes are involved
- observability — critical paths use production-visible logging

### 5. Reproduce The Gap

For each finding:

- state the expected behavior
- state the actual behavior
- record how to reproduce or prove it
- identify the violated rule from the audit standard

For high/critical findings also capture:

- blast radius
- exploitability
- whether the issue crosses a trust boundary or source-of-truth rule

### 6. Verify The Fix

Verification should include the smallest set that proves the issue is fixed:

- automated tests
- targeted manual reproduction
- typecheck/lint where relevant
- logs, audit records, or monitoring for production-facing changes

Do not close a finding on code inspection alone if the issue is user-visible, payment-related, or security-sensitive.

## Review Heuristics By Area

### Auth And Session

Check:

- protected routes use the right middleware (`requireAuth`, `requireOnboarded`)
- refresh/verification/reset flows do not trust client-only state
- role and onboarding gates are server-side
- invalid token or code paths are logged without leaking secrets
- client TTL caches are invalidated on auth mutations (login, logout, verify)

### Payments And Billing

Check:

- plan state changes only after trusted server confirmation
- webhook handling is signature-verified and replay-safe
- payment success routes verify backend state, not just query params
- retry or promo failures do not silently mark work complete
- Stripe re-verification exists before finalization applies entitlements
- billing quantities and plan limits are server-derived

### Organizations, Teams, And Approvals

Check:

- every protected org/team mutation enforces ownership or role on the server
- approval or rejection cannot target another tenant's records
- joins, approvals, and transfers are race-safe
- owner removal and transfer flows preserve a valid owner
- teams always have an `organization_id`

### Navigation And Deep Links

Check:

- routes exist and resolve in Expo Router
- missing params fail safely
- fallback navigation does not skip security gates or create stack loops

### Reliability And User Recovery

Check:

- async screens show loading, error, empty, and recovery states
- duplicate submit is blocked
- user-facing catches log context and surface a clear recovery path

### Observability And Email

Check:

- email send attempts and results are visible in production logs (not `debugLog`)
- `EMAIL_AUDIT` structured logs emit for every outgoing email
- required template IDs are validated at boot
- health endpoints exist for email, payment, and push integrations

## Finding Templates

### Short Form

Use for low/medium findings.

```md
## <title>

- Severity: LOW | MEDIUM
- Area: <feature/system>
- Rule: <audit standard rule violated>
- Proof: <repro step, code path, or log>
- Expected: <expected behavior>
- Actual: <actual behavior>
- Fix Direction: <what needs to change>
- Verification: <test, manual repro, or grep anchor>
```

### Full Form

Use for high/critical findings.

```md
## <title>

- Severity: HIGH | CRITICAL
- Exploitability: <who can trigger it and how easily>
- Blast Radius: <users/data/financial impact>
- Area: <feature/system>
- Violated Rule: <audit standard rule violated>
- Trust Boundary / Source Of Truth: <what boundary or source was broken>
- Affected Files: <key paths only>
- Proof: <repro, payload, or code path>
- Expected: <expected behavior>
- Actual: <actual behavior>
- Fix Strategy: <implementation direction>
- Verification: <before/after repro, tests, logs>
- Release Risk: <what happens if shipped unfixed>
```

## Evidence Expectations

Use the lightest acceptable evidence for the severity:

| Severity | Minimum Evidence                                                      |
| -------- | --------------------------------------------------------------------- |
| LOW      | Code path plus verification anchor                                    |
| MEDIUM   | Repro or concrete code path plus one verification method              |
| HIGH     | Repro or exploit path, affected files, before/after verification      |
| CRITICAL | Repro or exploit path, blast radius, before/after proof, release risk |

Preferred verification anchors:

- automated tests
- a concrete enforcement path in server/app code
- a grep-able symbol or pattern when no test exists yet

## Reporting Format

For mixed audiences, publish findings in this order:

1. executive summary
2. findings grouped by severity
3. open questions or assumptions
4. fix status and verification

Keep the executive summary short:

- what was audited
- how many findings by severity
- what blocks ship
- what was already fixed on current main

## Closing An Audit

An audit is ready to close when:

- each finding maps to a rule in the audit standard
- each accepted fix includes a verification step
- false positives are called out explicitly
- any invariant changes are reflected in `docs/AUDIT_STANDARD.md`
- any checklist-impacting changes are reflected in `docs/PR_CHECKLIST.md`

## Related Documents

- [Audit Standard](./AUDIT_STANDARD.md)
- [PR Checklist](./PR_CHECKLIST.md)
- `docs/SYSTEM_ARCHITECTURE_AUDIT_REPORT.json` for generated or archived raw findings
