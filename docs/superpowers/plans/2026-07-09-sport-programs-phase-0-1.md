# Sport Programs — Phase 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the canonical sports taxonomy and the SportProgram grouping layer (org → program → level teams) with a backfill script — shipped dark, zero UX/billing change.

**Architecture:** Additive only. `SportProgram` is a new Prisma model keyed `(organization_id, sport, gender)`; `Team` gains nullable `level` + `program_id`. **No existing `team_id` key is migrated** — games, posts, follows, chats untouched. Backfill infers program/level/gender from team names, dry-run first. Spec: `docs/superpowers/specs/2026-07-09-sport-program-pivot-design.md`.

**Tech Stack:** Prisma/PostgreSQL, Express + Zod, Jest (server suites need `npm test` ESM wrapper), Expo RN client, shared JSON pattern (`shared/plan-definitions.json` precedent).

## Global Constraints

- Railway auto-deploys `main`; `start.sh` runs `prisma migrate deploy` on every deploy → the migration MUST be purely additive (new table, new nullable columns, new enums). Rollback = down-migration dropping them; no data loss possible.
- All Prisma `findMany` carry `take` (enforced by `unbounded-queries.test.ts`).
- Server errors use the envelope via `sendError` (`npm run verify:error-envelope`); async routes wrapped in `asyncHandler` (`npm run verify:async-handlers`).
- Every new Prisma model MUST be added to `TABLES_IN_ORDER` in `server/src/lib/dbBackupTables.ts` in FK order (enforced by `db-backup-table-order.test.ts`, runs without a DB).
- Full server suite: `cd server && npm test` (bare `npx jest` breaks on ESM); single suites run fine with `npm test -- --testPathPattern=...`.
- Scripts live in `server/scripts/`, dry-run by default with `--apply` flag (house pattern: `backfill-coach-agreements.ts`).
- New team/org mutation endpoints must pick an explicit authorization tier (role-barrier model in CLAUDE.md).

---

### Task 1: Canonical sports taxonomy (shared JSON + server lib + client constants)

**Files:**

- Create: `shared/sports-taxonomy.json`
- Create: `server/src/lib/sportsTaxonomy.ts`
- Create: `server/src/__tests__/sports-taxonomy.test.ts`
- Create: `constants/sports.ts`
- Modify: `app/(tabs)/create-team.tsx:173-183` (replace hardcoded `sports` array)

**Interfaces:**

- Produces: `SPORT_SLUGS: Set<string>`, `isCanonicalSport(slug: string): boolean`, `normalizeSportToSlug(input: string | null | undefined): string | null`, `getSportLabel(slug: string): string` (server lib); `SPORT_OPTIONS: { slug: string; label: string }[]` (client). Task 3 consumes `normalizeSportToSlug`; Task 4 consumes `isCanonicalSport`.

- [ ] **Step 1: Create the taxonomy JSON**

`shared/sports-taxonomy.json`:

```json
{
  "sports": [
    { "slug": "baseball", "label": "Baseball" },
    { "slug": "basketball", "label": "Basketball" },
    { "slug": "cheerleading", "label": "Cheerleading" },
    { "slug": "crew", "label": "Crew / Rowing" },
    { "slug": "cross_country", "label": "Cross Country" },
    { "slug": "dance", "label": "Dance" },
    { "slug": "esports", "label": "Esports" },
    { "slug": "field_hockey", "label": "Field Hockey" },
    { "slug": "football", "label": "Football" },
    { "slug": "golf", "label": "Golf" },
    { "slug": "gymnastics", "label": "Gymnastics" },
    { "slug": "ice_hockey", "label": "Ice Hockey" },
    { "slug": "lacrosse", "label": "Lacrosse" },
    { "slug": "soccer", "label": "Soccer" },
    { "slug": "softball", "label": "Softball" },
    { "slug": "swimming", "label": "Swimming & Diving" },
    { "slug": "tennis", "label": "Tennis" },
    { "slug": "track_field", "label": "Track & Field" },
    { "slug": "volleyball", "label": "Volleyball" },
    { "slug": "wrestling", "label": "Wrestling" },
    { "slug": "other", "label": "Other" }
  ]
}
```

- [ ] **Step 2: Write the failing server test**

