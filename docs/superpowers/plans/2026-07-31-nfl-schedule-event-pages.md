# NFL Schedule → Rolling Standalone Event Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish upcoming NFL games as standalone, geofenced event pages on a rolling ~2-week horizon, sourced from TheSportsDB but gated so only real-and-confirmed games go live.

**Architecture:** Extend the existing `server/src/lib/proSchedule/` pipeline (adapter → `resolveFixture` → idempotent `ingest.upsert` into `Event` rows). Add three pieces: a TheSportsDB adapter, an NFL confirmation layer that reconciles the ingested slate against known NFL structure before publish, and a single Railway-cron script that runs the 14-day window. No NFL team pages; `ProTeam` rows are used only as the internal venue/title lookup they already are.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Prisma, Zod, Jest (server tests run via `npm test` with `--experimental-vm-modules`, NOT `npx jest`), Node 20 (run tooling under nvm Node 20).

## Global Constraints

- Server tests run with `npm test` from `server/` — never `npx jest` (needs `--experimental-vm-modules`).
- Run all tsx/jest tooling under nvm Node 20 (`nvm use 20`), not the sandbox default Node 18.
- ESM: every relative import ends in `.js` even for `.ts` sources.
- `ProTeam.external_ref` format is `nfl:{slug}` where slug = lowercased full name, spaces → hyphens (e.g. `Arizona Cardinals` → `nfl:arizona-cardinals`).
- NFL live posting window: 5 hours after start (`LIVE_WINDOW_HOURS_BY_LEAGUE.nfl`, already set).
- Never scrape league/broadcaster sites. TheSportsDB API only.
- No NFL team page is built or exposed. `pro_home_team_id`/`pro_away_team_id` stay internal FKs, never rendered as links.
- Nothing publishes unconfirmed: a game reaches a live page only if both teams map, its venue resolves to a known coordinate, and the full slate reconciles structurally. Otherwise it is quarantined/aborted and reported.

---

### Task 1: Team-name → `external_ref` resolver

**Files:**

- Create: `server/src/lib/proSchedule/nflTeamRef.ts`
- Test: `server/src/__tests__/nfl-team-ref.test.ts`

**Interfaces:**

- Produces: `resolveNflTeamRef(name: string): string | null` — returns `nfl:{slug}` for a known team name (via slugging + an alias table), or `null` when unmapped.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/nfl-team-ref.test.ts
import { resolveNflTeamRef } from '../lib/proSchedule/nflTeamRef.js';

