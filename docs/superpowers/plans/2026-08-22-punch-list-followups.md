# Punch-List Follow-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining, unblocked items from the 2026-08-22 owner punch list ("This app is slow as it's ever been.pdf") that don't require a product-policy decision first: decode the HTML-entity corruption already fixed at the source, widen map/post visibility to match the existing 7-day grace window, and add a pinned manual-opponent-entry option to Add Game.

**Architecture:** Four independent, single-file-or-pair changes plus one read-only diagnostic pass. No shared state between tasks — each is separately reviewable and separately revertable.

**Tech Stack:** Express + Prisma (server tasks), React Native/Expo Router (client task), Jest (`node --experimental-vm-modules`, run server tests via `cd server && npm test`, client tests via `npx jest <path>` from repo root).

**Spec:** No standalone spec doc — the source is the owner's PDF punch list reviewed in this conversation (2026-08-22) plus the investigation findings already gathered (Sentry issue `7686968198`, Railway log window `2026-08-22T20:40-20:43Z`, and 5 parallel investigation-agent reports covering permissions, calendar scope, map, add-game, and feed/DM).

## Global Constraints

- Never run `eas build`/`eas submit` (CLAUDE.md Hard Rules).
- `main` auto-deploys on push (Railway) — these changes land on `fix/username-display-masking`, not `main`, until the user says otherwise.
- All `findMany` calls must carry a `take` limit (`unbounded-queries.test.ts` gate).
- Run `npx tsc --noEmit` (client) and `npx tsc --noEmit --project server/tsconfig.json` (server) after every task — both must be 0 errors before moving on.
- Run `npm run format:check` before considering a task done; fix with `npx prettier --write <file>`.
- Task 1's `--apply` mode writes to real data — do NOT run `--apply` against the production database without the user explicitly confirming the dry-run output first.
- Do not touch the map "middle button" UI, the org-invite-creation role policy, or sports-data ingestion breadth — those are explicitly blocked on a product decision (see "Not Planned" at the end).

---

### Task 1: Backfill HTML-entity-corrupted text fields

The `stripHtml()` fix (already merged in this session, `server/src/lib/sanitizeHtml.ts`) stops NEW corruption but does nothing for rows already saved with double-escaped entities (e.g. `Swimming &amp; Diving`). This task adds a dry-run-by-default script that finds and repairs them, following the existing convention in `server/scripts/backfill-post-country-code.ts`.

**Files:**

- Create: `server/scripts/backfill-html-entity-decode.ts`
- Create: `server/scripts/__tests__/backfill-html-entity-decode.test.ts` (tests the pure detector/decoder logic only — no DB)
- Test: `server/scripts/__tests__/backfill-html-entity-decode.test.ts`

**Interfaces:**

- Consumes: `stripHtml` from `../src/lib/sanitizeHtml.js` (already fixed — decodes `&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`).
- Produces: `needsEntityDecode(value: string | null): boolean` and `decodeCorruptedValue(value: string): string` — pure functions, exported for the test file, also used internally by `main()`.

- [ ] **Step 1: Write the failing test for the pure detector/decoder**

```typescript
// server/scripts/__tests__/backfill-html-entity-decode.test.ts
import { describe, expect, it } from '@jest/globals';
import { needsEntityDecode, decodeCorruptedValue } from '../backfill-html-entity-decode.js';

describe('needsEntityDecode', () => {
  it('flags values containing a re-escaped entity', () => {
    expect(needsEntityDecode('Swimming &amp; Diving')).toBe(true);
    expect(needsEntityDecode('Coach&#39;s picks')).toBe(true);
    expect(needsEntityDecode('Q&amp;A Night')).toBe(true);
  });

  it('does not flag clean text', () => {
    expect(needsEntityDecode('Swimming & Diving')).toBe(false);
    expect(needsEntityDecode('Varsity Football')).toBe(false);
    expect(needsEntityDecode(null)).toBe(false);
    expect(needsEntityDecode('')).toBe(false);
  });
});

describe('decodeCorruptedValue', () => {
  it('decodes the corrupted value back to plain text', () => {
    expect(decodeCorruptedValue('Swimming &amp; Diving')).toBe('Swimming & Diving');
    expect(decodeCorruptedValue('Coach&#39;s picks')).toBe("Coach's picks");
  });

  it('is idempotent — re-running on already-clean text is a no-op', () => {
    const clean = decodeCorruptedValue('Swimming &amp; Diving');
    expect(decodeCorruptedValue(clean)).toBe(clean);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="backfill-html-entity-decode" --no-coverage`
