# Current role and organization email re-audit — September 5, 2026

Scope frozen at `fccdc186d07d8f7588f0195e9655d0eb3ecb70a3`; initial working tree clean. This report rechecks current code against the earlier role audit and role/event remediation notes. No product changes, external mail, production mutation, commit, or deployment are authorized by this lane.

Threat model: fan/coach privilege escalation; sibling/foreign-team IDOR; revoked or stale membership; mixed-authority batches; current versus former organization ownership; request self-review; signed email replay and application reuse; unverified or ordinary owner access to founder endpoints. Risk classification uses exploitability, blast radius, and recovery.

## Scenarios enumerated before execution

| ID  | Required outcome                                                                             | Planned evidence                                      |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| R01 | Coach administers their own team and cannot administer sibling/foreign teams                 | Real HTTP/DB + authorization helper matrix            |
| R02 | Team manager/assistant can manage games but cannot team settings/invites/transfer            | HTTP/DB role barrier + helper matrix                  |
| R03 | Org owner administers their own organization teams; org manager cannot administer            | HTTP/DB role barrier + helper matrix                  |
| R04 | Team add/remove/role changes enforce role ceilings and sole-owner protection                 | HTTP/DB membership suites                             |
| R05 | Team reassignment checks destination ownership and locked affiliation                        | HTTP/DB transfer suite + source                       |
| R06 | Game/event writes derive per-row authority; mixed batches cannot widen scope                 | Targeted game approval tests + source                 |
| R07 | Founder metrics reject ordinary coach/org owner, unauthenticated and unverified admin        | Real HTTP/DB email boundary suite                     |
| R08 | Current owner signed email approval persists one decision, audit and notification            | Real HTTP/DB email boundary suite                     |
| R09 | Foreign org owner and self-review cannot approve request                                     | Real HTTP/DB regression and guard suite               |
| R10 | Transferred-out owner's app and saved email authority revoked, including transfer-back       | Real HTTP/DB email boundary suite                     |
| R11 | Reused/unused old email cannot mutate reapplied attempt; malformed bindings fail closed      | Real HTTP/DB email boundary suite                     |
| R12 | Legacy owner resolver agrees across app, email recipient, helper and audit actor             | Real HTTP/DB regression + canonical-owner tests       |
| R13 | Simultaneous decisions, ownership race and transactional rollback preserve one safe decision | Real HTTP/PostgreSQL race and retry regression        |
| R14 | Founder/demo allowlist cannot be broadened by org role or notification environment           | Real HTTP demo control + allowlist tests              |
| R15 | Actual owner mailbox delivery, native links, multi-process production behavior               | Runtime acceptance gap unless independently available |

## Results

The historical role/email regression run passed **16 suites / 136 assertions**. The separate real-database authorization helper matrix passed **39/39**. The new HTTP/database suite passed **5/8** cases and reproduced the three defects below. These counts overlap in subject matter; they are not a count of every possible role journey.

R01–R05 and R07–R14 have passing checks for their enumerated boundaries. R06 is partial because mixed-team bulk creation fails. R15 is **not run**: no actual owner email was sent, and there was no native email-link or multi-replica production acceptance run. R16/R17 were added when source review found sibling-route inconsistencies; they fail.

Ordinary coaches cannot edit sibling or foreign teams. Organization owners can administer their own organization teams but cannot edit another organization's team. Organization managers cannot edit team settings. Removing an actual coach membership through the HTTP route immediately revokes subsequent team edit/admin-summary requests, with unchanged persisted data after the denied edit. Opponent staff cannot delete the creator's shared game or overwrite its score.

Current owner email decisions, old-owner rejection after transfer/transfer-back, reused/reapplied tokens, transactional rollback, and concurrent review regressions pass. Historical ROLE-01/02/03 are **Closed for the tested local cases**, not proof of mailbox delivery.

### ROLE-C01 — Bulk creation bypasses organization approval

**Open Bug; high priority.** An approved coach owning a team in an unapproved organization gets HTTP 403 from `POST /games`. Sending the same game through `POST /games/bulk` returns 201 and persists an **approved** game. The single route checks `Organization.admin_approved` at `server/src/routes/games.ts:1638`; the bulk route at line 1893 does not reuse this check.

Reproduction: `R16` in `server/src/__tests__/audit-20260905-current-team-isolation.test.ts`. It asserts both response and persisted rows. Expected `{status:403,persisted:[]}`; actual `{status:201,persisted:[{approval_status:'approved'}]}`. Exploitability: authenticated approved coach with a team in an unapproved organization; blast radius: that organization's public schedule and approval policy; recovery: remove/review the unauthorized published fixtures. Fix: make both routes use the same organization-approval check, per row, before any write.

### ROLE-C02 — Mixed-team bulk creation fails instead of creating a pending request

**Open Bug; medium priority.** A batch containing the caller's team and a foreign team computes `approved` and `pending` correctly, but writes the latter to `Event.status`. That enum contains `draft`, `approved`, `rejected`, `cancelled`; `pending` belongs to `Event.approval_status`. Real Prisma throws and the transaction rolls back; HTTP is 500 rather than 201.

Reproduction: `R06 mixed own/foreign` in the new suite. `server/src/routes/games.ts:1965` assigns the same decision to the two different fields; `server/prisma/schema.prisma:145` defines the status enum. This is a failed legitimate batch, not evidence that the foreign team was approved. Fix: reuse the single-create lifecycle mapping for both fields and assert persisted mixed-batch outcomes, including rollback.

### ROLE-C03 — Legacy organization owner can edit a team but cannot open administration

**Open Bug; medium priority.** A current `league_owner_id` without an OrganizationMembership row can PUT a team successfully, but `GET /teams/:id/admin-summary` returns 403. `loadTeamViewerAccess` (`server/src/routes/teams.ts:215`) derives organization ownership only from active membership; canonical mutation authorization recognizes the owner pointer. Reproduction: `R17` in the new suite. Expected 200 with `permissions.can_administer=true`; actual 403. Fix: use the canonical organization-owner resolver in the shared viewer-access helper and verify summary/roster sibling reads. Production prevalence was not queried.

### Founder access is a deliberate broader allowlist

Ordinary organization owners and coaches do **not** gain founder metrics. However, founder-level access is not literally one account: `server/src/lib/adminEmails.ts` includes the founder mailbox, customer-service mailbox, and the App Review demo identity. Email verification is still required. The demo inclusion is pinned by current tests and is a **Policy Decision**, not an org-role escalation. If “only me” excludes the review account, this is an outstanding product/security decision; no grants were changed during the audit.

## Reproduction and evidence

All runs set `VARSITYHUB_ENV_PATH=/dev/null`, `DOTENV_CONFIG_PATH=/dev/null`, `NODE_ENV=test`, `EMAIL_PROVIDER=test`, a local JWT secret of at least 32 characters, and `DATABASE_URL=postgresql://varsityhub@127.0.0.1:5432/varsityhub_audit_reaudit_roles_20260905`.

```sh
npm --prefix server test -- --runInBand --runTestsByPath src/__tests__/audit-20260905-current-team-isolation.test.ts
```

The command intentionally exits nonzero while the three findings reproduce. Logs: `/tmp/vh-reaudit-roles-20260905/{roles-tests,current-team-tests,helper-matrix}.log`, and `/tmp/varsityhub-current-reaudit-20260905/roles-new.log`. Durable assertion outcomes are in `current-reaudit-evidence.json`. No product source was changed.
