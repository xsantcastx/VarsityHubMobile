# VarsityHub role, organization email, and founder access audit — 2026-09-05

Audited HEAD `ec27781e3d6cd9688064bb20bab30babd33fd00c` in `/Users/varsityhub/Code/VarsityHubMobile`. Initial `git status --short` was clean. Root verified both fetched remotes and version freshness. Skill: `/Users/varsityhub/.codex/skills/varsityhub-matrix-audit/SKILL.md`. Read user attachment, AGENTS.md, September 1 flow matrix, coach tools/approval/permission matrices, claim verification and security backlog.

**Outcome: current coach/team and org-owner app authorization boundaries passed the exercised scenarios, but organization email review is not closed. Three new current-source defects reproduce using actual Express requests and an isolated PostgreSQL database.** Ordinary org ownership does not grant founder API access. The App Store demo account does hold full platform-admin privilege deliberately, including founder metrics.

## Remediation update — September 5 worktree, not deployed

ROLE-01/02/03 now have implementation and expected-safe local HTTP/PostgreSQL evidence in the remediation worktree: reviewer+application-bound links, canonical current-owner resolution (including legacy owners), locked transactional decisions with audit/in-app notification, rollback-safe retries, transfer-back invalidation, and unified team/org owner precedence. Old unbound links fail closed with app-review recovery. The findings below preserve the original audited-version proof.

Focused five suites passed122/122; final canonical-owner group passed34/34 (overlapping). Latest deduplicated scenario results across23 distinct suites total334 passing assertions, assembled across recorded runs; the full combined suite is still the root release gate. Real-DB helper matrix39/39 also passed. Server typecheck ran successfully; this lane makes no client typecheck/deployment/provider-delivery claim. Initial broader batch failures and isolated reruns are recorded in `/tmp/varsityhub-remediation-2026-09-05/role-fixes.md`, alongside rollback and old-link recovery details. Demo/founder policy is unchanged.

## Scope and evidence quality

Threat model first: direct cross-team/cross-org IDOR, fan-to-coach/admin escalation, unverified admin identity, self-review, revoked-owner authority, replay of signed review links, plan caps and stale approval state. Traced client `organization-join-requests`, shared role helpers and API clients through Express auth/verified/onboarded middleware, canonical authorization helpers, Prisma writes, signed email links and audit attribution. No production DB, provider delivery, device UI, or external email/payment calls were performed by this role audit.

Root provided a dedicated local DB `varsityhub_audit_20260905_roles`. It was created with current Prisma schema via `db push`, not a full historic migration replay. This omitted the SQL function/index migration `20260429224500_organization_duplicate_name_backstop`; I applied exactly that SQL to this disposable DB. It resolved initial org-create 500s. Redis was disabled by Jest setup; signed review-token replay uses the actual test in-memory replay implementation, not a mocked token verifier. JWT signing, HTTP middleware, routes and relational reads/writes in the new repro are real. Email transport is bypassed under NODE_ENV=test. Elapsed reapply cooldown is represented by aging the fixture timestamps eight days, not waiting eight days.

## Open findings

### ROLE-01 — Former org owner can still approve using saved email after ownership transfer

**Open Bug / high priority.** Exploitability: former owner (or another holder of their signed link) needs a still-live email capability. Blast radius: coach admission/global approval for the request's organization, plus misleading audit attribution. Recoverability: remove unauthorized membership and correct approval state; previously exposed content and false audit attribution need review.

The normal app path correctly denies an old owner after `POST /organizations/:id/transfer-ownership`. The identical old email link still returns 200 and changes the pending request to approved. Handler chooses whoever is owner NOW and records that successor as `reviewed_by`, although the link was delivered to the old owner. Tokens contain request ID, org ID and action but no intended reviewer/ownership version. TTL is 30 days.