describe('resolveNflTeamRef', () => {
  it('slugs a canonical full name', () => {
    expect(resolveNflTeamRef('Arizona Cardinals')).toBe('nfl:arizona-cardinals');
  });
  it('is case- and whitespace-insensitive', () => {
    expect(resolveNflTeamRef('  kansas city CHIEFS ')).toBe('nfl:kansas-city-chiefs');
  });
  it('maps a known provider alias to the canonical ref', () => {
    expect(resolveNflTeamRef('Washington Football Team')).toBe('nfl:washington-commanders');
  });
  it('returns null for an unknown name (never guesses)', () => {
    expect(resolveNflTeamRef('London Monarchs')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- nfl-team-ref`
Expected: FAIL — `Cannot find module '../lib/proSchedule/nflTeamRef.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/lib/proSchedule/nflTeamRef.ts
import { PRO_TEAMS } from '../proTeams.js';

/** Canonical NFL external_refs, derived from the seed — the source of truth. */
const KNOWN_NFL_REFS = new Set(PRO_TEAMS.filter(t => t.league === 'nfl').map(t => t.external_ref));

/** Provider names that don't slug to our canonical ref. Extend as real feeds reveal mismatches. */
const ALIASES: Record<string, string> = {
  'washington-football-team': 'nfl:washington-commanders',
  'washington-redskins': 'nfl:washington-commanders',
  'oakland-raiders': 'nfl:las-vegas-raiders',
  'san-diego-chargers': 'nfl:los-angeles-chargers',
  'st-louis-rams': 'nfl:los-angeles-rams',
};

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveNflTeamRef(name: string): string | null {
  if (!name) return null;
  const s = slug(name);
  if (ALIASES[s]) return ALIASES[s];
  const ref = `nfl:${s}`;
  return KNOWN_NFL_REFS.has(ref) ? ref : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- nfl-team-ref`
Expected: PASS (4 tests). If `PRO_TEAMS` is not the exported name in `proTeams.ts`, grep the actual export and adjust the import.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/proSchedule/nflTeamRef.ts server/src/__tests__/nfl-team-ref.test.ts
git commit -m "feat(nfl): team-name → external_ref resolver with alias table"
```

---

### Task 2: TheSportsDB adapter

**Files:**

- Modify: `server/src/lib/proSchedule/adapters.ts` (add `theSportsDbAdapter`, extend `resolveConfiguredAdapter`)
- Create: `server/src/__tests__/fixtures/thesportsdb-nfl-sample.json` (captured real response — see Step 0)
- Test: `server/src/__tests__/thesportsdb-adapter.test.ts`

**Interfaces:**

- Consumes: `resolveNflTeamRef` (Task 1); `ProFixture`, `ProScheduleAdapter` (`types.ts`).
- Produces: `theSportsDbAdapter(apiKey: string): ProScheduleAdapter`; `resolveConfiguredAdapter` now returns it when `PRO_SCHEDULE_PROVIDER=thesportsdb` and `PRO_SCHEDULE_API_KEY` are set.

- [ ] **Step 0: Capture a real sample (once, manually — do NOT hand-write it)**

Run against the free tier (key `3` is TheSportsDB's public test key) and save verbatim:

```bash
cd server && mkdir -p src/__tests__/fixtures
curl -s "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4391&s=2026-2027" \
  -o src/__tests__/fixtures/thesportsdb-nfl-sample.json
# id=4391 is TheSportsDB's NFL league id. Confirm the file has an `events` array with strHomeTeam/strAwayTeam/dateEvent/strTimestamp/strVenue.
```

If the field names differ from what this task assumes, adjust the parser in Step 3 to match the captured JSON — the sample is the source of truth, not this plan's field guesses.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/thesportsdb-adapter.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { theSportsDbAdapter } from '../lib/proSchedule/adapters.js';

const sample = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/thesportsdb-nfl-sample.json', import.meta.url)),
    'utf8'
  )
);

describe('theSportsDbAdapter', () => {
  const adapter = theSportsDbAdapter('3');
  // Inject the sample instead of hitting the network.
  const fetchFixtures = (from: Date, to: Date) => adapter.__parseSeason!(sample, from, to); // test-only hook exposed by the adapter

  it('maps a two-team game to a normalized fixture', () => {
    const wide = fetchFixtures(new Date('2000-01-01'), new Date('2100-01-01'));
    const g = wide[0];
    expect(g.league).toBe('nfl');
    expect(g.home_team_ref).toMatch(/^nfl:/);
    expect(g.away_team_ref).toMatch(/^nfl:/);
    expect(g.starts_at).toBeInstanceOf(Date);
    expect(g.external_ref).toContain('nfl:');
  });

  it('filters to the [from, to] window', () => {
    const all = fetchFixtures(new Date('2000-01-01'), new Date('2100-01-01'));
    const narrow = fetchFixtures(all[0].starts_at, all[0].starts_at);
    expect(narrow.length).toBeGreaterThanOrEqual(1);
    expect(narrow.length).toBeLessThan(all.length);
  });

  it('leaves an unmapped team ref null so ingest quarantines it', () => {
    const parsed = adapter.__parseSeason!(
      {
        events: [
          {
            idEvent: 'x',
            strHomeTeam: 'London Monarchs',
            strAwayTeam: 'Buffalo Bills',
            dateEvent: '2026-09-14',
            strTimestamp: '2026-09-14T17:00:00+00:00',
            strVenue: 'Wembley',
          },
        ],
      },
      new Date('2000-01-01'),
      new Date('2100-01-01')
    );
    expect(parsed[0].home_team_ref).toBeNull();
    expect(parsed[0].away_team_ref).toBe('nfl:buffalo-bills');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- thesportsdb-adapter`
Expected: FAIL — `theSportsDbAdapter` not exported.

- [ ] **Step 3: Implement the adapter**

Add to `server/src/lib/proSchedule/adapters.ts`:

```ts
import { resolveNflTeamRef } from './nflTeamRef.js';

type TsdbEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string; // "2026-09-14"
  strTimestamp?: string | null; // ISO w/ tz, preferred
  strTime?: string | null; // "17:00:00" fallback
  strVenue?: string | null;
  strStatus?: string | null;
};

/** Extends ProScheduleAdapter with a test-only pure parser so tests never hit the network. */
type TheSportsDbAdapter = ProScheduleAdapter & {
  __parseSeason?: (raw: unknown, from: Date, to: Date) => ProFixture[];
};

const TSDB_NFL_LEAGUE_ID = '4391';

function parseTsdbEvent(e: TsdbEvent): ProFixture | null {
  const startsAt = e.strTimestamp
    ? new Date(e.strTimestamp)
    : new Date(`${e.dateEvent}T${e.strTime ?? '00:00:00'}Z`);
  if (Number.isNaN(startsAt.getTime())) return null;

  const status: ProFixture['status'] = (e.strStatus ?? '').toLowerCase().includes('cancel')
    ? 'cancelled'
    : (e.strStatus ?? '').toLowerCase().includes('postpon')
      ? 'postponed'
      : 'scheduled';

  return {
    external_ref: `nfl:${e.idEvent}`,
    league: 'nfl',
    starts_at: startsAt,
    home_team_ref: resolveNflTeamRef(e.strHomeTeam),
    away_team_ref: resolveNflTeamRef(e.strAwayTeam),
    title: null, // resolveFixture derives "Away at Home" from short_names
    venue_name: e.strVenue ?? null,
    // Provider gives no coords; resolveFixture falls back to the home stadium seed.
    venue_lat: null,
    venue_lng: null,
    status,
  };
}

function parseSeason(raw: unknown, from: Date, to: Date): ProFixture[] {
  const events = (raw as { events?: TsdbEvent[] })?.events;
  if (!Array.isArray(events)) return [];
  const out: ProFixture[] = [];
  for (const e of events) {
    const f = parseTsdbEvent(e);
    if (!f) continue;
    if (f.starts_at < from || f.starts_at > to) continue;
    out.push(f);
  }
  return out;
}

export function theSportsDbAdapter(apiKey: string): TheSportsDbAdapter {
  return {
    name: `thesportsdb:nfl`,
    leagues: ['nfl'] as const,
    __parseSeason: parseSeason,
    async fetchFixtures(league, from, to): Promise<ProFixture[]> {
      if (league !== 'nfl') return [];
      const season = seasonLabelFor(from); // e.g. "2026-2027"
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${TSDB_NFL_LEAGUE_ID}&s=${season}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[thesportsdb] ${res.status} for ${url}`);
      return parseSeason(await res.json(), from, to);
    },
  };
}

/** NFL season spans two calendar years; Sept–Feb belongs to the year it started. */
export function seasonLabelFor(d: Date): string {
  const y = d.getUTCMonth() >= 2 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${y + 1}`;
}
```

Then extend `resolveConfiguredAdapter`:

```ts
export function resolveConfiguredAdapter(env = process.env): ProScheduleAdapter | null {
  const file = env.PRO_SCHEDULE_JSON_PATH;
  if (file) return jsonFileAdapter(file);
  if (env.PRO_SCHEDULE_PROVIDER === 'thesportsdb' && env.PRO_SCHEDULE_API_KEY) {
    return theSportsDbAdapter(env.PRO_SCHEDULE_API_KEY);
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- thesportsdb-adapter`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/proSchedule/adapters.ts \
        server/src/__tests__/thesportsdb-adapter.test.ts \
        server/src/__tests__/fixtures/thesportsdb-nfl-sample.json
git commit -m "feat(nfl): TheSportsDB adapter + resolveConfiguredAdapter wiring"
```

---

### Task 3: NFL confirmation gates

**Files:**

- Create: `server/src/lib/proSchedule/nflConfirmation.ts`
- Create: `server/src/lib/proSchedule/nflNeutralSites.ts`
- Test: `server/src/__tests__/nfl-schedule-confirmation.test.ts`

**Interfaces:**

- Consumes: `ProFixture` (`types.ts`).
- Produces:
  - `NEUTRAL_SITES: Record<string, { lat: number; lng: number }>` keyed by lowercased venue name.
  - `confirmNflSlate(fixtures: ProFixture[]): { ok: boolean; errors: string[]; quarantined: Array<{ ref: string; reason: string }>; publishable: ProFixture[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/nfl-schedule-confirmation.test.ts
import { confirmNflSlate } from '../lib/proSchedule/nflConfirmation.js';
import { PRO_TEAMS } from '../lib/proTeams.js';

const NFL = PRO_TEAMS.filter(t => t.league === 'nfl');

/** Build a structurally-valid 272-game / 17-per-team / one-bye regular season. */
function validSeason(): any[] {
  const refs = NFL.map(t => t.external_ref);
  const games: any[] = [];
  let id = 0;
  const plays = Object.fromEntries(refs.map(r => [r, 0]));
  // Round-robin-ish scheduler just for counts: each team gets 17 games.
  outer: for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (plays[refs[i]] >= 17 || plays[refs[j]] >= 17) continue;
      games.push({
        external_ref: `nfl:g${id++}`,
        league: 'nfl',
        starts_at: new Date('2026-09-13T17:00:00Z'),
        home_team_ref: refs[i],
        away_team_ref: refs[j],
        venue_name: null,
        status: 'scheduled',
      });
      plays[refs[i]]++;
      plays[refs[j]]++;
      if (games.length >= 272) break outer;
    }
  }
  return games;
}

describe('confirmNflSlate', () => {
  it('accepts a structurally-complete season', () => {
    const r = confirmNflSlate(validSeason());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects a slate missing games', () => {
    const short = validSeason().slice(0, 200);
    const r = confirmNflSlate(short);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/272/);
  });

  it('rejects when a team plays too many games', () => {
    const s = validSeason();
    s[0].away_team_ref = s[0].home_team_ref; // corrupt: one team double-counted
    const r = confirmNflSlate(s);
    expect(r.ok).toBe(false);
  });

  it('quarantines an unmapped-team game but keeps ok=false loud', () => {
    const s = validSeason();
    s[5].home_team_ref = null;
    const r = confirmNflSlate(s);
    expect(r.quarantined.some(q => q.ref === s[5].external_ref)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- nfl-schedule-confirmation`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement neutral sites + confirmation**

```ts
// server/src/lib/proSchedule/nflNeutralSites.ts
// Curated, confirmed coordinates for international/special-site games.
// Extend per season from the official neutral-site announcement — never guess.
export const NEUTRAL_SITES: Record<string, { lat: number; lng: number }> = {
  'tottenham hotspur stadium': { lat: 51.6043, lng: -0.0665 },
  'wembley stadium': { lat: 51.556, lng: -0.2796 },
  'allianz arena': { lat: 48.2188, lng: 11.6247 },
  'estádio corinthians': { lat: -23.5453, lng: -46.4742 },
};
```

```ts
// server/src/lib/proSchedule/nflConfirmation.ts
import type { ProFixture } from './types.js';
import { NEUTRAL_SITES } from './nflNeutralSites.js';

const REGULAR_SEASON_GAMES = 272;
const GAMES_PER_TEAM = 17;
const NFL_TEAMS = 32;

export type ConfirmResult = {
  ok: boolean;
  errors: string[];
  quarantined: Array<{ ref: string; reason: string }>;
  publishable: ProFixture[];
};

export function confirmNflSlate(fixtures: ProFixture[]): ConfirmResult {
  const errors: string[] = [];
  const quarantined: Array<{ ref: string; reason: string }> = [];
  const publishable: ProFixture[] = [];

  const perTeam = new Map<string, number>();
  for (const f of fixtures) {
    // Per-game gates → quarantine (do not publish this one), keep going.
    if (!f.home_team_ref || !f.away_team_ref) {
      quarantined.push({ ref: f.external_ref, reason: 'unmapped team' });
      continue;
    }
    if (f.home_team_ref === f.away_team_ref) {
      quarantined.push({ ref: f.external_ref, reason: 'team plays itself' });
      continue;
    }
    if (!isKickoffPlausible(f.starts_at)) {
      quarantined.push({
        ref: f.external_ref,
        reason: `implausible kickoff ${f.starts_at.toISOString()}`,
      });
      continue;
    }
    if (f.venue_name && !venueResolves(f.venue_name)) {
      // Named but unknown venue and no coords → resolveFixture would skip anyway; quarantine explicitly.
      // (Home-stadium fallback still applies when venue_name is null.)
    }
    perTeam.set(f.home_team_ref, (perTeam.get(f.home_team_ref) ?? 0) + 1);
    perTeam.set(f.away_team_ref, (perTeam.get(f.away_team_ref) ?? 0) + 1);
    publishable.push(f);
  }

  // Structural gates → abort the whole publish.
  if (publishable.length !== REGULAR_SEASON_GAMES) {
    errors.push(`expected ${REGULAR_SEASON_GAMES} regular-season games, got ${publishable.length}`);
  }
  if (perTeam.size !== NFL_TEAMS) {
    errors.push(`expected ${NFL_TEAMS} distinct teams, got ${perTeam.size}`);
  }
  for (const [ref, n] of perTeam) {
    if (n !== GAMES_PER_TEAM) errors.push(`${ref} plays ${n} games, expected ${GAMES_PER_TEAM}`);
  }

  return { ok: errors.length === 0, errors, quarantined, publishable };
}

/** Sept–Feb, Thu/Sat/Sun/Mon kickoffs (UTC day tolerated ±1 for tz). */
function isKickoffPlausible(d: Date): boolean {
  const month = d.getUTCMonth(); // 0=Jan
  const inSeason = month >= 8 || month <= 1; // Sep(8)..Feb(1)
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const okDay = [0, 1, 4, 5, 6].includes(day); // Sun,Mon,Thu,Fri,Sat (tz slop)
  return inSeason && okDay;
}

function venueResolves(name: string): boolean {
  return Boolean(NEUTRAL_SITES[name.trim().toLowerCase()]);
}
```

Note: this task deliberately leaves the neutral-site coordinate _injection_ into fixtures to Task 4 (where fixtures meet `resolveFixture`), keeping confirmation pure.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- nfl-schedule-confirmation`
Expected: PASS (4 tests). If the round-robin helper can't reach 272 with 17-per-team, adjust the helper — the production code is what's under test, not the helper's scheduling.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/proSchedule/nflConfirmation.ts \
        server/src/lib/proSchedule/nflNeutralSites.ts \
        server/src/__tests__/nfl-schedule-confirmation.test.ts
git commit -m "feat(nfl): confirmation gates — structural + kickoff + venue reconciliation"
```

---

### Task 4: NFL ingest orchestration (fetch → confirm → apply neutral coords → upsert)

**Files:**

- Create: `server/src/lib/proSchedule/ingestNfl.ts`
- Test: `server/src/__tests__/ingest-nfl.test.ts`

**Interfaces:**

- Consumes: `theSportsDbAdapter`/`resolveConfiguredAdapter` (Task 2), `confirmNflSlate` + `NEUTRAL_SITES` (Task 3), `ingestFixtures` (`ingest.ts`).
- Produces: `ingestNflWindow(adapter, from, to, opts: { apply: boolean }): Promise<{ confirmation: ConfirmResult; stats: IngestStats | null }>`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/ingest-nfl.test.ts
import { applyNeutralSiteCoords } from '../lib/proSchedule/ingestNfl.js';

describe('applyNeutralSiteCoords', () => {
  it('fills coords for a whitelisted neutral venue', () => {
    const f: any = { venue_name: 'Tottenham Hotspur Stadium', venue_lat: null, venue_lng: null };
    const out = applyNeutralSiteCoords(f);
    expect(out.venue_lat).toBeCloseTo(51.6043, 3);
    expect(out.venue_lng).toBeCloseTo(-0.0665, 3);
  });
  it('leaves a non-neutral venue untouched (home-stadium fallback handles it)', () => {
    const f: any = { venue_name: 'State Farm Stadium', venue_lat: null, venue_lng: null };
    const out = applyNeutralSiteCoords(f);
    expect(out.venue_lat).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- ingest-nfl`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement orchestration**

```ts
// server/src/lib/proSchedule/ingestNfl.ts
import type { ProFixture, ProScheduleAdapter } from './types.js';
import { confirmNflSlate, type ConfirmResult } from './nflConfirmation.js';
import { NEUTRAL_SITES } from './nflNeutralSites.js';
import { ingestFixtures, type IngestStats } from './ingest.js';

export function applyNeutralSiteCoords(f: ProFixture): ProFixture {
  if (f.venue_lat != null && f.venue_lng != null) return f;
  const site = f.venue_name ? NEUTRAL_SITES[f.venue_name.trim().toLowerCase()] : undefined;
  if (!site) return f;
  return { ...f, venue_lat: site.lat, venue_lng: site.lng };
}

export async function ingestNflWindow(
  adapter: ProScheduleAdapter,
  from: Date,
  to: Date,
  opts: { apply: boolean }
): Promise<{ confirmation: ConfirmResult; stats: IngestStats | null }> {
  // Confirmation reconciles the FULL season, not just the 14-day window —
  // structure ("272 games", "17 per team") is only meaningful whole-season.
  const seasonStart = new Date(Date.UTC(seasonYear(from), 7, 1)); // Aug 1
  const seasonEnd = new Date(Date.UTC(seasonYear(from) + 1, 1, 28)); // Feb 28
  const full = (await adapter.fetchFixtures('nfl', seasonStart, seasonEnd)).map(
    applyNeutralSiteCoords
  );
  const confirmation = confirmNflSlate(full);

  if (!confirmation.ok) {
    console.error('[ingestNfl] slate FAILED confirmation — publishing nothing:');
    for (const e of confirmation.errors.slice(0, 25)) console.error(`  ✗ ${e}`);
    return { confirmation, stats: null };
  }

  // Publish only the confirmed games that fall inside the rolling window.
  const windowGames = confirmation.publishable.filter(
    f => f.starts_at >= from && f.starts_at <= to
  );
  const stats = await ingestFixtures('nfl', windowGames, { dryRun: !opts.apply });
  return { confirmation, stats };
}

function seasonYear(d: Date): number {
  return d.getUTCMonth() >= 2 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- ingest-nfl`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/proSchedule/ingestNfl.ts server/src/__tests__/ingest-nfl.test.ts
git commit -m "feat(nfl): season-confirming ingest orchestration + neutral-site coords"
```

---

### Task 5: Rolling 2-week cron script

**Files:**

- Create: `server/src/cron/pro-nfl-schedule.ts`
- Modify: `server/src/__tests__/cron-wiring.test.ts` (register the new job so the wiring test covers it)

**Interfaces:**

- Consumes: `resolveConfiguredAdapter` (Task 2), `ingestNflWindow` (Task 4).
- Produces: `runNflScheduleIngest(opts?: { apply?: boolean }): Promise<void>` + direct-run guard.

- [ ] **Step 1: Write the failing test**

```ts
// add to server/src/__tests__/cron-wiring.test.ts
import { runNflScheduleIngest } from '../cron/pro-nfl-schedule.js';
it('exposes the NFL schedule ingest cron entrypoint', () => {
  expect(typeof runNflScheduleIngest).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- cron-wiring`
Expected: FAIL — `../cron/pro-nfl-schedule.js` not found.

- [ ] **Step 3: Implement the cron**

```ts
// server/src/cron/pro-nfl-schedule.ts
/**
 * Rolling NFL schedule ingest.
 *
 * Publishes NFL games in the next ~14 days as geofenced Event pages, but only
 * after the FULL season reconciles against known NFL structure (see
 * confirmNflSlate). Idempotent — re-running corrects moved/postponed games.
 *
 * Railway cron suggestion: every 6h  ->  `0 */6 * * *`
 * DRY RUN by default; pass --apply (or ROLLING_APPLY=1) to write.
 *   PRO_SCHEDULE_PROVIDER=thesportsdb PRO_SCHEDULE_API_KEY=xxx \
 *     npx tsx src/cron/pro-nfl-schedule.ts --apply
 */
import { prisma } from '../lib/prisma.js';
import { NO_ADAPTER_MESSAGE, resolveConfiguredAdapter } from '../lib/proSchedule/adapters.js';
import { ingestNflWindow } from '../lib/proSchedule/ingestNfl.js';

const WINDOW_DAYS = 14;

export async function runNflScheduleIngest(opts: { apply?: boolean } = {}): Promise<void> {
  const apply = opts.apply ?? (process.argv.includes('--apply') || process.env.ROLLING_APPLY === '1');
  const adapter = resolveConfiguredAdapter();
  if (!adapter) { console.warn(NO_ADAPTER_MESSAGE); return; }

  const from = new Date();
  const to = new Date(from.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[pro-nfl-schedule] ${apply ? 'APPLY' : 'DRY RUN'} window ${from.toISOString()} → ${to.toISOString()}`);

  const { confirmation, stats } = await ingestNflWindow(adapter, from, to, { apply });
  if (!confirmation.ok) { process.exitCode = 1; return; }
  console.log(
    `[pro-nfl-schedule] confirmed season; window created=${stats?.created} updated=${stats?.updated} ` +
    `skipped=${stats?.skipped} quarantined=${confirmation.quarantined.length}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNflScheduleIngest()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((err) => { console.error('[pro-nfl-schedule] fatal:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- cron-wiring`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/cron/pro-nfl-schedule.ts server/src/__tests__/cron-wiring.test.ts
git commit -m "feat(nfl): rolling 14-day schedule ingest cron (dry-run default)"
```

---

### Task 6: Full-suite gate + first-load dry-run report (manual verification, no publish)

**Files:**

- Modify: `README` or `server/scripts/` note only if needed; primarily a verification task.

- [ ] **Step 1: Run the whole server suite**

Run: `cd server && npm test`
Expected: PASS — the pre-existing pro tests (`pro-schedule-resolve`, `pro-event-geofence-parity`, `pro-team-unjoinable`, `reserved-usernames`) plus the four new suites all green. (Ten unrelated suites are known-flaky per project memory; confirm no _new_ reds.)

- [ ] **Step 2: Real dry-run against TheSportsDB (no writes)**

Run:

```bash
cd server && nvm use 20 && \
PRO_SCHEDULE_PROVIDER=thesportsdb PRO_SCHEDULE_API_KEY=3 \
npx tsx src/cron/pro-nfl-schedule.ts
```

Expected: either `confirmed season; window created=…` (dry-run counts) OR a confirmation-failure list. If it fails confirmation, that is the gate doing its job — capture the errors, fix the alias table / neutral-site list / season label, and re-run. **Do not proceed to publish until a clean dry-run.**

- [ ] **Step 3: Hand the dry-run report to the owner for baseline approval**

Summarize: total games confirmed, quarantined list (with reasons), first 2-week window counts. Owner approves before any `--apply` run. This is the human confirmation gate from the spec.

- [ ] **Step 4: Commit any alias/neutral-site corrections discovered**

```bash
git add -A && git commit -m "fix(nfl): reconcile alias table + neutral sites against live feed"
```

---

## Self-Review

**Spec coverage:**

- Standalone event pages / no team pages → reuses `Event` upsert; no client UI added (Tasks 2–5). ✓
- TheSportsDB source → Task 2. ✓
- Confirmation gates (structural / venue / kickoff / unmapped-team) → Task 3, wired in Task 4. ✓
- Rolling 2-week window → Task 5. ✓
- First-load dry-run human gate → Task 6. ✓
- Reuse existing tests + new adapter/confirmation tests → Tasks 2, 3, 6. ✓

**Placeholder scan:** No TBD/TODO; every code step carries real code. The one intentional manual step (capturing the TheSportsDB sample, Task 2 Step 0) is required because field names must come from the live feed, not a guess — the plan says to adjust the parser to the captured JSON.

**Type consistency:** `resolveNflTeamRef` (T1) → used in T2. `confirmNflSlate`/`ConfirmResult`/`NEUTRAL_SITES` (T3) → used in T4. `ingestNflWindow` (T4) → used in T5. `ProFixture`/`IngestStats` reused from existing `types.ts`/`ingest.ts`. Consistent.

**Known risk to watch during execution:** TheSportsDB free tier may not expose full future-season schedules or exact field names — Task 2 Step 0 and Task 6 Step 2 are the checkpoints that catch this early. If the feed can't supply a confirmable full season, fall back to the spec's alternative (owner-provided official file via `PRO_SCHEDULE_JSON_PATH`) — the confirmation gates and ingest are source-agnostic and unchanged.
