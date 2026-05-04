# VarsityHub Audit Standard

> Canonical audit framework for this repo. Use this file when a task is
> described as an audit, security review, architecture review, validation pass,
> or release-risk review. Short-form summaries live in
> [`AUDIT_COMMANDMENTS.md`](./AUDIT_COMMANDMENTS.md). Per-PR operating gates live
> in [`PR_CHECKLIST.md`](./PR_CHECKLIST.md).

## Purpose

This standard exists to keep three things separate and aligned:

1. **Audit steps**: what reviewers must inspect and prove
2. **Engineering standards**: how code must be structured
3. **Business rules**: VarsityHub product invariants that must hold true
4. **Release gates**: objective pass/fail conditions before merge or ship

Every rule in this document must be testable by one of:

- a command or script
- a grep or file anchor
- a runtime log or audit record
- a before/after reproduction
- a reviewer-verifiable code path

If a rule cannot be verified, it is guidance, not a gate. Do not present
guidance as enforcement.

## Rule Types

| Type                     | What it answers                                  |
| ------------------------ | ------------------------------------------------ |
| **Audit step**           | What did the reviewer actually check?            |
| **Engineering standard** | How should the code be organized or implemented? |
| **Business rule**        | What product invariant must stay true?           |
| **Release gate**         | What must be true before merge or ship?          |

Do not mix these in one bullet without naming which one it is.

## Audit Workflow

### 1. System mapping

Every audit starts by writing down the actual system under review.

- Map the full flow: UI or trigger → API → database → async job or webhook →
  third party → final persisted state.
- Identify the one **source of truth** for each critical state touched by that
  flow: auth, payment, subscription, approval, membership, ownership.
- Name every **trust boundary** crossed by the flow:
  - client input
  - authenticated client
  - admin action
  - deep link
  - webhook
  - background job
  - storage adapter
  - third-party callback
- Record the observability path:
  - runtime log
  - audit log
  - metric
  - test
  - verification script

**Pass signal**

- Written path exists for the audited flow
- Source-of-truth owner is named
- Trust boundaries are listed explicitly
- At least one production or local-runtime evidence source is cited

### 2. Threat model

For each critical flow, answer every category below. If a category does not
apply, say so explicitly.

- **Auth bypass**: can the action happen without a valid session?
- **Privilege escalation**: can a user exceed their role, plan, or ownership?
- **IDOR**: can one user act on another user's resource by id?
- **Payment spoofing**: can a paid state be reached without a trusted server
  confirmation path?
- **Webhook replay**: is the handler signature-verified, deduped, and safe to
  replay?
- **Validation drift**: are client, server, schema, and async side effects out
  of sync?
- **Deep-link abuse**: can crafted params push the app into a privileged or
  inconsistent state?
- **Stale cache**: can a mutation leave stale access, plan, or ownership state
  readable elsewhere?
- **Concurrent-write race**: can two callers cause contradictory state?
- **Silent security-weakening fallback**: does a fallback, catch, retry, or
  redirect skip an auth, ownership, plan, payment, or approval check?
- **Client-controlled critical state**: can request payloads, query params,
  local storage, or deep links set payment, approval, role, plan, or ownership?

**Pass signal**

- Each category has a one-line answer
- Mitigations cite the actual file, helper, middleware, or test

### 3. Drift checks

Most audit regressions in this repo come from layers drifting apart.

- Compare frontend validation to backend validation. Backend is authoritative;
  frontend is UX only.
- Compare backend validation to Prisma or persistence constraints where
  applicable.
- Check sibling middlewares and routes that must stay in lockstep, especially
  `requireAuth`, `requireVerified`, and `requireOnboarded`.
- Check endpoint families that perform the same conceptual state transition.
- Check shared helper domains for inline duplication:
  - notification routing
  - user display formatting
  - upload error surfacing
  - booking horizon logic
- Check client TypeScript expectations against actual server response shape.
- Check docs and checklists against enforced code so policy does not outrun
  implementation.

**Pass signal**

- Intentional deltas are documented
- Accidental deltas produce a concrete finding with file references

### 4. Findings and classification

Each finding must carry proof, not only severity.

Required fields:

- affected files and line anchors
- exploit path or failure path
- expected behavior
- actual behavior
- fix strategy
- verification method

Classify each finding on three axes:

| Axis               | Typical scale                                                      |
| ------------------ | ------------------------------------------------------------------ |
| **Exploitability** | unauthenticated / any authenticated / specific role                |
| **Blast radius**   | one user / subset / all users / system-wide integrity              |
| **Recoverability** | auto-heals / manual fix per user / system-wide fix / unrecoverable |

Severity labels are still useful, but they are not enough without these three
dimensions.

### 5. Fix verification

Every accepted fix must include verification proportional to risk.

- Reproduce the bug or exploit before the fix when feasible
- Add or update regression coverage
- Run typecheck where relevant:
  - `npx tsc --noEmit`
  - `npx tsc --noEmit --project server/tsconfig.json`
- Run repo guardrails where relevant:
  - `npm run verify:guardrails`
  - `npm run verify:error-envelope`
  - `npm run test:regressions`
- For payments, approvals, auth, or other critical flows, include runtime proof
  or documented before/after behavior
- For schema or deploy-order changes, include rollback notes

**Pass signal**