- Source: [email.ts:2191](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/email.ts:2191), [email.ts:152](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/email.ts:152), [organizations.ts:2266](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:2266), [organizations.ts:2286](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:2286).
- Repro: [audit-20260905-role-email-boundaries.test.ts:146](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-20260905-role-email-boundaries.test.ts:146): actual ownership transfer 200, old-owner app approval 403, saved email approval 200 + DB approved.
- Expected: reject a link whose authorized reviewer no longer owns that org; retain pending state. Fix strategy: bind review capabilities to issuing owner and ownership generation, verify canonical current ownership before the transaction, audit the bound reviewer. Reissue/invalidate pending capabilities when ownership moves.

### ROLE-02 — Consumed email token mutates a reopened application before reporting replay

**Open Bug / high priority.** Exploitability: possession of an already-used link during its 30-day TTL, after the coach waits seven days and reapplies. Blast radius: one request can be denied again (and ordinary coach globally REJECTED) or stale approval can apply to a different request attempt. Recoverability: coach needs re-review/reapplication; emails/audit writes have already happened even though the caller sees 409.

`POST /organizations/join-requests` upserts the same `(organization_id,user_id)` row back to pending after cooldown. Email handler calls approve/deny first and only then `consumeReviewToken`. Replaying the already-consumed rejection link returns HTTP 409 **after** the DB request has changed from pending to denied. The replay response does not mean the mutation was blocked. Unused old links also lack any request-attempt binding.

- Source: [organizations.ts:1795](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:1795), [organizations.ts:2286](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:2286), [organizations.ts:2311](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:2311), [organizationJoinRequests.ts:420](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/organizationJoinRequests.ts:420).
- Repro: [audit-20260905-role-email-boundaries.test.ts:183](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-20260905-role-email-boundaries.test.ts:183): initial denial 200; age both cooldown timestamps; actual reapply endpoint 201 and pending; replay 409 but DB denied.
- Expected: replay/stale attempt rejection before any DB or notification effect. Fix strategy: bind tokens to request attempt/version, check replay before mutation and use an atomic claim/decision strategy so concurrent requests cannot slip through. Preserve safe retries on transient failures. Existing `organization-email-review-token-order.test.ts` explicitly pins post-mutation consumption and needs to be reconciled with the new security invariant, not treated as proof of safety.

### ROLE-03 — Legacy owner can manage in app but email approval returns 500

**Open Bug / medium priority.** Exploitability: no attacker required; valid legacy org owner. Blast radius: coach admission email workflow for pointer-only legacy organizations. Recoverability: use app review or repair owner membership.

The canonical `isOrganizationOwner` intentionally honors `Organization.league_owner_id` when no owner membership row exists. Email review instead selects an active owner membership and returns `500 Owner Not Found` if none exists. The request remains pending. The join-request mail recipient resolver also uses only the membership row, so newly submitted requests for such organizations can miss owner email/push entirely (static trace; actual delivery not exercised).

- Source: [organizationAuthorization.ts:32](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/organizationAuthorization.ts:32), [organizations.ts:1771](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:1771), [organizations.ts:2274](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/organizations.ts:2274).
- Repro: [audit-20260905-role-email-boundaries.test.ts:169](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-20260905-role-email-boundaries.test.ts:169): pointer-only org owner gets app join-request list 200 but valid signed email returns 500.
- Fix strategy: use one canonical owner resolver for authorization, email recipient and audit actor; honor the legacy pointer consistently and preserve ROLE-01 reviewer binding.

## Policy decision: App Store demo has founder privileges

This is deliberate, covered by an existing passing test, and not an org-role escalation. `isAdminEmail` unconditionally adds `demo@varsityhub.app` to the two hardcoded mailboxes (`emancero@varsityhub.app`, `customerservice@varsityhub.app`) in all environments. Verified demo login receives the same requireAdmin capability as the founder; there is no scoped reviewer-only platform role. The new real HTTP control confirms demo `/admin/metrics` 200, ordinary coach/org owner 403, founder verified 200, founder unverified 403, anonymous 401.