`server/src/__tests__/sports-taxonomy.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import {
  SPORT_SLUGS,
  isCanonicalSport,
  normalizeSportToSlug,
  getSportLabel,
} from '../lib/sportsTaxonomy.js';

describe('sports taxonomy', () => {
  it('exposes canonical slugs including the legacy create-team nine', () => {
    for (const slug of [
      'basketball',
      'football',
      'soccer',
      'baseball',
      'tennis',
      'volleyball',
      'swimming',
      'track_field',
      'other',
    ]) {
      expect(SPORT_SLUGS.has(slug)).toBe(true);
    }
  });

  it('validates slugs strictly', () => {
    expect(isCanonicalSport('soccer')).toBe(true);
    expect(isCanonicalSport('Soccer')).toBe(false);
    expect(isCanonicalSport('futbol')).toBe(false);
  });

  it('normalizes free-text sport values from the legacy Team.sport column', () => {
    expect(normalizeSportToSlug('Basketball')).toBe('basketball');
    expect(normalizeSportToSlug('  soccer ')).toBe('soccer');
    expect(normalizeSportToSlug('Track & Field')).toBe('track_field');
    expect(normalizeSportToSlug('track and field')).toBe('track_field');
    expect(normalizeSportToSlug('Track')).toBe('track_field');
    expect(normalizeSportToSlug('Swimming')).toBe('swimming');
    expect(normalizeSportToSlug('Swim & Dive')).toBe('swimming');
    expect(normalizeSportToSlug('XC')).toBe('cross_country');
    expect(normalizeSportToSlug('Hockey')).toBe('ice_hockey');
    expect(normalizeSportToSlug('underwater basket weaving')).toBe(null);
    expect(normalizeSportToSlug(null)).toBe(null);
    expect(normalizeSportToSlug('')).toBe(null);
  });

  it('maps slugs to display labels', () => {
    expect(getSportLabel('track_field')).toBe('Track & Field');
    expect(getSportLabel('nope')).toBe('nope');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="sports-taxonomy" --no-coverage`
Expected: FAIL — `Cannot find module '../lib/sportsTaxonomy.js'`

- [ ] **Step 4: Implement the server lib**

`server/src/lib/sportsTaxonomy.ts` — reuse the multi-path JSON loader pattern from `planLimits.ts` (the build already copies `shared/` into `dist/shared`, so the same candidate paths work):

```ts
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(new URL(import.meta.url).pathname);

function resolveTaxonomyPath(): string {
  const cwd = process.cwd();
  const candidates = Array.from(
    new Set([
      path.resolve(__dirname, '../../shared/sports-taxonomy.json'),
      path.resolve(__dirname, '../../../shared/sports-taxonomy.json'),
      '/app/shared/sports-taxonomy.json',
      '/app/dist/shared/sports-taxonomy.json',
      path.resolve(cwd, 'shared/sports-taxonomy.json'),
      path.resolve(cwd, 'dist/shared/sports-taxonomy.json'),
      path.resolve(cwd, '../shared/sports-taxonomy.json'),
    ])
  );
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`sports-taxonomy.json not found. Checked:\n${candidates.join('\n')}`);
}

type SportEntry = { slug: string; label: string };
const taxonomy = require(resolveTaxonomyPath()) as { sports: SportEntry[] };

export const SPORTS: readonly SportEntry[] = taxonomy.sports;
export const SPORT_SLUGS: ReadonlySet<string> = new Set(taxonomy.sports.map(s => s.slug));

const LABEL_BY_SLUG = new Map(taxonomy.sports.map(s => [s.slug, s.label]));

// Free-text → slug aliases for legacy Team.sport values (lowercased keys).
const SPORT_ALIASES: Record<string, string> = {
  'track & field': 'track_field',
  'track and field': 'track_field',
  track: 'track_field',
  xc: 'cross_country',
  'cross country': 'cross_country',
  'swim & dive': 'swimming',
  'swim and dive': 'swimming',
  swim: 'swimming',
  'swimming & diving': 'swimming',
  hockey: 'ice_hockey',
  rowing: 'crew',
  cheer: 'cheerleading',
};

export function isCanonicalSport(slug: string): boolean {
  return SPORT_SLUGS.has(slug);
}

export function getSportLabel(slug: string): string {
  return LABEL_BY_SLUG.get(slug) ?? slug;
}

export function normalizeSportToSlug(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return null;
  const collapsed = raw.replace(/\s+/g, ' ');
  if (SPORT_SLUGS.has(collapsed)) return collapsed;
  const underscored = collapsed.replace(/[\s/-]+/g, '_').replace(/&/g, 'and');
  if (SPORT_SLUGS.has(underscored)) return underscored;
  if (SPORT_ALIASES[collapsed]) return SPORT_ALIASES[collapsed];
  const byLabel = taxonomy.sports.find(s => s.label.toLowerCase() === collapsed);
  return byLabel ? byLabel.slug : null;
}
```

