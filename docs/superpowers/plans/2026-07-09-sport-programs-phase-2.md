# Sport Programs — Phase 2 Implementation Plan (Coach UX regrouped by program)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coach-facing screens group teams by sport program: manage-teams gets program sections, the my-team picker nests program → level, create-team gains program + level pickers, season-stats chips show levels.

**Architecture:** Client-only phase (server shipped in Phase 0+1 / PR #153). Grouping strategy is **option (a)** from the research: group the rich managed-teams list client-side by `program_id`; the programs endpoint supplies program metadata (sport/gender/name) only. Teams with `program_id: null` (legacy/unresolved/extracurricular) render in an "Other teams" section — never hidden. Branch stacks on `feat/sport-programs-phase-0-1`.

**Tech Stack:** Expo RN, react-query via `hooks/useManagedTeamsQuery.ts` (single managed-teams shape), `api/entities.ts` wrappers, jest-expo smoke tests.

## Global Constraints

- All grouping is presentation-only: `team_id` remains the key for every action; `setSelectedTeamId`/`router.push` leaf behaviors unchanged.
- Teams without `program_id` MUST remain visible and actionable ("Other teams" section / ungrouped rows).
- The managed-teams shape lives in ONE place: `hooks/useManagedTeamsQuery.ts` (its doc comment mandates this). Do not project fields elsewhere.
- Program display label: `name` override if set, else `"{GenderLabel} {SportLabel}"`, gender label omitted when `coed` (i.e. "Basketball", "Girls Basketball"). One helper, used everywhere.
- No hardcoded dark text colors; use theme constants (repo rule). Screens keep their existing style systems.
- Client typecheck `npx tsc --noEmit` = 0 errors; touched smoke suites green; never `git add -A` (dirty tree has unrelated user files).
- Server is NOT modified in this phase. (If a server gap blocks a task, report BLOCKED — do not patch the server here.)

---

### Task 1: Program constants + label helper (`constants/programs.ts`)

**Files:**

- Create: `constants/programs.ts`
- Create: `__tests__/program-labels.test.ts`

**Interfaces (produced):**

```ts
export type TeamLevel = 'varsity' | 'jv' | 'freshman' | 'middle_school' | 'unified' | 'other';
export type ProgramGender = 'boys' | 'girls' | 'coed';
export const LEVEL_OPTIONS: { value: TeamLevel; label: string }[]; // Varsity, JV, Freshman, Middle School, Unified, Other
export const LEVEL_LABELS: Record<TeamLevel, string>;
export const GENDER_OPTIONS: { value: ProgramGender; label: string }[]; // Boys, Girls, Coed
export type ProgramSummary = {
  id: string;
  sport: string;
  gender: ProgramGender;
  name?: string | null;
};
export function formatProgramLabel(p: ProgramSummary): string; // name ?? "Girls Basketball" / "Basketball" (coed omits gender)
export function formatLevelLabel(level: string | null | undefined): string | null; // LEVEL_LABELS lookup, null-safe
```

`formatProgramLabel` resolves the sport label via `SPORT_OPTIONS` from `constants/sports.ts` (fall back to the raw slug if unknown).

- [ ] **Step 1: failing test** — `__tests__/program-labels.test.ts`:

```ts
import { formatProgramLabel, formatLevelLabel, LEVEL_OPTIONS } from '@/constants/programs';

describe('program labels', () => {
  it('formats gendered and coed programs', () => {
    expect(formatProgramLabel({ id: '1', sport: 'basketball', gender: 'girls' })).toBe(
      'Girls Basketball'
    );
    expect(formatProgramLabel({ id: '2', sport: 'basketball', gender: 'coed' })).toBe('Basketball');
    expect(formatProgramLabel({ id: '3', sport: 'track_field', gender: 'boys' })).toBe(
      'Boys Track & Field'
    );
    expect(
      formatProgramLabel({ id: '4', sport: 'basketball', gender: 'girls', name: 'Lady Knights' })
    ).toBe('Lady Knights');
    expect(formatProgramLabel({ id: '5', sport: 'unknown_slug', gender: 'coed' })).toBe(
      'unknown_slug'
    );
  });
  it('formats levels null-safely', () => {
    expect(formatLevelLabel('jv')).toBe('JV');
    expect(formatLevelLabel('middle_school')).toBe('Middle School');
    expect(formatLevelLabel(null)).toBe(null);
    expect(formatLevelLabel('weird')).toBe(null);
  });
  it('exposes all six levels in display order', () => {
    expect(LEVEL_OPTIONS.map(l => l.value)).toEqual([
      'varsity',
      'jv',
      'freshman',
      'middle_school',
      'unified',
      'other',
    ]);
  });
});
```

- [ ] **Step 2:** run `npx jest __tests__/program-labels.test.ts --no-coverage` → FAIL (module missing)
- [ ] **Step 3:** implement `constants/programs.ts` exactly per the interface block (labels: Varsity/JV/Freshman/Middle School/Unified/Other; Boys/Girls/Coed).
- [ ] **Step 4:** test PASSES; `npx tsc --noEmit` clean.
- [ ] **Step 5:** commit `feat(programs): client level/gender constants + program label helper` (only the two files).

---

### Task 2: API wrappers + programs query hook + managed-teams shape

**Files:**

- Modify: `api/entities.ts` (Organization block)
- Create: `hooks/useOrgProgramsQuery.ts`
- Modify: `hooks/useManagedTeamsQuery.ts` (ManagedTeam type + projection)
- Modify: `api/schemas/team.ts` (declare optional `level`/`program_id` on teamSchema — passthrough already carries them; make them explicit)

**Interfaces (produced):**

```ts
// api/entities.ts → Organization
programs: (organizationId: string) => httpGet(`/organizations/${encodeURIComponent(organizationId)}/programs`),
createProgram: (organizationId: string, data: { sport: string; gender: 'boys' | 'girls' | 'coed'; name?: string }) =>
  httpPost(`/organizations/${encodeURIComponent(organizationId)}/programs`, data),

// hooks/useOrgProgramsQuery.ts
export type OrgProgram = ProgramSummary & { teams: { id: string; name: string; level: string | null }[] };
export function useOrgProgramsQuery(opts: { organizationId?: string | null; enabled?: boolean }): UseQueryResult<OrgProgram[]>;
// queryKey: ['org-programs', organizationId]; select: (res) => res.programs ?? []

// hooks/useManagedTeamsQuery.ts → ManagedTeam gains:
level: string | null;
program_id: string | null;
```

- [ ] **Step 1:** extend `ManagedTeam` type + the `list.map` projection in `hooks/useManagedTeamsQuery.ts` with `level: t.level ?? null, program_id: t.program_id ?? null` (server baseline already emits both). Add the two optional fields to `teamSchema` in `api/schemas/team.ts` (`level: z.string().nullable().optional(), program_id: z.string().nullable().optional()`).
- [ ] **Step 2:** add the two `Organization` wrappers (exact code above) next to the existing org methods; create `hooks/useOrgProgramsQuery.ts` modeled on `useManagedTeamsQuery`'s react-query usage (single `lib/queryClient`, gate on `enabled && !!organizationId`).
- [ ] **Step 3:** `npx tsc --noEmit` clean; run existing suites touching the shape: `npx jest app/__tests__/manage-teams.smoke.test.tsx app/__tests__/my-team.smoke.test.tsx --no-coverage` → green (fields are additive).
- [ ] **Step 4:** commit `feat(programs): program API wrappers + org-programs hook; managed teams carry level/program_id`.

---

### Task 3: manage-teams grouped by program

**Files:**

- Modify: `app/(tabs)/manage-teams.tsx` (the flat `activeTeams.map` at ~:395-417)
- Modify: `app/__tests__/manage-teams.smoke.test.tsx`

**Behavior:** Group `activeTeams` by `program_id`. For program groups, render a section header (existing `SectionHeader` component already imported) titled with `formatProgramLabel` (program metadata from `useOrgProgramsQuery({ organizationId: organization?.id })`; if program metadata isn't loaded/found, fall back to the first team's `sport` value as the header). Inside each section render the existing `<TeamCard>` unchanged, but append the level to the card subtitle via `formatLevelLabel(team.level)` where the card already shows sport/season. Teams with `program_id: null` render under a final "Other teams" section (header only when at least one grouped section exists — a fully ungrouped org keeps today's flat look, no headers).

Pure grouping function (put in the component file, exported for tests):

```ts
export function groupTeamsByProgram<T extends { program_id: string | null }>(
  teams: T[]
): { programId: string | null; teams: T[] }[] {
  const byProgram = new Map<string | null, T[]>();
  for (const t of teams) {
    const key = t.program_id ?? null;
    const list = byProgram.get(key) ?? [];
    list.push(t);
    byProgram.set(key, list);
  }
  const groups = [...byProgram.entries()].map(([programId, ts]) => ({ programId, teams: ts }));
  // programs first (stable by first appearance), ungrouped last
  return [...groups.filter(g => g.programId !== null), ...groups.filter(g => g.programId === null)];
}
```

- [ ] **Step 1: failing test** — extend the smoke test fixture: two teams sharing `program_id: 'prog1'` (levels varsity/jv) + one with `program_id: null`; mock `Organization.programs` → `{ programs: [{ id: 'prog1', sport: 'basketball', gender: 'girls', name: null, teams: [] }] }`. Assert `findByText('Girls Basketball')` (section header), both team names, and `findByText('Other teams')`. Also unit-test `groupTeamsByProgram` ordering (grouped first, null last) in the same file.
- [ ] **Step 2:** run → FAIL. Implement. Step 3: PASS + `npx tsc --noEmit` clean.
- [ ] **Step 4:** commit `feat(programs): manage-teams sections teams by sport program`.

---

### Task 4: my-team picker grouped program → level

**Files:**

- Modify: `app/(tabs)/my-team.tsx` (picker modal ~:924-982)
- Modify: `app/__tests__/my-team.smoke.test.tsx`

**Behavior:** Reuse `groupTeamsByProgram` (import from manage-teams — if that import creates a cycle or feels wrong, move the helper to `constants/programs.ts` in THIS task and update Task 3's import; note it in your report). The modal renders: program header row (non-pressable, `formatProgramLabel` via `useOrgProgramsQuery` keyed on the org id already available from the teams' `organization`), then each team row exactly as today but with `formatLevelLabel(team.level)` appended after the name when present (e.g. "Girls Soccer — JV" only if the raw team name doesn't already say it: keep it simple — always show the level chip text after the name; names that repeat it are legacy cosmetics). Ungrouped teams render as today with no header. `resolveNextSelectedTeamId` and `setSelectedTeamId` untouched.

- [ ] **Step 1: failing test** — extend my-team smoke: fixture teams gain `program_id`/`level`; open the picker modal in the test (fire press on the team-selector trigger; check the existing test's render pattern for how to press) and assert the program header text renders. If opening the modal proves flaky in jest-expo, instead export and unit-test the modal's row-building logic and assert the level text on the selected-team header — note which route you took.
- [ ] **Step 2:** implement → tests PASS, tsc clean.
- [ ] **Step 3:** commit `feat(programs): my-team picker groups by program with level labels`.

---

### Task 5: create-team program + level pickers

**Files:**

- Modify: `app/(tabs)/create-team.tsx`
- Create: `__tests__/create-team-program-payload.test.ts`

**Behavior:** After the School/Organization section (org picker sets `selectedOrgId`, ~:1480-1540):

- New "Program" section, visible only when `selectedOrgId` is set AND `clubType === 'sport'`: chips of existing programs from `useOrgProgramsQuery({ organizationId: selectedOrgId })` labeled with `formatProgramLabel`, plus a "New program" chip. Selecting an existing program sets `selectedProgramId` and **prefills/locks the sport selector** to the program's sport label (coaches can still unselect the program to free the sport picker). "New program" reveals a gender chip row (`GENDER_OPTIONS`) — sport comes from the existing sport picker; on submit, create the program first via `Organization.createProgram(selectedOrgId, { sport: slugForSelectedSportLabel, gender })`, then use its id. Map sport label → slug via `SPORT_OPTIONS`; when the user chose 'Other'/custom sport, program creation is skipped (no canonical slug) — team is created ungrouped, exactly like today.
- New "Level" chip row (`LEVEL_OPTIONS`), visible when a program is selected or being created; optional — no selection sends no level.
- Payload: extract a pure helper and test it:

```ts
export function buildProgramFields(opts: {
  selectedProgramId: string | null;
  createdProgramId: string | null;
  level: TeamLevel | null;
}): { program_id?: string; level?: TeamLevel } {
  const program_id = opts.selectedProgramId ?? opts.createdProgramId ?? undefined;
  return { ...(program_id ? { program_id } : {}), ...(opts.level ? { level: opts.level } : {}) };
}
```

merged into the existing `teamData` payload (~:552-568). On `PROGRAM_EXISTS` (409) from createProgram, recover by refetching programs and selecting the matching (sport,gender) program — do not fail the team creation.

- [ ] **Step 1: failing test** — `__tests__/create-team-program-payload.test.ts` unit-tests `buildProgramFields` (4 cases: both null → {}, selected id, created id, level only) and the label→slug mapping helper if you extract one.
- [ ] **Step 2:** implement UI + submit flow; the section follows the screen's existing chip/selector style patterns (see the sport picker ~:1186 for the chip idiom).
- [ ] **Step 3:** tests PASS; `npx tsc --noEmit` clean; run `npx jest app/__tests__ --no-coverage` → no regressions.
- [ ] **Step 4:** commit `feat(programs): create-team picks or creates a program + level`.

---

### Task 6: season-stats level labels, quick-actions copy, gates

**Files:**

- Modify: `app/season-stats.tsx` (chip selector ~:346-377)
- Modify: `app/(tabs)/discover/mobile-community.tsx` (Manage Teams card desc ~:1878-1908)
- Modify: `.superpowers`-tracked docs if plan drift occurred (report only)

**Behavior:**

- season-stats chips: append ` · ${formatLevelLabel(team.level)}` to the chip label when the level is present AND the raw `TeamAPI.managed()` objects carry `level` (they do — server baseline). No regroup of the horizontal rail in this phase (deliberate YAGNI cut; full regroup arrives with Phase 3's navigation work).
- Discover "Manage Teams" card: description copy becomes "Your programs & teams" (title unchanged, analytics tag unchanged).
- Gates: `npx tsc --noEmit`; `npx jest app/__tests__ __tests__ --no-coverage` (all client suites green or pre-existing-failure-triaged); `npm run test:regressions`.

- [ ] **Step 1:** implement both edits; Step 2: gates green; Step 3: commit `feat(programs): level labels on season-stats chips + discover copy`.

---

## Out of scope (deliberate)

Team-hub/team-admin `managed[0]` default-team behavior (ambiguous in a program world — Phase 3 decides); full season-stats regroup; org page public grouping (Phase 3); any server change; program logo/counts enrichment of the GET endpoint (revisit if Task 3's fallback headers prove insufficient).