- The fix has a named verification path
- The verification path is runnable or directly reviewable in this repo

## Engineering Standards

These are structural rules for this codebase.

- **Thin route wrappers**: `app/` should remain routing-oriented. Business logic
  belongs in feature modules, shared utilities, hooks, API clients, or server
  code.
- **Typed network boundary**: screens must not call raw `fetch`; network access
  goes through `api/*` clients.
- **Shared logic stays shared**: no copy-paste policy logic across sibling
  routes or screens when a helper or middleware already owns it.
- **Path aliases over deep relatives**: use repo aliases consistently.
- **Feature-scoped state by default**: global state is reserved for true
  cross-cutting concerns such as auth, theme, session, and similar app-level
  state.
- **No client-only security decisions**: hiding a UI action is not enforcement.
- **Async UI states explicit**: loading, success, error, and empty states should
  all be represented for async screens and forms.

## Business Rules

These are repo-specific invariants that audits must treat as hard rules.

- **Backend validation is law**. Frontend validation is guidance for UX.
- **No client-controlled critical state**. Clients must not authoritatively set
  payment state, approval state, privileged role, plan, or ownership.
- **Server-side gates are mandatory**. Protected actions must check auth, role,
  plan, and ownership as applicable on the server even if the UI also gates.
- **Subscription state changes only on trusted server confirmation**. Success
  pages and client query params are not authoritative.
- **Membership and ownership come from persisted rows and canonical helpers**,
  not UI assumptions or stale preference mirrors.
- **Organization ownership is explicit and transferable**. The org owner owns
  the organization until a server-authorized transfer changes that state.
- **Team authority is scoped to the teams a coach manages**. Coach tooling must
  not imply org-wide ownership, and org-wide tooling must not silently rewrite
  team ownership.
- **Async critical flows must be idempotent**. Webhooks, retries, callbacks, and
  background jobs must be safe to replay.
- **Admin and reviewer actions must be auditable** with actor, target, action,
  and timestamp.
- **Privileged failures fail closed**. Public navigation can fail gracefully, but
  privileged actions must not silently succeed on malformed or missing params.
- **No silent fallback that weakens security posture**. Catch blocks, retries,
  and fallbacks must not skip auth, plan, approval, payment, or ownership
  enforcement.

## Release Gates

These are the current-team strict gates for risky changes and releases.

- Critical flows touched by the change have automated coverage or explicitly
  tracked debt with owner and follow-up.
- `npx tsc --noEmit` and `npx tsc --noEmit --project server/tsconfig.json`
  remain green, or the PR documents a no-new-errors exception path.
- `npm run verify:guardrails` remains green.
- `npm run test:regressions` remains green for changes that touch guarded flows.
- `npm run verify:error-envelope` remains clean when error envelope behavior is
  touched.
- Security fixes include an exploit or failure reproduction before and after the
  fix when feasible.
- Schema or deployment-order changes document migration status, server-first
  order where needed, and rollback notes.
- Observability is sufficient to debug the changed flow without shipping a
  second patch just to add logs.

## Source-of-Truth Table

Code that contradicts this table is wrong unless this document is updated in
the same change.

| Domain                   | Source of truth                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Authentication           | JWT/session enforcement in `server/src/middleware/auth.ts`                                                                      |
| Email verification       | `email_verified`, enforced by `server/src/middleware/requireVerified.ts`                                                        |
| Onboarding state         | Canonical onboarding state enforced by `server/src/middleware/requireOnboarded.ts`, with compatibility mirrors where documented |
| User role                | Canonical role helpers and persisted user state, not client-only preferences                                                    |
| Subscription plan        | Server-owned subscription state written through trusted payment confirmation paths                                              |
| Approval state           | Persisted approval columns and shared approval services, not client flags                                                       |
| Organization membership  | Active organization membership rows and server authorization helpers                                                            |
| Team membership          | Active team membership rows and server authorization helpers                                                                    |
| Ownership                | Persisted organization/team owner relationships and explicit server-side transfer rules                                         |
| Payment event processing | Verified provider events and deduped server processing                                                                          |
| Deep-link routing        | Expo Router route resolution plus parser/guard logic                                                                            |
| Notification routing     | `utils/notificationPresentation.ts`                                                                                             |
| User display label       | `utils/userDisplay.ts` `formatUserLabel`                                                                                        |
| Upload error surfacing   | `utils/uploadErrorAlert.ts` `showUploadErrorAlert`                                                                              |
| Booking horizon logic    | Shared booking-horizon utility referenced by the flows that enforce it                                                          |

## Audit Deliverables

A completed audit should leave behind:

- a written flow map
- trust-boundary list
- source-of-truth declaration
- threat-model notes
- findings with proof
- verification steps for each accepted fix

If the output does not let another engineer reproduce the problem and verify the
fix, it is not complete.

## Relationship To Other Docs

- [`AUDIT_COMMANDMENTS.md`](./AUDIT_COMMANDMENTS.md): one-page, deck-friendly
  summary of this standard
- [`PR_CHECKLIST.md`](./PR_CHECKLIST.md): operational PR and release review gate
- `docs/release/*`: release-specific runbooks and readiness checklists

Do not create a new parallel “audit framework” doc unless these files cannot
express the needed policy. Extend the canon before creating a sibling.
