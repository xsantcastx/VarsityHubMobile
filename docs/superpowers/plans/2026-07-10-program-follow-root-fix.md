# Program Follow Root Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace Phase 3's union-read/fan-out-write follow model with a `ProgramFollow` intent ledger + `TeamFollow.via_program_id`, so `is_following`/`followers_count` mean "follows the program," unfollow is lossless, and a team added later reaches existing followers — folded into the Phase 3 branch so #155 ships correct.

**Spec:** `docs/superpowers/specs/2026-07-10-program-follow-root-fix-design.md`
**Branch:** work directly on `feat/sport-programs-phase-3` (currently checked out). Afterward `feat/program-per-sport` (#156) rebases onto it.

## Global Constraints

- Additive migration; `ProgramFollow` has zero prod rows (nothing merged). Migration file `20260710090000_program_follow` (timestamp before program-per-sport's `20260710120000`).
- New model MUST land in `dbBackupTables.ts` `TABLES_IN_ORDER` (after `TeamFollow`), `wipeProduction.ts`, and `dataExport/builder.ts`, or `db-backup-table-order.test.ts` / GDPR-completeness go red.
- Server: `sendError` envelope, `asyncHandler`, `take` on every `findMany`. Run diff-scoped gates (`verify:error-envelope`) AFTER committing (they diff `HEAD^..HEAD`).
- Feed clauses (`feed.ts`, `posts.ts` `buildFollowedPostsWhereClause`) are NOT touched — they keep reading `TeamFollow`.
- Server tests via `cd server && npm test -- --testPathPattern=… --no-coverage`. `registerIdValidation` 400s malformed ids → 404 tests use a well-formed nonexistent cuid.
- The main repo dir has unrelated user WIP (`strings.xml`, `useIAP.ts`) — stage only each task's files, never `git add -A`.

---

### Task 1: Schema — ProgramFollow + TeamFollow.via_program_id + migration + registration

**Files:** `server/prisma/schema.prisma`; new `server/prisma/migrations/20260710090000_program_follow/migration.sql`; `server/src/lib/dbBackupTables.ts`; `server/src/lib/wipeProduction.ts`; `server/src/lib/dataExport/builder.ts`

- [ ] **Step 1** — Schema. Add:

```prisma
model ProgramFollow {
  user_id    String
  program_id String
  created_at DateTime @default(now())
  user    User         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  program SportProgram @relation(fields: [program_id], references: [id], onDelete: Cascade)
  @@id([user_id, program_id])
  @@index([user_id])
  @@index([program_id])
}
```

Add to `model TeamFollow`: `via_program_id String?` and `via_program SportProgram? @relation("TeamFollowViaProgram", fields: [via_program_id], references: [id], onDelete: SetNull)`. Add the back-relations on `User` (`program_follows ProgramFollow[]`), `SportProgram` (`followers ProgramFollow[]` and `fanned_out_team_follows TeamFollow[] @relation("TeamFollowViaProgram")`). Name the relations to avoid Prisma ambiguity.

- [ ] **Step 2** — Hand-write `migration.sql` (do NOT let Prisma regenerate — local DB has unrelated drift). Exactly: `CREATE TABLE "ProgramFollow"` (composite PK, created_at default now), two indexes, two FKs (User cascade, SportProgram cascade); `ALTER TABLE "TeamFollow" ADD COLUMN "via_program_id" TEXT`; one FK `TeamFollow_via_program_id_fkey` → SportProgram `ON DELETE SET NULL`. Verify FK/index names match Prisma's convention against an existing migration.
- [ ] **Step 3** — Apply locally (`cd server && npx prisma migrate deploy`; if it can't run non-interactively, apply the SQL directly via a scratch `tsx` script and `prisma migrate resolve --applied`), then `npx prisma generate`. Verify via `information_schema` that `ProgramFollow` and `TeamFollow.via_program_id` exist.
- [ ] **Step 4** — `dbBackupTables.ts`: insert `'ProgramFollow'` into `TABLES_IN_ORDER` immediately after `'TeamFollow'`. Run `cd server && npm test -- --testPathPattern="db-backup-table-order" --no-coverage` → must PASS (it will fail first, proving the registration is required).
- [ ] **Step 5** — `wipeProduction.ts`: add a `prisma.programFollow.deleteMany()` before `SportProgram`/`User` deletion, matching the file's ordering. `dataExport/builder.ts`: add `programFollow` beside the existing `teamFollow` export block so a user's program-follows are in their GDPR export.
- [ ] **Step 6** — `npx tsc --noEmit --project server/tsconfig.json` (0 new errors — routes don't use the model yet). Commit `feat(programs): ProgramFollow intent ledger + TeamFollow.via_program_id` with the rollback DDL in the body.

---

### Task 2: Follow endpoints — write intent + stamped fan-out + lossless unfollow

**Files:** `server/src/routes/programs.ts`; `server/src/__tests__/program-screen-summary.test.ts`

**Interfaces:** `POST /programs/:id/follow` → creates one `ProgramFollow` row (upsert/createMany skipDuplicates) AND fans out `TeamFollow` rows for active level teams, each stamped `via_program_id: programId`. `DELETE` → removes the `ProgramFollow` row AND `deleteMany` on `TeamFollow` where `user_id` + `via_program_id === programId` (NOT `team_id in …`). Both idempotent, still no `TEAM_FOLLOWED` notifications.

- [ ] **Step 1: failing tests** — extend the suite:
  - Follow writes a `ProgramFollow` row + stamped TeamFollow rows (`via_program_id` set); idempotent on repeat.
  - **Lossless unfollow**: seed a direct JV `TeamFollow` (null `via_program_id`) for user U; U follows the program (adds ProgramFollow + stamped varsity + skips the existing JV via skipDuplicates — note the JV row stays null-stamped because createMany skipDuplicates won't overwrite it); U unfollows the program → ProgramFollow gone, the stamped varsity row gone, **the null-stamped JV row survives**. Assert exact remaining rows.
  - 404 on unknown program (well-formed cuid).
- [ ] **Step 2** — Run → FAIL. Implement. `POST`: `prisma.programFollow.upsert`/`createMany` for the ledger row; the existing fan-out `createMany` gains `via_program_id: programId` on each row. `DELETE`: `prisma.$transaction([programFollow.delete (or deleteMany), teamFollow.deleteMany({ where: { user_id, via_program_id: programId } })])`. Keep `take` bounds. Update the response shapes only if needed (`followed_team_ids` still fine).
- [ ] **Step 3** — Run → PASS. Gates: server tsc 0; after commit `verify:error-envelope && verify:async-handlers`. Commit `feat(programs): follow writes intent ledger + stamped fan-out; lossless unfollow`.

---

### Task 3: screen-summary — intent-based is_following + followers_count

**Files:** `server/src/routes/programs.ts`; `server/src/__tests__/program-screen-summary.test.ts`

- [ ] **Step 1: failing tests** — flip the semantics:
  - `is_following` is true only when a `ProgramFollow` row exists (a viewer following only a level team directly → `is_following: false`). This intentionally replaces the old `program-screen-summary.test.ts` assertion where a level-team follower read `true`.
  - `followers_count` equals the `ProgramFollow` count (NOT the union). Seed: user A follows the program (ledger row); user B follows only a level team directly → `followers_count === 1`, and A's `is_following` true, B's false.
- [ ] **Step 2** — Run → FAIL. Implement: replace the `teamFollow.groupBy` union count with `prisma.programFollow.count({ where: { program_id } })`, and `viewerFollow` with `prisma.programFollow.findUnique({ where: { user_id_program_id: { user_id: viewerId, program_id } } })`. Remove the now-dead `allTeamIds`/union comment. Keep the privacy filter on `levels` exactly as-is (unchanged).
- [ ] **Step 3** — PASS. Full suite `cd server && npm test -- --testPathPattern="program-screen-summary" --no-coverage`. Commit `feat(programs): program is_following + followers_count are intent-based`.

---

### Task 4: Fan-out on team → program assignment (exact reconciliation)

**Files:** `server/src/lib/programFollowFanout.ts` (new); `server/src/routes/teams.ts`; `server/src/__tests__/program-follow-fanout.test.ts` (new)

**Interface:** `fanOutProgramFollowersToTeam(prisma, programId, teamId): Promise<{ created: number; truncated: boolean }>` — read up to 5000 `ProgramFollow` user_ids for the program, `createMany({ data: users.map(u => ({ user_id: u, team_id, via_program_id: programId })), skipDuplicates: true })` in chunks of 1000. If 5000 hit, `truncated: true` → `console.error('[program-fanout]')` + Sentry, operator runs the backstop script (out of scope here; note it).

- [ ] **Step 1: failing test** — a program with 3 existing `ProgramFollow` users; add a new active team with that `program_id`; assert all 3 gain a stamped `TeamFollow` for it. A user who only ever followed a _level team_ (no `ProgramFollow`) does NOT get a row (proves it keys on intent, not the old heuristic).
- [ ] **Step 2** — Implement the lib. Wire two triggers in `teams.ts`, **after** the create `$transaction` commits and in the `PUT /teams/:id` handler: fire when a team gains a non-empty `program_id` (create with `program_id`, or PUT where `program_id` is newly set and differs from the prior value). Never on the org-transfer null-clear, never when unchanged. Fan-out runs post-commit and cannot fail the request — wrap in try/catch that logs loudly, never throws to the client.
- [ ] **Step 3** — PASS. Gates + commit `feat(programs): fan out program followers to a newly added level team`.

---

### Task 5: Docs, gates, PR body, rebase #156

**Files:** `CLAUDE.md`, `AGENTS.md` (byte-identical shared paragraph), `docs/ARCHITECTURE.md`

- [ ] **Step 1** — Rewrite the Phase 3 follow paragraph in all three: follow is a **`ProgramFollow` intent ledger**; `is_following`/`followers_count` are intent-based; `POST` writes the ledger + stamped fan-out; `DELETE` is lossless via `via_program_id`; a team added later is reconciled exactly via `fanOutProgramFollowersToTeam`; feed clauses unchanged (still `TeamFollow`); private-team fan-out on add is intentional (disclosure note = deferred UX follow-up). Do NOT run prettier over `docs/ARCHITECTURE.md`.
- [ ] **Step 2** — Full battery (never concurrent): client tsc; server tsc; `test:regressions`; `cd server && npm test` (triage the 4 known pre-existing server failures — they don't touch follow); `audit:navigation:fail`; `verify:error-envelope`; `verify:async-handlers`; `npx jest app/__tests__ __tests__ --no-coverage` (3 known pre-existing client failures).
- [ ] **Step 3** — Commit docs. Push `feat/sport-programs-phase-3` (updates #155). **Update the #155 PR body**: delete the "Known issues (accepted)" section — they're fixed; add a line pointing to this fix.
- [ ] **Step 4 — rebase #156** — `git checkout feat/program-per-sport && git rebase feat/sport-programs-phase-3`. Resolve conflicts in `server/src/routes/programs.ts` (this fix's intent-count vs #156's gender-removal — both edit the response object) and `server/prisma/schema.prisma` (migrations coexist by timestamp; schema has both ProgramFollow and gender→team). Re-run `npx tsc --noEmit --project server/tsconfig.json` + the program suites on #156 after rebase. Force-push `feat/program-per-sport`. Report the conflict resolution explicitly.

## Out of scope

Coach-facing private-team disclosure copy (deferred UX); the operator backstop reconcile script (only needed if fan-out truncates at 5000 — file a follow-up if a program ever nears that); any feed-clause change.
