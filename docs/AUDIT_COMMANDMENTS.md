# Audit Commandments

One-page summary of [`AUDIT_STANDARD.md`](./AUDIT_STANDARD.md). This file is
for decks, onboarding, and quick self-checks. Canonical definitions live in the
standard.

## Rule Types

| Type                     | What it means         |
| ------------------------ | --------------------- |
| **Audit step**           | Reviewer action       |
| **Engineering standard** | Code structure rule   |
| **Business rule**        | Product invariant     |
| **Release gate**         | Merge or ship blocker |

## Audit Framework

| Commandment                                 | Pass signal                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Map the full flow under review              | Written path: trigger → API → DB → async/webhook → final state                               |
| Name one source of truth per critical state | Auth, payment, subscription, approval, membership, ownership each have one owner             |
| Make trust boundaries explicit              | Client, admin, webhook, job, deep link, storage, third party all listed when touched         |
| Touch the threat model every time           | Bypass, escalation, IDOR, spoofing, replay, drift, deep-link abuse, stale cache all answered |
| Check validation drift                      | FE, BE, schema, and async side effects compared                                              |
| Treat async flows as replayable             | Webhooks, retries, callbacks, jobs are idempotent                                            |
| Findings need proof                         | Files, path, expected vs actual, fix direction, verification                                 |
| Fixes need verification                     | Test, typecheck, script, log proof, or before/after reproduction                             |

## Architecture Standards

| Commandment                     | Pass signal                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Thin routes, thick modules      | `app/` stays wrapper-oriented; logic lives in shared, feature, API, hook, or server modules |
| Shared logic stays shared       | No new duplicated policy logic when a helper or middleware already exists                   |
| Screens do not call raw `fetch` | Network calls route through `api/*` clients                                                 |
| Use repo aliases consistently   | No deep relative imports across feature boundaries                                          |
| Global state stays narrow       | Cross-cutting concerns only; no convenience global state for feature-local logic            |

## Validation And Data Integrity

| Commandment                             | Pass signal                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Backend validation is law               | Protected fields rejected or ignored server-side                                      |
| Frontend validation is guidance         | UI checks improve UX but do not enforce security                                      |
| No client-owned critical state          | Clients cannot set payment, approval, privileged role, plan, or ownership             |
| Ownership is explicit, not implied      | Org ownership and team authority come from persisted server state, not UI assumptions |
| Privileged failures fail closed         | Missing or malformed params deny or safe-error, not silent success                    |
| Public navigation fails gracefully      | Missing deep-link params do not trigger privileged side effects                       |
| Drift is a bug until proven intentional | Any FE/BE/schema mismatch is documented or fixed                                      |

## Auth, Roles, Permissions

| Commandment                                 | Pass signal                                                           |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Every protected action checks on the server | Auth, role, plan, ownership enforced in server code                   |
| UI hiding is not enforcement                | Protected UI actions still fail server-side without permission        |
| Policy should not be copy-pasted            | Shared helpers and middleware own recurring gate logic                |
| Admin actions are auditable                 | Actor, target, action, and timestamp recorded somewhere authoritative |
| Sensitive responses are sanitized           | No accidental token or unnecessary PII leakage                        |

## Payments And Subscriptions

| Commandment                                              | Pass signal                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| Paid state changes only on trusted server confirmation   | Success screens and query params are not the final source of truth |
| Webhooks verify and dedupe                               | Signature validation and replay safety exist                       |
| Success UI verifies backend state                        | Payment-success screens confirm server state                       |
| Entitlements are derived server-side                     | Limits and billing quantities are not client-authored              |
| Financial flows stay consistent on retries and reversals | Reject, refund, cancel, and replay paths preserve integrity        |

## Navigation And Deep Links

| Commandment                                   | Pass signal                                          |
| --------------------------------------------- | ---------------------------------------------------- |
| Routes used by email, push, and OAuth resolve | Expo Router path exists and is smoke-testable        |
| Required params are validated                 | Privileged work does not proceed on bad params       |
| Wrappers stay stateless                       | Routing files do not hide business-state mutations   |
| Back navigation stays safe                    | Fallback paths do not grow stacks or strand the user |

## UI Reliability

| Commandment                        | Pass signal                                               |
| ---------------------------------- | --------------------------------------------------------- |
| Async UI shows all four states     | Loading, success, error, empty are explicit               |
| Forms block double submit          | `saving` / `isLoading` guards exist                       |
| Errors are surfaced, not swallowed | No empty user-flow catches; user sees contextual recovery |
| Async effects are unmount-safe     | Mounted guards or cancellation present where needed       |
| Critical controls are accessible   | Labels, test IDs, and meaningful text are present         |

## Testing And Release

| Commandment                                | Pass signal                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Critical flows have automated coverage     | Auth, onboarding, payments, team/org, deep links covered or tracked as debt |
| Typecheck and guardrails stay green        | `tsc`, guardrail scripts, and regression suites pass when applicable        |
| Security fixes prove before and after      | Reproduction or failure path documented pre/post fix                        |
| Deploy-order changes are reversible        | Migration and rollback notes exist                                          |
| Observability is part of release readiness | Logs or audit evidence are enough to debug changed critical flows           |

## Ten Lines For Slides

1. **Map the real flow before judging the code.**
2. **One source of truth per critical state.**
3. **Backend validation is law; frontend validation is guidance.**
4. **No client-controlled security-critical state.**
5. **Ownership and team authority come from persisted server state.**
6. **Every protected action checks auth, role, plan, and ownership on the server.**
7. **Every async critical flow is idempotent.**
8. **No silent fallback that weakens security posture.**
9. **Every finding needs proof; every fix needs verification.**
10. **Every risky release must be testable and reversible.**

## Related

- [`AUDIT_STANDARD.md`](./AUDIT_STANDARD.md)
- [`PR_CHECKLIST.md`](./PR_CHECKLIST.md)
