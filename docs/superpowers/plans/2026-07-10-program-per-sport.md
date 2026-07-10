# Program = Sport (gender moves to Team) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A sport program is keyed by `(organization_id, sport)` — **not** gender. Boys' and girls' teams live inside the same program as sibling level teams. Gender becomes a nullable `Team` attribute. Folder labels read "Boys Varsity", "Girls Varsity", "Freshman".

**Architecture:** Additive-then-corrective. `SportProgram.gender` is dropped and its unique key narrowed to `(organization_id, sport)`; `Team.gender` is added. The enum `ProgramGender` is renamed `TeamGender` (it now describes a team). Nothing is re-keyed: `Team.program_id`, `Team.level`, follows, games, posts, chats all keep their meaning.

**Why now:** none of PRs #152/#153/#154/#155 are merged, so `SportProgram` has never existed in production. `git show origin/main:server/prisma/schema.prisma | grep -c "model SportProgram"` → `0`.

## Global Constraints

- **Do NOT amend `20260709120000_add_sport_programs`.** It is committed and applied to the local dev DB; editing it breaks Prisma's checksum. Add a **new corrective migration**. Prod applies both on first deploy; the end state is identical.
- Migration must be safe under `start.sh`'s `prisma migrate deploy`: `SportProgram` has no production rows, so dropping `gender` and narrowing the unique key cannot lose data. Still write it as explicit DDL, not a destructive reset.
- Every new Prisma model/enum change keeps `db-backup-table-order.test.ts` green (no new model here — enum rename only, no `TABLES_IN_ORDER` change).
- Server: `sendError` envelope, `asyncHandler`, `take` on every `findMany`. Run diff-scoped gates **after** committing (`verify:error-envelope` diffs `HEAD^..HEAD`).
- Server tests via `cd server && npm test -- --testPathPattern=… --no-coverage`.
- Client: no hardcoded dark text colors; `npx tsc --noEmit` clean.
- Branch `feat/program-per-sport` sits on top of `feat/sport-programs-phase-3`. The dirty tree has unrelated user WIP — stage only each task's own files, never `git add -A`.
- **`registerIdValidation` 400s malformed ids**, so 404 tests need a well-formed nonexistent cuid.

---

### Task 1: Schema + corrective migration

**Files:** `server/prisma/schema.prisma`; new `server/prisma/migrations/<ts>_program_per_sport/migration.sql`

**Interfaces produced:** `enum TeamGender { boys girls coed }`; `SportProgram` loses `gender`, `@@unique([organization_id, sport])`; `Team.gender TeamGender?` + `@@index([program_id, gender])` is NOT needed — skip extra indexes.

- [ ] **Step 1** — Schema edits:
  - Rename `enum ProgramGender` → `enum TeamGender` (same three values).
  - `SportProgram`: delete the `gender` field; change `@@unique([organization_id, sport, gender])` → `@@unique([organization_id, sport])`.
  - `Team`: add `gender TeamGender?` beside `level`.
- [ ] **Step 2** — Hand-write `migration.sql` (mirror the additive style of the prior one; verify it against `npx prisma migrate diff --from-schema-datamodel` output but do not let Prisma regenerate the whole file, because the local DB carries unrelated drift):

```sql
ALTER TYPE "ProgramGender" RENAME TO "TeamGender";
DROP INDEX "SportProgram_organization_id_sport_gender_key";
ALTER TABLE "SportProgram" DROP COLUMN "gender";
CREATE UNIQUE INDEX "SportProgram_organization_id_sport_key" ON "SportProgram"("organization_id", "sport");
ALTER TABLE "Team" ADD COLUMN "gender" "TeamGender";
```

- [ ] **Step 3** — Apply locally (`npx prisma migrate deploy` from `server/`, or `prisma migrate resolve` if the local DB drifts), then `npx prisma generate`.
- [ ] **Step 4** — Gates: `npx tsc --noEmit --project server/tsconfig.json` will FAIL until Task 2 (expected — the routes still reference `program.gender`). Run `cd server && npm test -- --testPathPattern="db-backup-table-order" --no-coverage` → PASS.
- [ ] **Step 5** — Commit `feat(programs): program keyed by sport; gender moves to Team`. Include the rollback note in the commit body: reverse DDL is `ADD COLUMN gender`, restore the 3-col unique, rename the enum back.

---

### Task 2: Server — routes, serializer, share landing