Source: [adminEmails.ts:14](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/adminEmails.ts:14), [adminEmails.ts:74](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/adminEmails.ts:74), [requireAdmin.ts:10](/Users/varsityhub/Code/VarsityHubMobile/server/src/middleware/requireAdmin.ts:10), [admin.ts:573](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/admin.ts:573). Repro/control: [audit-20260905-role-email-boundaries.test.ts:117](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-20260905-role-email-boundaries.test.ts:117).

Owner decision needed before changing this deliberate policy: should app reviewers keep founder-level access, or use a separate isolated/scoped reviewer account? Ordinary organization owners should not be added to this hardcoded list or any founder role. `ADMIN_EMAILS`/`ADMIN_NOTIFICATION_EMAILS` configure notification recipients, not admin session access; unit tests confirm env changes do not grant platform access. Signed review-link possession is a distinct capability, so notification routing still matters.

## Scenario matrix

| Scenario                                                                                   | Current verdict                          | Evidence                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------- |
| Fan / rookie / veteran major endpoint and permission battery                               | Closed for exercised automated contracts | Existing access matrix, 46 assertions; real HTTP + local DB            |
| Rookie/veteran/legend entitlement restrictions and fan coach restrictions                  | Closed for exercised scenarios           | role-tier-enforcement, 45 assertions; local HTTP/DB                    |
| Coach administers own team; outsider cannot administer or manage                           | Closed                                   | real canonical-helper DB matrix; app route guard suites                |
| Team manager / assistant coach can manage games/events but cannot settings/invite/transfer | Closed for tested paths                  | role-barrier-authorization + DB helper matrix                          |
| Org owner administers own teams; org manager denied team administration                    | Closed for tested paths                  | role-barrier-authorization, helper matrix                              |
| Coach cannot grant manager/owner; owner assignments restricted                             | Closed                                   | canAssignTeamRole unit tests + actual DB helpers and membership routes |
| Team transfer to organization must authorize destination                                   | Closed                                   | team-transfer-authorization real HTTP fixture                          |
| Wrong organization owner tries coach approval                                              | Closed                                   | new actual HTTP 403 + pending DB state                                 |
| Org manager creates organization invitation                                                | Closed                                   | real HTTP 403; org owner 201                                           |
| Bulk org invites reject owner/admin and over-cap payloads                                  | Closed                                   | organization-create-invite-guards, real HTTP/DB                        |
| Team creation authorized-user cap prevents half-created resources                          | Closed                                   | team-create-authorized-users-cap, real HTTP/DB                         |
| Legacy owner is recognized in normal team/org helpers                                      | Closed                                   | organization-legacy-owner + team-admin-legacy-owner DB tests           |
| Org transfer removes app administration from prior owner                                   | Closed                                   | actual transfer + old owner HTTP 403; helper matrix                    |
| Org transfer invalidates former owner's email capability                                   | **Open Bug ROLE-01**                     | actual HTTP transfer and stale-email mutation                          |
| Consumed review email cannot affect a reapplication                                        | **Open Bug ROLE-02**                     | actual replay gives 409 after persisted denial                         |
| Legacy owner email-review parity                                                           | **Open Bug ROLE-03**                     | actual app 200 / email 500                                             |
| Coach self-review prohibited on app path                                                   | Closed for existing covered guards       | approval-self-action-guard and role tests; some source assertions      |
| Founder-only route denies ordinary organization owner and coach                            | Closed                                   | new actual `/admin/metrics` tests                                      |
| Verified App Store demo cannot access founder metrics                                      | **Policy Decision: it CAN**              | new actual `/admin/metrics` 200; explicit hardcoded allowance          |
| Owner receives usable email in actual mailbox and provider link works                      | Runtime gap                              | transport bypassed; no real mail or device testing                     |
| Concurrent multi-replica Redis replay behavior                                             | Runtime gap                              | durable Redis outage/concurrency not tested in this role audit         |

## Notes reconciliation