NOTE for implementer: check how `planLimits.ts` obtains `__dirname`/`require` (top of that file) and mirror it exactly — the snippet above assumes ESM; if `planLimits.ts` uses plain CommonJS-style `require`, copy that instead.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="sports-taxonomy" --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 6: Client constants + create-team picker swap**

Create `constants/sports.ts` (same direct-import pattern as `constants/plans.ts:8`):

```ts
import sportsTaxonomy from '../shared/sports-taxonomy.json';

export type SportOption = { slug: string; label: string };
export const SPORT_OPTIONS: SportOption[] = sportsTaxonomy.sports;
export const SPORT_LABELS: string[] = SPORT_OPTIONS.map(s => s.label);
```

In `app/(tabs)/create-team.tsx`, replace the hardcoded array (lines ~173-183):

```ts
import { SPORT_LABELS } from '@/constants/sports';
// …
const sports = SPORT_LABELS; // was the hardcoded 9-item array
```

The picker UI and `customSport`/'Other' escape hatch are unchanged — labels are what the UI shows and what `Team.sport` stores today; slugs become load-bearing in Task 4.

- [ ] **Step 7: Verify types + client tests, commit**

Run: `npx tsc --noEmit && npx jest app/__tests__ --no-coverage 2>&1 | tail -5`
Expected: 0 type errors; existing client suites PASS

```bash
git add shared/sports-taxonomy.json server/src/lib/sportsTaxonomy.ts server/src/__tests__/sports-taxonomy.test.ts constants/sports.ts "app/(tabs)/create-team.tsx"
git commit -m "feat(sports): canonical sports taxonomy shared by client + server"
```

---

### Task 2: Prisma schema — SportProgram model + Team.level/program_id

**Files:**

- Modify: `server/prisma/schema.prisma` (enums near `MembershipStatus` ~line 87; model near `Team` ~line 1043; Team fields ~1050)
- Modify: `server/src/lib/dbBackupTables.ts` (`TABLES_IN_ORDER`, insert between `'Organization'` and `'Team'`)
- Migration: `server/prisma/migrations/<ts>_add_sport_programs/`

**Interfaces:**

- Produces: Prisma models `SportProgram { id, organization_id, sport, gender, name?, logo_url?, created_at }` with relation `teams: Team[]`; enums `TeamLevel (varsity|jv|freshman|middle_school|unified|other)`, `ProgramGender (boys|girls|coed)`; `Team.level: TeamLevel?`, `Team.program_id: String?`. Tasks 3–5 consume all of these via the generated client.

- [ ] **Step 1: Add schema definitions**

In `server/prisma/schema.prisma`, add the enums (alongside the other enums):

```prisma
enum TeamLevel {
  varsity
  jv
  freshman
  middle_school
  unified
  other
}

enum ProgramGender {
  boys
  girls
  coed
}
```

Add the model (before `model Team`):

```prisma
model SportProgram {
  id              String        @id @default(cuid())
  organization_id String
  sport           String        @db.VarChar(100) // canonical slug from shared/sports-taxonomy.json
  gender          ProgramGender
  name            String?       @db.VarChar(120) // optional display override, e.g. "Lady Knights Basketball"
  logo_url        String?
  created_at      DateTime      @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Restrict)
  teams        Team[]

  @@unique([organization_id, sport, gender])
  @@index([organization_id])
}
```

Inside `model Team`, add (near `sport`/`season` fields ~line 1050):

```prisma
  level      TeamLevel?
  program_id String?

  program SportProgram? @relation(fields: [program_id], references: [id], onDelete: SetNull)
```

and an index alongside the existing Team indexes:

```prisma
  @@index([program_id])
```

Also add the back-relation on `model Organization`:

```prisma
  sport_programs SportProgram[]
```

- [ ] **Step 2: Run the backup-order test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="db-backup-table-order" --no-coverage`
Expected: FAIL — `SportProgram` missing from `TABLES_IN_ORDER` (this test runs without a DB)

- [ ] **Step 3: Add SportProgram to the backup table order**

In `server/src/lib/dbBackupTables.ts`, `TABLES_IN_ORDER`: insert `'SportProgram'` on its own line **between `'Organization'` and `'Team'`** (parent Organization before it; child Team after it — Team.program_id is nullable so no deferred-column entry is needed).

- [ ] **Step 4: Run the backup-order test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="db-backup-table-order" --no-coverage`
Expected: PASS

- [ ] **Step 5: Create the migration and regenerate the client**

Run (against local dev DB): `cd server && npx prisma migrate dev --name add_sport_programs`
Expected: migration SQL contains only `CREATE TYPE` ×2, `CREATE TABLE "SportProgram"`, `ALTER TABLE "Team" ADD COLUMN` ×2, `CREATE INDEX`/`CREATE UNIQUE INDEX` — **verify nothing destructive appears** before committing. Then: `npx prisma generate`.