Expected: FAIL with "Cannot find module '../backfill-html-entity-decode.js'"

- [ ] **Step 3: Write the script**

```typescript
// server/scripts/backfill-html-entity-decode.ts
/**
 * One-time backfill: decode HTML-entity-corrupted text fields written before
 * the stripHtml() fix (sanitize-html re-escaped plain "&" into "&amp;" on
 * every save, so e.g. "Swimming & Diving" was stored as "Swimming &amp;
 * Diving" — and, on a second save, "&amp;amp; Diving"). The write-side fix
 * (server/src/lib/sanitizeHtml.ts) stops new corruption; this repairs rows
 * already saved before it landed. Scans every model/column that ever routed
 * through stripHtml() per `grep -rn "stripHtml(" server/src/routes`.
 *
 * Dry-run by default. Pass --apply to write. Safe to re-run (idempotent —
 * decodeCorruptedValue on already-clean text is a no-op, and the WHERE
 * clause only matches rows that still contain a re-escaped entity).
 *
 *   npx tsx scripts/backfill-html-entity-decode.ts            # dry run
 *   npx tsx scripts/backfill-html-entity-decode.ts --apply    # write
 *
 * NOT wired into start.sh — run manually against a target DB.
 */
import { prisma } from '../src/lib/prisma.js';
import { stripHtml } from '../src/lib/sanitizeHtml.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 500;
const ENTITY_PATTERN = /&(amp|lt|gt|quot|#39);/;

export function needsEntityDecode(value: string | null | undefined): boolean {
  if (!value) return false;
  return ENTITY_PATTERN.test(value);
}

export function decodeCorruptedValue(value: string): string {
  return stripHtml(value);
}

type ColumnTarget = {
  model: 'team' | 'post' | 'pollOption' | 'game' | 'event' | 'ad' | 'organization';
  column: string;
};

// One entry per stripHtml() call site found via
// `grep -rn "stripHtml(" server/src/routes --include="*.ts"`.
const TARGETS: ColumnTarget[] = [
  { model: 'team', column: 'name' },
  { model: 'team', column: 'description' },
  { model: 'team', column: 'sport' },
  { model: 'team', column: 'city' },
  { model: 'team', column: 'state' },
  { model: 'team', column: 'league' },
  { model: 'team', column: 'venue_address' },
  { model: 'post', column: 'title' },
  { model: 'post', column: 'content' },
  { model: 'pollOption', column: 'text' },
  { model: 'game', column: 'title' },
  { model: 'game', column: 'location' },
  { model: 'game', column: 'description' },
  { model: 'game', column: 'watch_location' },
  { model: 'game', column: 'destination' },
  { model: 'game', column: 'away_team_name' },
  { model: 'event', column: 'title' },
  { model: 'event', column: 'description' },
  { model: 'ad', column: 'contact_name' },
  { model: 'ad', column: 'business_name' },
  { model: 'ad', column: 'description' },
  { model: 'organization', column: 'description' },
];

async function backfillColumn(target: ColumnTarget): Promise<{ scanned: number; fixed: number }> {
  const { model, column } = target;
  let scanned = 0;
  let fixed = 0;
  let cursor: string | null = null;

  for (;;) {
    const delegate = (prisma as any)[model];
    const rows: Array<{ id: string; [key: string]: any }> = await delegate.findMany({
      where: { [column]: { contains: '&' } },
      select: { id: true, [column]: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    for (const row of rows) {
      const current: string | null = row[column];
      if (!needsEntityDecode(current)) continue;
      const decoded = decodeCorruptedValue(current!);
      if (decoded === current) continue;
      fixed += 1;
      if (APPLY) {
        await delegate.update({ where: { id: row.id }, data: { [column]: decoded } });
      } else {
        console.log(`  [${model}.${column}] ${row.id}: "${current}" -> "${decoded}"`);
      }
    }
  }

  return { scanned, fixed };
}

async function main(): Promise<void> {
  const summary: Record<string, { scanned: number; fixed: number }> = {};
  for (const target of TARGETS) {
    const key = `${target.model}.${target.column}`;
    summary[key] = await backfillColumn(target);
  }

  console.log(`\n${APPLY ? 'Backfill complete' : 'DRY RUN (no writes)'}:`);
  let totalFixed = 0;
  for (const [key, { scanned, fixed }] of Object.entries(summary)) {
    if (scanned === 0 && fixed === 0) continue;
    console.log(`  ${key}: scanned ${scanned}, ${APPLY ? 'fixed' : 'would fix'} ${fixed}`);
    totalFixed += fixed;
  }
  if (!APPLY && totalFixed > 0) {
    console.log('\nRe-run with --apply to write these changes.');
  }
}

main()
  .catch(err => {
    console.error('[backfill-html-entity-decode] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="backfill-html-entity-decode" --no-coverage`