**Files:** `server/src/routes/programs.ts`, `server/src/routes/organizations.ts` (`createProgramSchema` ~:3309), `server/src/routes/teams.ts` (both create schemas + PUT update schema), `server/src/lib/serializeTeam.ts`, `server/src/routes/shareLanding.ts` (label helper), and the tests `server/src/__tests__/program-screen-summary.test.ts`, `sport-programs.test.ts`, `program-share-landing.test.ts`

- [ ] **Step 1** — `organizations.ts`: drop `gender` from `createProgramSchema`. The `(org, sport)` unique still yields P2002 → keep the existing `409 PROGRAM_EXISTS`. The `GET /organizations/:id/programs` include should now select `teams: { select: { id, name, level, gender } }`.
- [ ] **Step 2** — `teams.ts`: add `gender: z.enum(['boys','girls','coed']).optional()` to **all three** schemas (`createSchema`, `createTeamSchema`, the PUT update schema) beside `level`, and thread `gender: data.gender ?? null` into the create/update data blocks exactly where `level` is threaded.
- [ ] **Step 3** — `serializeTeam.ts`: add `gender: true` to `TEAM_SERIALIZE_SAFE_SELECT`, emit `gender` in the baseline output, and append `'gender'` to `SERIALIZE_TEAM_BASELINE_FIELDS`.
- [ ] **Step 4** — `programs.ts`: remove `gender` from the `program` response object. `levels[].team` already carries it via `serializeTeam`. Everything else (privacy filter, follower union, canonical level sort) is unchanged.
- [ ] **Step 5** — `shareLanding.ts`: the local label helper drops the gender prefix — the title becomes `name ?? titleCase(sport)`, still prefixed by the org name ("Stamford High — Basketball").
- [ ] **Step 6** — Update the three test files: fixtures create programs without `gender` and teams **with** it; the share-landing title assertion drops "Girls"; `sport-programs.test.ts`'s duplicate-program test now collides on `(org, sport)` alone (so its second create must use the same sport, any gender — gender is no longer part of the key).
- [ ] **Step 7** — Gates: server tsc 0 errors; `cd server && npm test -- --testPathPattern="program-screen-summary|sport-programs|program-share-landing|serialize-team|unbounded-queries" --no-coverage` → PASS. After committing: `npm run verify:error-envelope && npm run verify:async-handlers`.
- [ ] **Step 8** — Commit `feat(programs): server treats gender as a team attribute`.

---

### Task 3: Inference + backfill

**Files:** `server/src/lib/programInference.ts`, `server/src/__tests__/program-inference.test.ts`, `server/scripts/backfill-sport-programs.ts`

`inferGenderFromName` already exists and already returns `boys|girls|coed`. The only change is **where the value lands**: on the team, not the program key.

- [ ] **Step 1** — Update the test first: `inferProgramForTeam({name:'Girls JV Soccer', sport:'Soccer'})` still returns `{sport:'soccer', gender:'girls', level:'jv'}` (the shape is unchanged — the _consumer_ changes). Add a case proving two teams of different genders in the same sport map to the **same program key**: assert both produce `sport:'soccer'`, and document that the caller now upserts on `(org, sport)`.
- [ ] **Step 2** — `backfill-sport-programs.ts`: change the upsert to
      `where: { organization_id_sport: { organization_id, sport } }`, `create: { organization_id, sport }` (no gender), and set `data: { program_id, level: level ?? 'other', gender }` on the team update. Update the dry-run log line to print `gender/level` under the program, e.g. `- Girls JV Soccer -> soccer [girls/jv]`.
- [ ] **Step 3** — Verify the dedup story by hand: seed a local org with "Boys Varsity Soccer" + "Girls Varsity Soccer", dry-run, confirm **one** program with two teams; `--apply`; confirm `SportProgram` count is 1 and both teams carry distinct `gender`; re-run dry to confirm idempotence; clean up the fixtures.
- [ ] **Step 4** — Gates + commit `feat(programs): backfill writes gender to teams, one program per sport`.

---

### Task 4: Client

**Files:** `constants/programs.ts`, `api/schemas/program.ts`, `app/(tabs)/create-team.tsx`, `app/program-page.tsx`, `app/(tabs)/organization.tsx`, plus the touched tests (`__tests__/program-labels.test.ts`, `app/__tests__/program-page.smoke.test.tsx`, `app/__tests__/organization.smoke.test.tsx`, `__tests__/create-team-program-payload.test.ts`)

**Interfaces produced:**

```ts
// constants/programs.ts
export type TeamGender = 'boys' | 'girls' | 'coed';
export type ProgramSummary = { id: string; sport: string; name?: string | null }; // gender REMOVED
export function formatProgramLabel(p: ProgramSummary): string; // name ?? sportLabel
export function formatTeamFolderLabel(team: {
  gender?: string | null;
  level?: string | null;
}): string;
// "Boys Varsity" | "Girls JV" | "Varsity" (coed/null gender) | "Team" (both null)
```