- [ ] **Step 6: Typecheck + full-schema sanity, commit**

Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5` → 0 errors.
Run: `cd server && npm test -- --testPathPattern="unbounded-queries|db-backup-table-order" --no-coverage` → PASS.

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/src/lib/dbBackupTables.ts
git commit -m "feat(programs): SportProgram model + Team.level/program_id (additive migration)"
```

Rollback note (goes in the PR body): down-migration = `DROP TABLE "SportProgram"; ALTER TABLE "Team" DROP COLUMN "level", DROP COLUMN "program_id"; DROP TYPE "TeamLevel"; DROP TYPE "ProgramGender";` — no data loss risk on the way in; columns are nullable and unwritten until Task 3.

---

### Task 3: Name-inference lib + backfill script

**Files:**

- Create: `server/src/lib/programInference.ts`
- Create: `server/src/__tests__/program-inference.test.ts`
- Create: `server/scripts/backfill-sport-programs.ts`

**Interfaces:**

- Consumes: `normalizeSportToSlug` (Task 1), Prisma `SportProgram`/`TeamLevel`/`ProgramGender` (Task 2).
- Produces: `inferLevelFromName(name: string): TeamLevel | null`, `inferGenderFromName(name: string): 'boys' | 'girls' | 'coed'`, `inferProgramForTeam(team: { name: string; sport: string | null }): { sport: string; gender: 'boys'|'girls'|'coed'; level: TeamLevel | null } | null` (null when sport can't be normalized — those teams are reported, not guessed).

- [ ] **Step 1: Write the failing inference tests**

`server/src/__tests__/program-inference.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import {
  inferLevelFromName,
  inferGenderFromName,
  inferProgramForTeam,
} from '../lib/programInference.js';

describe('program inference from legacy team names', () => {
  it('infers level', () => {
    expect(inferLevelFromName('Varsity Football')).toBe('varsity');
    expect(inferLevelFromName('JV Basketball')).toBe('jv');
    expect(inferLevelFromName('Junior Varsity Soccer')).toBe('jv');
    expect(inferLevelFromName('Freshman Tennis')).toBe('freshman');
    expect(inferLevelFromName('Frosh Baseball')).toBe('freshman');
    expect(inferLevelFromName('Unified Basketball')).toBe('unified');
    expect(inferLevelFromName('Middle School Track')).toBe('middle_school');
    expect(inferLevelFromName('Westhill Wolves')).toBe(null);
  });

  it('infers gender, defaulting coed', () => {
    expect(inferGenderFromName('Girls Varsity Soccer')).toBe('girls');
    expect(inferGenderFromName('Lady Knights Basketball')).toBe('girls');
    expect(inferGenderFromName("Women's Lacrosse")).toBe('girls');
    expect(inferGenderFromName('Boys JV Hockey')).toBe('boys');
    expect(inferGenderFromName("Men's Golf")).toBe('boys');
    expect(inferGenderFromName('Robotics Club')).toBe('coed');
  });

  it('combines name + sport column into a program key', () => {
    expect(inferProgramForTeam({ name: 'Girls JV Soccer', sport: 'Soccer' })).toEqual({
      sport: 'soccer',
      gender: 'girls',
      level: 'jv',
    });
    // sport column empty → fall back to finding a sport word in the name
    expect(inferProgramForTeam({ name: 'Varsity Football', sport: null })).toEqual({
      sport: 'football',
      gender: 'coed',
      level: 'varsity',
    });
    // unresolvable sport → null (reported by the script, never guessed)
    expect(inferProgramForTeam({ name: 'The Wolfpack', sport: 'idk' })).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npm test -- --testPathPattern="program-inference" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the inference lib**

`server/src/lib/programInference.ts`:

```ts
import { normalizeSportToSlug, SPORTS } from './sportsTaxonomy.js';

export type InferredLevel = 'varsity' | 'jv' | 'freshman' | 'middle_school' | 'unified' | 'other';
export type InferredGender = 'boys' | 'girls' | 'coed';

const LEVEL_PATTERNS: Array<[RegExp, InferredLevel]> = [
  [/\bjunior\s+varsity\b|\bjv\b/i, 'jv'],
  [/\bvarsity\b/i, 'varsity'],
  [/\bfreshman\b|\bfrosh\b|\b9th\s*grade\b/i, 'freshman'],
  [/\bmiddle\s*school\b|\bms\b(?=\s|$)/i, 'middle_school'],
  [/\bunified\b/i, 'unified'],
];

export function inferLevelFromName(name: string): InferredLevel | null {
  for (const [re, level] of LEVEL_PATTERNS) {
    if (re.test(name)) return level;
  }
  return null;
}

export function inferGenderFromName(name: string): InferredGender {
  if (/\bgirls?\b|\blady\b|\bwomen'?s?\b/i.test(name)) return 'girls';
  if (/\bboys?\b|\bmen'?s?\b/i.test(name)) return 'boys';
  return 'coed';
}

export function inferProgramForTeam(team: {
  name: string;
  sport: string | null;
}): { sport: string; gender: InferredGender; level: InferredLevel | null } | null {
  let slug = normalizeSportToSlug(team.sport);
  if (!slug) {
    // Fall back: scan the team name for a sport label ("Varsity Football").
    const lower = team.name.toLowerCase();
    const hit = SPORTS.find(s => s.slug !== 'other' && lower.includes(s.label.toLowerCase()));
    slug = hit ? hit.slug : normalizeSportToSlug(team.name);
  }
  if (!slug || slug === 'other') return null;
  return {
    sport: slug,
    gender: inferGenderFromName(team.name),
    level: inferLevelFromName(team.name),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && npm test -- --testPathPattern="program-inference" --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the backfill script**

`server/scripts/backfill-sport-programs.ts` (house pattern: dry-run default, `--apply`):

```ts
#!/usr/bin/env npx tsx
/**
 * backfill-sport-programs.ts
 *
 * Phase 1 of the sport-program pivot: for every active team, infer
 * (sport, gender, level) from Team.sport + Team.name, upsert the org's
 * SportProgram, and link the team (program_id + level). Teams whose sport
 * cannot be normalized are REPORTED and left untouched — never guessed.
 *
 * Dry run by default. Use --apply to write.
 *   cd server
 *   npx tsx scripts/backfill-sport-programs.ts          # dry run
 *   npx tsx scripts/backfill-sport-programs.ts --apply
 */
import { prisma } from '../src/lib/prisma.js';
import { inferProgramForTeam } from '../src/lib/programInference.js';

const apply = process.argv.includes('--apply');

async function main() {
  const teams = await prisma.team.findMany({
    where: { status: 'active', program_id: null, club_type: 'sport' },
    select: { id: true, name: true, sport: true, organization_id: true },
    take: 100000,
  });

  const unresolved: typeof teams = [];
  const planned: Array<{
    teamId: string;
    teamName: string;
    orgId: string;
    sport: string;
    gender: string;
    level: string | null;
  }> = [];

  for (const team of teams) {
    const inferred = inferProgramForTeam(team);
    if (!inferred) {
      unresolved.push(team);
      continue;
    }
    planned.push({
      teamId: team.id,
      teamName: team.name,
      orgId: team.organization_id,
      sport: inferred.sport,
      gender: inferred.gender,
      level: inferred.level,
    });
  }

  console.log(`[programs-backfill] mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`[programs-backfill] linkable teams: ${planned.length}`);
  for (const p of planned) {
    console.log(`  - ${p.teamName} -> ${p.gender}/${p.sport}/${p.level ?? 'no-level'}`);
  }
  console.log(`[programs-backfill] UNRESOLVED (left untouched): ${unresolved.length}`);
  for (const t of unresolved) {
    console.log(`  - ${t.name} (sport column: ${JSON.stringify(t.sport)})`);
  }
  if (!apply) {
    console.log('[programs-backfill] dry run complete — re-run with --apply to write.');
    return;
  }

  let linked = 0;
  for (const p of planned) {
    const program = await prisma.sportProgram.upsert({
      where: {
        organization_id_sport_gender: {
          organization_id: p.orgId,
          sport: p.sport,
          gender: p.gender as any,
        },
      },
      update: {},
      create: { organization_id: p.orgId, sport: p.sport, gender: p.gender as any },
    });
    await prisma.team.update({
      where: { id: p.teamId },
      data: { program_id: program.id, level: (p.level ?? 'other') as any },
    });
    linked += 1;
  }
  console.log(`[programs-backfill] done: linked ${linked} teams.`);
}

main()
  .catch(err => {
    console.error('[programs-backfill] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Dry-run against local DB, commit**

Run: `cd server && npx tsx scripts/backfill-sport-programs.ts`
Expected: dry-run listing; zero writes. (Production run happens post-merge, against Postgres-TnGR, dry-run first — same runbook as `archive-athlete-team-memberships.ts`.)

```bash
git add server/src/lib/programInference.ts server/src/__tests__/program-inference.test.ts server/scripts/backfill-sport-programs.ts
git commit -m "feat(programs): name-inference lib + sport-program backfill script"
```

---

### Task 4: Program endpoints (create + list) on the organizations router

**Files:**

- Modify: `server/src/routes/organizations.ts` (add both routes BEFORE the `GET /:id` catch-all at ~line 3310)
- Create: `server/src/__tests__/sport-programs.test.ts`

**Interfaces:**

- Consumes: `isCanonicalSport` (Task 1), `isOrganizationOwnerScoped` (existing, `organizations.ts:22`), Prisma `sportProgram` (Task 2).
- Produces: `POST /organizations/:id/programs` body `{ sport: slug, gender: 'boys'|'girls'|'coed', name?: string }` → 201 `{ program }`; 409 `PROGRAM_EXISTS` on duplicate; 400 `INVALID_SPORT` on non-canonical slug; 403 `PERMISSION_DENIED` for non-members. `GET /organizations/:id/programs` → `{ programs: [{ id, sport, gender, name, teams: [{ id, name, level }] }] }`. Phase 2 client work consumes both.

- [ ] **Step 1: Write the failing endpoint tests**

`server/src/__tests__/sport-programs.test.ts` — follow the fixture pattern of `role-barrier-authorization.test.ts` (bcrypt user + org + memberships via prisma, supertest against `app`):

```ts
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;
const ts = Date.now();

describe('sport program endpoints', () => {
  let ownerId = '',
    memberCoachId = '',
    outsiderId = '';
  let ownerToken = '',
    memberCoachToken = '',
    outsiderToken = '';
  let orgId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const mkUser = async (label: string) => {
      const u = await prisma.user.create({
        data: {
          email: `programs-${label}-${ts}@example.com`,
          password_hash: passwordHash,
          display_name: `Programs ${label}`,
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
        },
      });
      return { id: u.id, token: signJwt({ id: u.id }) };
    };
    const owner = await mkUser('owner');
    ownerId = owner.id;
    ownerToken = owner.token;
    const member = await mkUser('member');
    memberCoachId = member.id;
    memberCoachToken = member.token;
    const outsider = await mkUser('outsider');
    outsiderId = outsider.id;
    outsiderToken = outsider.token;

    const org = await prisma.organization.create({
      data: {
        name: `Programs Org ${ts}`,
        org_type: 'school',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: ownerId,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
        { organization_id: orgId, user_id: memberCoachId, role: 'member', status: 'active' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerId, memberCoachId, outsiderId] } } })
      .catch(() => {});
  });

  it('org owner creates a program', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sport: 'basketball', gender: 'girls' });
    expect(res.status).toBe(201);
    expect(res.body.program.sport).toBe('basketball');
    expect(res.body.program.gender).toBe('girls');
  });

  it('member coach of the org can create a program', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${memberCoachToken}`)
      .send({ sport: 'soccer', gender: 'boys' });
    expect(res.status).toBe(201);
  });

  it('duplicate (org, sport, gender) → 409 PROGRAM_EXISTS', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sport: 'basketball', gender: 'girls' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PROGRAM_EXISTS');
  });

  it('non-canonical sport → 400 INVALID_SPORT', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sport: 'Basketball', gender: 'girls' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SPORT');
  });

  it('outsider (no org membership) → 403', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ sport: 'tennis', gender: 'coed' });
    expect(res.status).toBe(403);
  });

  it('lists programs with their level teams', async () => {
    const prog = await prisma.sportProgram.findFirst({
      where: { organization_id: orgId, sport: 'basketball' },
    });
    await prisma.team.create({
      data: {
        name: `Programs Varsity ${ts}`,
        organization_id: orgId,
        program_id: prog.id,
        level: 'varsity',
      },
    });
    const res = await request(app)
      .get(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const basketball = res.body.programs.find((p: any) => p.sport === 'basketball');
    expect(basketball.teams.map((t: any) => t.level)).toContain('varsity');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npm test -- --testPathPattern="sport-programs" --no-coverage`
Expected: FAIL — 404s (routes don't exist)

- [ ] **Step 3: Implement the routes**

In `server/src/routes/organizations.ts`, add before the `GET /:id` catch-all (~line 3310), following the file's conventions (`asyncHandler`, `sendError`, `requireAuth`/`requireVerified`/`requireOnboarded`):

```ts
// ── Sport programs (Phase 1 of the sport-program pivot) ──────────────
const createProgramSchema = z.object({
  sport: z.string().min(1).max(100),
  gender: z.enum(['boys', 'girls', 'coed']),
  name: z.string().trim().min(1).max(120).optional(),
});

// POST /organizations/:id/programs — org owner or any active org member
// (approved coaches land as org 'member'); same tier as team creation.
organizationsRouter.post(
  '/:id/programs',
  requireAuth as any,
  requireVerified as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const orgId = String(req.params.id);
    const parsed = createProgramSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, 'Validation failed', {
        details: parsed.error.flatten().fieldErrors,
      });
    if (!isCanonicalSport(parsed.data.sport))
      return sendError(res, 400, 'INVALID_SPORT', {
        message: 'sport must be a canonical slug from the sports taxonomy.',
      });

    const isOwner = await isOrganizationOwnerScoped(req.user.id, orgId);
    const membership = isOwner
      ? null
      : await prisma.organizationMembership.findFirst({
          where: { organization_id: orgId, user_id: req.user.id, status: 'active' },
          select: { id: true },
        });
    if (!isOwner && !membership) return sendError(res, 403, 'PERMISSION_DENIED');

    try {
      const program = await prisma.sportProgram.create({
        data: {
          organization_id: orgId,
          sport: parsed.data.sport,
          gender: parsed.data.gender,
          name: parsed.data.name ?? null,
        },
      });
      return res.status(201).json({ ok: true, program });
    } catch (err: any) {
      if (err?.code === 'P2002')
        return sendError(res, 409, 'PROGRAM_EXISTS', {
          message: 'This organization already has that sport program.',
        });
      throw err;
    }
  })
);