Expected: PASS (6 tests)

- [ ] **Step 5: Dry-run against the LOCAL dev database and eyeball the output**

Run: `cd server && npx tsx scripts/backfill-html-entity-decode.ts`
Expected: prints per-column scanned/would-fix counts (likely 0 locally unless local data has drifted the same way prod has). This step is diagnostic only — do not add `--apply` here.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit --project server/tsconfig.json
git add server/scripts/backfill-html-entity-decode.ts server/scripts/__tests__/backfill-html-entity-decode.test.ts
git commit -m "chore(data): add dry-run backfill for HTML-entity-corrupted text fields"
```

Do NOT run `--apply` against production from this task. That is a separate, explicit step the user approves after reviewing the dry-run output against the real (Postgres-TnGR) database.

---

### Task 2: Widen map/post visibility to match the existing 7-day post-grace window

Server-confirmed drift: `server/src/lib/geofencing.ts:35` already allows posting to a game up to 7 days after it happened (`REGULAR_POST_GRACE_WINDOW_MS`), but the map hides any game older than "now" — so a game is legally postable but has no pin to tap to find it. This task widens the map's backward window to match, both server-side (`games.ts` `map_view` clause) and client-side (`shouldShowEventOnMap`, which independently re-filters after fetch).

**Files:**

- Modify: `server/src/routes/games.ts:1264-1288` (the `isMapView` block)
- Modify: `utils/mapEventFilters.ts`
- Modify: `app/game-map.tsx:118,141` (pass the grace window through)
- Test: `server/src/__tests__/games-list-visibility.test.ts` (add a map_view describe block)
- Test: `utils/__tests__/mapEventFilters.test.ts` (new file — no test currently exists for this util)

**Interfaces:**

- Consumes: `REGULAR_POST_GRACE_WINDOW_MS` from `server/src/lib/geofencing.ts` (already exported, `= 7 * 24 * 60 * 60 * 1000`).
- Produces: `shouldShowEventOnMap(dateValue, now?, graceWindowMs?)` — new optional third parameter, default `7 * 24 * 60 * 60 * 1000` — so existing two-arg call sites keep compiling.

- [ ] **Step 1: Write the failing client-side test**

```typescript
// utils/__tests__/mapEventFilters.test.ts
import { describe, expect, it } from '@jest/globals';
import { shouldShowEventOnMap } from '../mapEventFilters';