- [ ] **Step 1: failing test** — extend `__tests__/program-labels.test.ts`:

```ts
expect(formatProgramLabel({ id: '1', sport: 'basketball' })).toBe('Basketball');
expect(formatProgramLabel({ id: '2', sport: 'basketball', name: 'Lady Knights' })).toBe(
  'Lady Knights'
);
expect(formatTeamFolderLabel({ gender: 'girls', level: 'varsity' })).toBe('Girls Varsity');
expect(formatTeamFolderLabel({ gender: 'boys', level: 'jv' })).toBe('Boys JV');
expect(formatTeamFolderLabel({ gender: 'coed', level: 'varsity' })).toBe('Varsity');
expect(formatTeamFolderLabel({ gender: null, level: 'freshman' })).toBe('Freshman');
expect(formatTeamFolderLabel({ gender: 'girls', level: null })).toBe('Girls');
expect(formatTeamFolderLabel({ gender: null, level: null })).toBe('Team');
```

- [ ] **Step 2** — Implement in `constants/programs.ts`. `GENDER_OPTIONS` stays (create-team still needs it — see Step 4). Drop `gender` from `ProgramSummary`.
- [ ] **Step 3** — `api/schemas/program.ts`: remove `gender` from the `program` object; add `gender` (nullable, optional) to the level `team` shape.
- [ ] **Step 4** — `app/(tabs)/create-team.tsx`: the gender chips **stop describing the program and start describing the team**. Rename state `newProgramGender` → `teamGender`, show the chip row whenever `clubType === 'sport'` (not only when creating a program), send `gender` in the team payload via `buildProgramFields` (rename it `buildProgramFields` → keep the name; add `gender` to its return), and drop `gender` from the `Organization.createProgram` call and from the 409-recovery `(sport, gender)` match — the match is now on `sport` alone.
- [ ] **Step 5** — `app/program-page.tsx`: folder headers use `formatTeamFolderLabel({ gender: lvl.team.gender, level: lvl.level })` instead of `formatLevelLabel(lvl.level) ?? 'Team'`. **Folder ordering** must now be stable across genders: sort by `(levelRank, gender)` so "Boys Varsity" precedes "Girls Varsity" precedes "Boys JV". Do this client-side; the server's canonical level sort stays as-is.
- [ ] **Step 6** — `app/(tabs)/organization.tsx`: the program row subtitle currently joins level labels. It becomes `"{n} teams · {folder labels}"` using `formatTeamFolderLabel`, deduped, capped at 3 with an "+N more" suffix so a 6-team program doesn't overflow the row.
- [ ] **Step 7** — Gates: `npx tsc --noEmit`; `npx jest app/__tests__ __tests__ --no-coverage` (no new failures vs the 3 known pre-existing); commit `feat(programs): client treats gender as a team attribute`.

---

### Task 5: Docs, gates, PR

**Files:** `CLAUDE.md`, `AGENTS.md` (byte-identical shared paragraph), `docs/ARCHITECTURE.md`

- [ ] **Step 1** — Rewrite the sport-program paragraphs: a program is `(organization_id, sport)`; `Team.gender` + `Team.level` are nullable team attributes; folders read "Boys Varsity"; **billing counts sports, so a school running boys' and girls' basketball across three levels pays for one unit.** Do NOT run prettier over `docs/ARCHITECTURE.md` (its markdown round-trips unstably).
- [ ] **Step 2** — Full battery: client tsc; server tsc; `npm run test:regressions`; `cd server && npm test` (triage against base — the 4 known pre-existing server failures reproduce on base; **copy `.env` and `server/.env` into any comparison worktree or the base looks catastrophically broken**); `npm run audit:navigation:fail`; `verify:error-envelope`; `verify:async-handlers`. Never run heavy jest suites concurrently — CPU contention manufactures phantom failures.
- [ ] **Step 3** — Commit docs; open the PR based on `feat/sport-programs-phase-3`.

PR body must state: the corrective migration and why the original wasn't amended; that `SportProgram` never existed in prod so no data is at risk; that Phase 4's billing unit is now **one per sport** (~15/school for a Stamford-sized department, not ~27), which likely requires revisiting the per-unit price to stay revenue-neutral; and that PRs #153/#154/#155 must merge before this one.

## Out of scope

Phase 4 billing itself; the follow-reconciliation work (separate branch — note its `ProgramFollow` model must key on `program_id` only, which this change does not disturb); search filtering by gender.