// GET /organizations/:id/programs — any authenticated user (public info)
organizationsRouter.get(
  '/:id/programs',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const orgId = String(req.params.id);
    const programs = await prisma.sportProgram.findMany({
      where: { organization_id: orgId },
      orderBy: [{ sport: 'asc' }, { gender: 'asc' }],
      take: 200,
      include: {
        teams: {
          where: { status: 'active' },
          select: { id: true, name: true, level: true },
          orderBy: { created_at: 'asc' },
          take: 25,
        },
      },
    });
    return res.json({ programs });
  })
);
```

Add the import at the top of the file: `import { isCanonicalSport } from '../lib/sportsTaxonomy.js';`

- [ ] **Step 4: Run to verify pass**

Run: `cd server && npm test -- --testPathPattern="sport-programs" --no-coverage`
Expected: PASS (6 tests)

- [ ] **Step 5: Envelope/handler gates + commit**

Run: `npm run verify:error-envelope && npm run verify:async-handlers` → clean.

```bash
git add server/src/routes/organizations.ts server/src/__tests__/sport-programs.test.ts
git commit -m "feat(programs): org sport-program create/list endpoints"
```

---

### Task 5: Team create/update accept level + program_id; serializeTeam exposes them

**Files:**

- Modify: `server/src/routes/teams.ts` (`createTeamSchema` ~line 2005; the `/` create schema ~line 1260; update schema in `PUT /teams/:id` ~line 1769)
- Modify: `server/src/lib/serializeTeam.ts` (baseline select + output)
- Modify: `server/src/__tests__/sport-programs.test.ts` (extend)

**Interfaces:**

- Consumes: Task 2 models; Task 4 test fixtures.
- Produces: `POST /teams/create` and `PUT /teams/:id` accept optional `level` (`z.enum(['varsity','jv','freshman','middle_school','unified','other'])`) and `program_id` (`z.string().min(1)`); server verifies `program.organization_id === team.organization_id`, else 400 `PROGRAM_ORG_MISMATCH`. Serialized teams carry `level` and `program_id` (nullable) in the baseline payload — Phase 2/3 clients rely on these exact key names.

- [ ] **Step 1: Extend the endpoint tests (failing)**

Append to `sport-programs.test.ts`:

```ts
it('team create accepts level + program_id and validates org match', async () => {
  const prog = await prisma.sportProgram.findFirst({
    where: { organization_id: orgId, sport: 'soccer' },
  });
  const ok = await request(app)
    .post('/teams/create')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: `Programs JV Soccer ${ts}`,
      organization_id: orgId,
      sport: 'Soccer',
      level: 'jv',
      program_id: prog.id,
    });
  expect(ok.status).toBe(201);
  expect(ok.body.team?.level ?? ok.body.level).toBe('jv');

  const otherOrg = await prisma.organization.create({
    data: {
      name: `Programs Other Org ${ts}`,
      org_type: 'school',
      admin_approved: true,
      updated_at: new Date(),
      league_owner_id: outsiderId,
    },
  });
  const mismatch = await request(app)
    .post('/teams/create')
    .set('Authorization', `Bearer ${outsiderToken}`)
    .send({
      name: `Mismatch ${ts}`,
      organization_id: otherOrg.id,
      level: 'varsity',
      program_id: prog.id,
    });
  expect(mismatch.status).toBe(400);
  expect(mismatch.body.error).toBe('PROGRAM_ORG_MISMATCH');
  await prisma.team.deleteMany({ where: { organization_id: otherOrg.id } }).catch(() => {});
  await prisma.organization.delete({ where: { id: otherOrg.id } }).catch(() => {});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npm test -- --testPathPattern="sport-programs" --no-coverage`
Expected: FAIL — unknown keys stripped / level undefined

- [ ] **Step 3: Implement**

In both team-create Zod schemas and the update schema in `server/src/routes/teams.ts` add:

```ts
  level: z.enum(['varsity', 'jv', 'freshman', 'middle_school', 'unified', 'other']).optional(),
  program_id: z.string().min(1).optional(),