describe('shouldShowEventOnMap', () => {
  const now = new Date('2026-08-22T12:00:00Z');

  it('shows a game happening now or in the future', () => {
    expect(shouldShowEventOnMap('2026-08-22T18:00:00Z', now)).toBe(true);
    expect(shouldShowEventOnMap('2026-08-25T12:00:00Z', now)).toBe(true);
  });

  it('shows a game up to 7 days in the past (post-grace window)', () => {
    expect(shouldShowEventOnMap('2026-08-16T12:00:01Z', now)).toBe(true); // 6d23h59m59s ago
  });

  it('hides a game older than 7 days', () => {
    expect(shouldShowEventOnMap('2026-08-15T11:59:59Z', now)).toBe(false); // >7d ago
  });

  it('respects a custom grace window', () => {
    expect(shouldShowEventOnMap('2026-08-20T12:00:00Z', now, 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('still defaults to true for a missing/invalid date (unchanged behavior)', () => {
    expect(shouldShowEventOnMap(null, now)).toBe(true);
    expect(shouldShowEventOnMap('not-a-date', now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest utils/__tests__/mapEventFilters.test.ts --no-coverage`
Expected: FAIL — "hides a game older than 7 days" and "shows a game up to 7 days in the past" fail (current code only checks `parsed >= now`).

- [ ] **Step 3: Update `shouldShowEventOnMap`**

```typescript
// utils/mapEventFilters.ts
const DEFAULT_MAP_GRACE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowEventOnMap(
  dateValue: string | null | undefined,
  now = new Date(),
  graceWindowMs = DEFAULT_MAP_GRACE_WINDOW_MS
): boolean {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() >= now.getTime() - graceWindowMs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest utils/__tests__/mapEventFilters.test.ts --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing server-side test**

Add to `server/src/__tests__/games-list-visibility.test.ts`, inside a new `describe('GET /games?map_view=true (this-week + 7-day grace)')` block (mirror the existing `following=true` block's mock setup — `mockGameFindMany`, `lastFindManyWhere` are already defined at file scope):

```typescript
describe('GET /games?map_view=true (this-week + 7-day grace)', () => {
  beforeEach(() => {
    mockGameFindMany.mockClear();
  });

  it('includes a backward grace window matching the 7-day post-grace period', async () => {
    await request(app).get('/games?map_view=true').expect(200);

    const where = lastFindManyWhere();
    const clause = where.AND.find((c: any) => c.OR?.[0]?.date);
    const regularGameBranch = clause.OR[0];
    const graceStart = regularGameBranch.date.gte as Date;
    const now = Date.now();
    // Was `now` (0 lookback) before the fix — assert it's ~7 days back, not ~0.
    const lookbackMs = now - graceStart.getTime();
    expect(lookbackMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(lookbackMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="games-list-visibility" --no-coverage`
Expected: FAIL — current `regularGameBranch.date.gte` is `now` (lookback ~0ms), not ~7 days.

- [ ] **Step 7: Update the server `map_view` clause**

```typescript
// server/src/routes/games.ts — replace the isMapView block (~line 1264)
const isMapView = req.query.map_view === 'true' || req.query.map_view === '1';
if (isMapView) {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const liveLookback = new Date(now.getTime() - 18 * 60 * 60 * 1000);
  // Regular games stay on the map through the SAME 7-day window the post-grace
  // check (REGULAR_POST_GRACE_WINDOW_MS, lib/geofencing.ts) uses to allow
  // posting to a just-finished game — previously a game up to 7 days
  // postable had no pin to tap to find it. Marquee/teamless events (festivals)
  // keep their existing shorter 18h live-lookback (they aren't gated by the
  // post-grace window the same way regular games are).
  const postGraceLookback = new Date(now.getTime() - REGULAR_POST_GRACE_WINDOW_MS);
  if (!whereClause.AND) whereClause.AND = [];
  whereClause.AND.push({
    OR: [
      { date: { gte: postGraceLookback, lte: weekFromNow } },
      {
        home_team_id: null,
        away_team_id: null,
        date: { gte: liveLookback, lte: weekFromNow },
      },
    ],
  });
}
```

Add the import at the top of `server/src/routes/games.ts` (alongside the existing `getManagedTeamIds` import added earlier this session):

```typescript
import { REGULAR_POST_GRACE_WINDOW_MS } from '../lib/geofencing.js';
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="games-list-visibility" --no-coverage`
Expected: PASS (all existing + 1 new test)

- [ ] **Step 9: Wire the client's grace window through explicitly**

```typescript
// app/game-map.tsx — both filter call sites (lines 118 and 141)
// no code change needed IF the default (7 days) is correct for both games and
// events — shouldShowEventOnMap(g.date) and shouldShowEventOnMap(e.date)
// already pick up the new default. Confirm by reading the two call sites;
// if a caller needs a different window, pass it explicitly as the 3rd arg.
```

This step is a verification read, not an edit — `shouldShowEventOnMap(g.date)` and `shouldShowEventOnMap(e.date)` (2-arg calls) automatically pick up the new default third parameter.

- [ ] **Step 10: Typecheck both sides and run the full affected suites**

```bash
npx tsc --noEmit
npx tsc --noEmit --project server/tsconfig.json
npx jest utils/__tests__/mapEventFilters.test.ts --no-coverage
cd server && npm test -- --testPathPattern="games-list-visibility" --no-coverage
```

Expected: 0 errors, all tests pass.

- [ ] **Step 11: Format and commit**

```bash
npx prettier --write utils/mapEventFilters.ts utils/__tests__/mapEventFilters.test.ts app/game-map.tsx server/src/routes/games.ts server/src/__tests__/games-list-visibility.test.ts
git add utils/mapEventFilters.ts utils/__tests__/mapEventFilters.test.ts server/src/routes/games.ts server/src/__tests__/games-list-visibility.test.ts
git commit -m "fix(map): widen past-game visibility to match the 7-day post-grace window"
```

---

### Task 3: Pinned "Enter opponent manually" option in Add Game

Today, typing a name that matches no VarsityHub team surfaces a `Use "<text>" as opponent` row at the BOTTOM of the results list (`components/QuickAddGameModal.tsx:2040-2080`) — functional, but not discoverable, and not what the owner asked for ("right under the search bar first option is enter name (manually)"). This task adds an always-visible pinned row directly under the search bar that switches the picker into a dedicated manual-entry mode.

**Files:**

- Modify: `components/QuickAddGameModal.tsx`
- Test: `components/__tests__/QuickAddGameModal.manualOpponent.test.tsx` (new file)

**Interfaces:**

- Consumes: existing component state `opponentSearchText`, `setOpponent`, `setOpponentTeamId`, `setErrors`, `setOpponentSearchText`, `setOpponentSearchResults`, `setShowOpponentPicker` (all already defined in the component).
- Produces: new local state `manualOpponentMode: boolean` (component-internal, not exported).

- [ ] **Step 1: Read the current opponent-picker render block to confirm anchor points**

Already confirmed this session — the search bar `View` closes at `components/QuickAddGameModal.tsx:1984`, and the `ScrollView` of results starts at line 1986. The pinned row goes between them, outside the `ScrollView` (so it never scrolls away).

- [ ] **Step 2: Write the failing component test**

```tsx
// components/__tests__/QuickAddGameModal.manualOpponent.test.tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import QuickAddGameModal from '../QuickAddGameModal';

// Match this project's existing mock pattern for API/auth context used by
// other QuickAddGameModal tests — see components/__tests__/QuickAddGameModal*.test.tsx
// for the exact mock shape already in this repo (Team.list, AuthProvider, etc.).

describe('QuickAddGameModal — manual opponent entry', () => {
  it('shows a pinned "Enter opponent manually" row under the search bar before typing anything', async () => {
    render(<QuickAddGameModal visible onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.press(screen.getByText(/select opponent/i));

    expect(await screen.findByText(/enter opponent manually/i)).toBeTruthy();
  });

  it('switches to a manual name field when the pinned row is tapped, and confirming it sets the opponent with no team id', async () => {
    render(<QuickAddGameModal visible onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.press(screen.getByText(/select opponent/i));
    fireEvent.press(await screen.findByText(/enter opponent manually/i));

    const manualInput = await screen.findByPlaceholderText(/opponent name/i);
    fireEvent.changeText(manualInput, 'Central High Eagles');
    fireEvent.press(screen.getByText(/^add$/i));

    expect(await screen.findByDisplayValue(/central high eagles/i)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest components/__tests__/QuickAddGameModal.manualOpponent.test.tsx --no-coverage`
Expected: FAIL — "enter opponent manually" text not found (row doesn't exist yet).

- [ ] **Step 4: Add `manualOpponentMode` state**

```typescript
// components/QuickAddGameModal.tsx — alongside the existing opponentSearchText state (~line 282)
const [manualOpponentMode, setManualOpponentMode] = useState(false);
const [manualOpponentName, setManualOpponentName] = useState('');
```

- [ ] **Step 5: Reset the mode when the picker opens/closes**

Find the existing handler(s) that set `setShowOpponentPicker(true)` / `setShowOpponentPicker(false)` and add the reset alongside them:

```typescript
// wherever showOpponentPicker is set to true (opening the picker) — add:
setManualOpponentMode(false);
setManualOpponentName('');
```

- [ ] **Step 6: Insert the pinned row and manual-entry view**

```tsx
{
  /* components/QuickAddGameModal.tsx — insert immediately after the search-bar
    View closes (after line 1984) and BEFORE the <ScrollView> at line 1986 */
}
{
  !manualOpponentMode && (
    <Pressable
      style={[styles.pickerItem, { borderBottomColor: Colors[colorScheme].border }]}
      onPress={() => setManualOpponentMode(true)}
      accessibilityRole="button"
      accessibilityLabel="Enter opponent manually"
    >
      <View style={styles.pickerItemContent}>
        <View style={styles.teamLogoContainer}>
          <Ionicons name="create-outline" size={24} color={Colors[colorScheme].tint} />
        </View>
        <Text
          style={[styles.pickerItemText, { color: Colors[colorScheme].tint, fontWeight: '600' }]}
        >
          Enter opponent manually
        </Text>
      </View>
    </Pressable>
  );
}

{
  manualOpponentMode ? (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={[styles.pickerItemText, { color: Colors[colorScheme].mutedText }]}>
        Use this when the other team isn't on VarsityHub yet.
      </Text>
      <TextInput
        style={[
          styles.searchInput,
          {
            color: Colors[colorScheme].text,
            borderColor: Colors[colorScheme].border,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
          },
        ]}
        placeholder="Opponent name"
        placeholderTextColor={Colors[colorScheme].mutedText}
        value={manualOpponentName}
        onChangeText={setManualOpponentName}
        autoCapitalize="words"
        autoFocus
      />
      <Pressable
        style={[
          styles.pickerItem,
          { justifyContent: 'center', backgroundColor: Colors[colorScheme].tint, borderRadius: 8 },
        ]}
        disabled={!manualOpponentName.trim()}
        onPress={() => {
          const name = manualOpponentName.trim();
          if (!name) return;
          setOpponent(name);
          setOpponentTeamId('');
          if (errors.opponent) setErrors(prev => ({ ...prev, opponent: '' }));
          setManualOpponentMode(false);
          setManualOpponentName('');
          setOpponentSearchText('');
          setOpponentSearchResults([]);
          setShowOpponentPicker(false);
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
      </Pressable>
      <Pressable onPress={() => setManualOpponentMode(false)}>
        <Text style={{ color: Colors[colorScheme].tint }}>Back to search</Text>
      </Pressable>
    </View>
  ) : (
    <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
      {/* existing search-results ScrollView content, unchanged (lines 1986-2081) */}
    </ScrollView>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest components/__tests__/QuickAddGameModal.manualOpponent.test.tsx --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 8: Run the existing QuickAddGameModal test suite to confirm no regression**

Run: `npx jest components/__tests__/QuickAddGameModal --no-coverage`
Expected: all pre-existing tests still pass — the bottom "Use text as opponent" row (line 2040) is untouched, so typed free-text entry still works exactly as before; this task only adds a second, more-discoverable entry point.

- [ ] **Step 9: Typecheck, format, and commit**

```bash
npx tsc --noEmit
npx prettier --write components/QuickAddGameModal.tsx components/__tests__/QuickAddGameModal.manualOpponent.test.tsx
git add components/QuickAddGameModal.tsx components/__tests__/QuickAddGameModal.manualOpponent.test.tsx
git commit -m "feat(add-game): pin a manual opponent-entry option under the search bar"
```

---

### Task 4: Railway/Postgres per-query latency investigation (diagnostic — no code changes)

Railway logs (`2026-08-22T20:40-20:43Z` window, captured this session) show nearly every Prisma query — regardless of table or complexity — taking a suspiciously uniform ~143-146ms, with several requests breaching 500ms-2s. A flat per-query floor across unrelated tables smells like network round-trip latency between the Railway `api` service and its Postgres instance, not slow queries — which would explain "app is slow as it's ever been" better than any single functional bug on this punch list. This task is read-only: confirm or rule out the region/pooling hypothesis before anyone touches infra config.

**Files:** none modified — this task produces a written finding, not a code change.

- [ ] **Step 1: Confirm the Railway service and Postgres instance regions**

Ask the user to run (requires interactive Railway dashboard access — the CLI's `railway variables` was blocked by the auto-mode classifier this session as a secrets-read):

Check Railway dashboard → project `capable-trust` → service `api` → Settings → note the deploy region. Then → the Postgres-TnGR database service → Settings → note ITS region. If they differ, that is almost certainly the ~140ms floor (cross-region round trips commonly cost 60-150ms+ depending on the pair).

- [ ] **Step 2: Check Prisma connection pool sizing**

Run (from a machine with Railway CLI access to the `api` service, or ask the user):

```bash
railway variables --service api --kv | grep -i "DATABASE_URL\|connection_limit\|pool_timeout"
```

Look for a `connection_limit` query param on `DATABASE_URL` (Prisma default is `num_cpus * 2 + 1`, which is often too low for a serverless-style Railway deploy and causes queueing that LOOKS like per-query latency but is actually wait-for-a-free-connection time).

- [ ] **Step 3: Get a clean baseline read of round-trip time to the DB**

Ask the user to run this from a Railway shell attached to the `api` service (`railway shell --service api`), which executes inside the same region/network as the app:

```bash
railway run --service api -- node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await c.query('SELECT 1');
    times.push(Date.now() - start);
  }
  console.log('round trips (ms):', times);
  await c.end();
})();
"
```

If these round trips are also ~140ms for a trivial `SELECT 1`, that confirms network/region latency (not query complexity) as the root cause — the fix is moving the Postgres instance and the `api` service into the same Railway region, which is an infra change with its own migration/downtime plan and is explicitly out of scope for this plan.

- [ ] **Step 4: Write up the finding**

Report back (to the user, in conversation — no file needed) with:

- Whether `api` and Postgres-TnGR are in the same region.
- The `connection_limit` value found (or "unset, using Prisma default of N").
- The 10-sample `SELECT 1` round-trip numbers.
- A one-line recommendation: region alignment, connection pool increase, or "inconclusive, needs deeper profiling."

This task deliberately produces a decision input, not a fix — moving a production database's region is exactly the kind of hard-to-reverse, shared-system action that needs explicit user sign-off before any action is taken.

---

## Not Planned (blocked on a product/design decision, not scheduled here)

- **Map "middle button" → date-range picker.** UI/interaction design decision (which button to remove, what the date picker looks like) — needs a design pass, not a plan task.
- **"Only keep event pages with actual posts on them."** Requires a post-count field added to the map payload. The games-list endpoint's `include`-based query is shared by several other consumers (`show_pending`, `approval_status`, `team_id` filters) per the comment in `server/src/lib/serializeGame.ts:16-20`, and the events endpoint has no `map_view` mode or post-count field at all today — this needs its own investigation/plan, not a bolt-on to Task 2.
- **Org-invite / team-creation policy.** `team-create-org-plan-scope.test.ts` proves "any active org member can create a team, billed to the owner" is deliberate, tested design — not a bug. Whether that's still the policy you want is a product call, not something to silently change again.
- **Comprehensive sports-data ingestion breadth** (NFL/MLB/NBA/NHL/WWE/WNBA/lacrosse/tennis/all NCAA D1/dev leagues). Large scope expansion of existing pro-schedule ingestion — needs its own plan once prioritized.
- **DM restrictions.** Investigated this session — the minor-protection gate is correctly wired and tested (`minors-foundation.test.ts`). Not reproducible from the screenshot alone; needs the specific pair of accounts/ages involved before there's anything to plan.