- September 1 matrix's blanket 'admin/moderation/audit logs closed' and 'teams/org contracts closed' is incomplete for the newly reproduced email/transfer/reapply cases. Existing tests can all pass while these cases fail.
- `docs/COACH_APPROVAL_MATRIX.md:23` still says org owner/manager approves join requests; current owner-only app route contradicts the manager statement. Treat that row as stale.
- `docs/COACH_PERMISSIONS_AUDIT.md` describes retired athlete roster roles and manager/assistant invite/admin privileges. Those are stale after July role barriers, not permission changes to reintroduce.
- `docs/SECURITY_BACKLOG.md:31-33` says single `support@` admin, env grants access, and no audit trail; current hardcoded allowlist, verified-email gate and audit logger supersede those statements.
- Local auth-helper comments still call manager a higher tier than coach and mention retired roster approvals. Current user-directed model gives coach full team administration and manager limited game/event management; interpret code and current AGENTS.md, not these outdated comments.

## Commands and definitive test results

Safe command prefix for DB commands:

```sh
env -i PATH="$PATH" HOME="$HOME" \
  VARSITYHUB_ENV_PATH=/dev/null DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL=postgresql://varsityhub@127.0.0.1:5432/varsityhub_audit_20260905_roles \
  JWT_SECRET=audit-local-test-secret-32-chars-minimum NODE_ENV=test
```

Both env-path overrides matter: setup/load-env respects VARSITYHUB_ENV_PATH, but testApp/teamGateTestApp directly import `dotenv/config`. First baseline used only VARSITYHUB_ENV_PATH; NODE_ENV=test bypassed real email, DB was explicitly local. Definitive rerun used both overrides and a cleared environment.

- Unit/source baseline: `npm --prefix server test -- --runInBand --runTestsByPath` with 12 named suites recorded in `roles-unit-results.json`: **12 suites / 132 assertions passed** (no real DB dependency). Includes canAssignTeamRole, admin allowlist/surface/check, role normalization, coach UI source guards, approval guards, invite parity, notification recipients and trust-boundary source contracts.
- Initial DB pass: **178 passed / 5 failed**, plus one nonexistent requested test filename. Five actual assertions failed because `db push` omitted SQL org-name helper. This was test-environment incompleteness, not classified as app bugs. Nonexistent `admin-route-backstop.test.ts` was a command-selection error, corrected on rerun.
- Applied `psql <local-audit-db> -v ON_ERROR_STOP=1 -f server/prisma/migrations/20260429224500_organization_duplicate_name_backstop/migration.sql` to disposable DB only.
- Definitive mixed HTTP/DB/source suite rerun: `npm --prefix server test -- --maxWorkers=2 --watchman=false --runTestsByPath <20 suites> --json --outputFile=/tmp/varsityhub-audit-2026-09-05/roles-db-results-final.json`: **20 suites / 202 assertions passed**. Full exact suite list and log in `roles-db-tests-final.log`; individual counts in JSON. Some suites are static guards, not all 202 assertions are actual HTTP requests.
- Canonical-helper database matrix: `cd server` then safe-prefix `npx tsx scripts/e2e/org-coach-authz-matrix.ts`: **39/39 checks passed**; `roles-helper-matrix.log`. This uses real Postgres and helpers, simulates transfer SQL, and cleans seeded records. It does not drive app UI or send HTTP.
- New before-fix HTTP/DB repro: `npm --prefix server test -- --runInBand --watchman=false --runTestsByPath src/__tests__/audit-20260905-role-email-boundaries.test.ts --json --outputFile=/tmp/varsityhub-audit-2026-09-05/roles-repro-results.json`: **5 controls passed / 3 expected-security-behavior assertions failed**. All three failures show actual intended-vs-current defects above; latest log `roles-repro.log`. Initial replay fixture first hit valid 48-hour global cooldown; corrected both timestamps, then reproduced the actual replay mutation. Final counts exclude that incomplete fixture attempt.
- New test formatted with Prettier. No product fixes, commits or deployment. Root owns client/server typechecks and global gates; do not infer those from this role subaudit.

Counting final nonduplicate suites: 32 existing suites / 334 passing assertions, 39 additional helper-matrix checks, and one new suite with 5 passing controls + 3 deliberate failing repro assertions. Do not add root full-suite counts to this total; they overlap.