```

In `createTeamWithGuardrails` (and the `PUT /teams/:id` handler when `program_id` present), before creating/updating, validate the program:

```ts
if (data.program_id) {
  const program = await prisma.sportProgram.findUnique({
    where: { id: data.program_id },
    select: { id: true, organization_id: true },
  });
  if (!program || program.organization_id !== organizationId) {
    return sendError(res, 400, 'PROGRAM_ORG_MISMATCH', {
      message: 'program_id must belong to the same organization as the team.',
    });
  }
}
```

…and thread `level: data.level ?? null, program_id: data.program_id ?? null` into the `prisma.team.create` / `update` data blocks. (Implementer note: the create path builds its data object inside the `$transaction` in `createTeamWithGuardrails` — add the two fields where `sport`/`season` are already threaded; mirror in whatever exact `sendError`/throw convention the surrounding guardrail code uses for its 400s.)

In `server/src/lib/serializeTeam.ts`: add `level: true, program_id: true` to `TEAM_SERIALIZE_SAFE_SELECT` and emit both in the baseline output object; add `'level'`/`'program_id'` to `SERIALIZE_TEAM_BASELINE_FIELDS` so `serialize-team.test.ts` stays green.

- [ ] **Step 4: Run all touched suites**

Run: `cd server && npm test -- --testPathPattern="sport-programs|serialize-team|unbounded-queries" --no-coverage`
Expected: PASS

- [ ] **Step 5: Full gates + commit**

Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5` → 0 errors; `npm run verify:error-envelope` → clean.

