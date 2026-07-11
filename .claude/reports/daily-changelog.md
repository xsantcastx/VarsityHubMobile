# Daily Changelog — 2026-07-11

_Window: commits from the last 72 hours (58 non-merge commits). The dominant theme is the **Sport Program** pivot — a new taxonomy layer that groups an org's level teams (varsity/JV/freshman/etc.) under a single canonical program, with intent-based following that fans out across those teams._

---

## Risky changes (review first)

- **DB schema — 2 new additive Prisma migrations** (both auto-apply on Railway deploy via `start.sh`):
  - `20260709120000_add_sport_programs` — adds `TeamLevel` + `ProgramGender` enums, new `SportProgram` table (unique on `organization_id, sport, gender`), and nullable `Team.level` / `Team.program_id` columns. `SportProgram.organization_id` FK is `ON DELETE RESTRICT`; `Team.program_id` FK is `ON DELETE SET NULL`. Additive/nullable — existing teams unaffected until backfilled. (`9bfa4638`)
  - `20260710090000_program_follow` — new `ProgramFollow` intent-ledger table (composite PK `user_id, program_id`, `ON DELETE CASCADE`) and `TeamFollow.via_program_id` (`ON DELETE SET NULL`) to stamp fan-out rows. (`3a5196d3`)
  - Plumbing: both tables added to `dbBackupTables`, data-export builder/domain names, and `wipeProduction`. `57b77638` fixes wipe ordering — `SportProgram` must be deleted before `Organization` because of the RESTRICT FK. **Verify the backfill script and DR backup/wipe against the real DB before relying on them.**

- **Auth / authorization (3 commits):**
  - `9bd86011` (#141) team role-barrier — closes server-side gaps and adds a client `can_administer` tier flag; touches `team-memberships`, `teams`, `serializeTeam`, `team-admin`, `edit-team`, `my-team`.
  - `352847c7` (#142) org invite/cancel now owner-gated on client; server recognizes legacy `league_owner_id` owners in `organizationAuthorization`.
  - `72173cf4` (#138) session-expiry redirect was being swallowed by the routing-loop guard; now fires correctly (`AuthProvider`).
  - New program follow/screen-summary endpoints are authenticated-read (not org-gated) by design (`01a86e9e`), and screen-summary privacy-filters hidden level teams (`85c44a47`).

- **Payments / ads / audit:**
  - `95f9b670` (#148, ~833 LOC — highest-churn behavioral change of the batch) ads: refunds were being silently stranded on rejection; now reconciled, and the rejection reason is surfaced. Touches `approvalService`, `jobs/scheduler`, `my-ads`.
  - `d9fadf4c` (#149) game/event approvals now logged to `AdminActivityLog`; Apple S2S dedup-write failures now return 503 instead of failing silently (`payments.ts`, `events.ts`, `games.ts`).

- **Legal / PII / production content:**
  - `5e577307` (#146) closes a PII geo-leak, scrubs trademarked demo content, aligns the privacy policy; adds a `cleanup-branded-content.ts` prod script. Touches `privacy-policy` and `account-deletion`. **Confirm the geo-leak fix on the real feed/posts path.**
  - `984c9d12` (#140) retires the `sample-` demo fabrication system end to end (~529 deletions).

- **Production config:** `app.json` gains the Android `/programs` intent filter (`a275aefe` — native, ships only via `eas build`, never OTA). `app.config.js` / `app.json` / `ios/Info.plist` bumped in the build-55 release (`1b8eb116`).

---

## New Features

**Sport Programs — server**

- Canonical sports taxonomy shared by client + server (`ed556c0d`).
- `SportProgram` model + backfill script and name-inference lib (`9bfa4638`, `0d8f5c81`).
- Org sport-program create/list endpoints (`e6f5151a`); teams accept `level` + `program_id`, exposed in serialized baseline (`0de03195`).
- `GET /programs/:id/screen-summary` with level folders + union follower count (`85119eca`).
- Program follow/unfollow fans out across level teams (`8ee21e86`); reworked as an intent ledger with stamped fan-out + lossless unfollow (`1c0b3fc6`); intent-based `is_following` / `followers_count` (`0f92bcec`); fan-out to newly added level teams (`39442af9`); direct team-follow promotes a program-stamped row for symmetry (`be173c58`).

**Sport Programs — client**

- Program entity, schema, screen-summary hook, API wrappers, org-programs hook (`5e0fa174`, `292c2130`); level/gender constants + label helpers (`79a7b247`).
- Public program page with level folders (`8a46387f`); team pages redirect to canonical program page (`ec1db214`); org pages list sport programs (`1bb49df6`).
- Program share landing, deep links, AASA paths (`5b58f727`).
- create-team picks or creates a program + level (`307b94a6`); my-team and manage-teams pickers group/section by program with level labels (`3f4c02cb`, `901babb5`, `b30d219b`); level labels on season-stats chips (`1959564a`).

**Discover / Games following**

- `GET /games` supports `following=true` scoped to the viewer's followed teams (`864fa866`, `2ecc7178`); Discover calendar shows only followed teams' upcoming games (`8cdc5ff3`).

**Events**

- Real in-app event page for standalone events + map marker clustering (`d43c9824`, #139).

**Release**

- Build 55 (#136): video pipeline, posts delete, DR backup, web Google Sign-In — integrated and verified together (`1b8eb116`).

---

## Bug Fixes

- Feed: ad/promo card interleaved after the 3rd upcoming event, not the 2nd (`da78ff0b`, #145).
- Backup: DR-sync alarm no longer fires on the ephemeral `PushTicket` table (`c9679707`, #143).
- Programs: clear stale program link when a team moves orgs (`08e02489`); `PROGRAM_ORG_MISMATCH` via `sendError` envelope (`444f247c`); clear hidden level on program deselect + invalidate cache on create (`47ecaa20`); drop unreachable org-detail grouping + gate programs query (`ead9b4cb`); branded landing fallback for unknown programs (`a275aefe`).
- (Auth / legal / ads fixes are listed under **Risky changes** above.)

---

## Refactors

- Retire the `sample-` demo fabrication system end to end (`984c9d12`, #140).
- Season-stats screen substantially reworked for level labels (`1959564a`, ~475 LOC).

---

## Infrastructure / Tests / Docs

- Tests: repaired 15 stale client contract suites (`eb6a3239`, #122); fixed 6 admin-route suites after the hardcoded admin floor (`782545d4`, #137); fixed 4 stale contract suites + gitignored generated QR assets (`5c7b9ce7`, #135); moved the org-owner check into the shared membership-status-guards helper (`be3d95f7`, #144).
- Docs: extensive sport-program specs/phase plans under `docs/plans` + `docs/specs` (`4b6c52ae`); architecture/AGENTS/CLAUDE updates recording the sport-program layer, follow-as-intent-ledger semantics, and public program pages (`1021ad36`, `279f5af8`, `e6b2cf03`, `f2e89329`, `01a86e9e`, `cd4d5843`).

---

_Generated 2026-07-11._