```bash
git add server/src/routes/teams.ts server/src/lib/serializeTeam.ts server/src/__tests__/sport-programs.test.ts
git commit -m "feat(programs): teams accept level + program_id; serialized baseline exposes them"
```

---

### Task 6: Docs + regression battery

**Files:**

- Modify: `CLAUDE.md` (System Architecture + Team Role-Barrier sections), `AGENTS.md` (same pass — shared-facts rule)
- Modify: `docs/ARCHITECTURE.md` (org → program → team hierarchy)

- [ ] **Step 1: Document the layer**

Add to both CLAUDE.md and AGENTS.md (architecture section): one paragraph — `SportProgram` groups teams by (org, sport, gender); `Team.level`/`Team.program_id` nullable; canonical sports in `shared/sports-taxonomy.json` (server: `lib/sportsTaxonomy.ts`, client: `constants/sports.ts`); backfill via `server/scripts/backfill-sport-programs.ts`; billing still counts teams until Phase 4.

- [ ] **Step 2: Run the regression battery**

Run: `npm run test:regressions` and `cd server && npm test` (full suite, migrated local DB)
Expected: green, or only pre-existing known failures (compare against a main-branch run).

- [ ] **Step 3: Commit + PR**

```bash
git add CLAUDE.md AGENTS.md docs/ARCHITECTURE.md
git commit -m "docs(programs): record sport-program layer + taxonomy"
```

PR body must include (release-gate items): migration status + rollback note (Task 2), before/after of the backfill dry-run on a staging copy, and the note that this ships dark (no client UX reads programs yet).

---

## Post-merge runbook

1. Railway deploys `main`; `prisma migrate deploy` applies the additive migration automatically.
2. Backfill against LIVE DB (Postgres-TnGR — never the ballast backup): dry-run, review the UNRESOLVED list, then `--apply`.
3. No `eas update` needed — Phase 1 has no client-visible change (create-team's picker swap is cosmetic-identical; publish it with the next scheduled OTA).

## Deferred to Phase 2–4 plans (do NOT build here)

Program-grouped coach UX and switchers; create-flow "program + levels"; public program pages with folders + follower union + deep-link aliasing; chat model decision; billing re-unit (Stripe quantity, `countTeamsForBillingContext`, ordinal locking, plan-definitions copy, App Store disclosure card, IAP Veteran hole).
