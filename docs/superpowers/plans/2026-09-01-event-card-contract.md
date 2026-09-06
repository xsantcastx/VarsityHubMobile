# Event-Card Normalization Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a canonical client-side `EventCard` type + validator and prove it on the map, so surfaces stop re-deriving the Game/Event blend.

**Architecture:** A zod schema in `apiclient/schemas/eventCard.ts` mirrors the server's `/event-discovery` item shape and exposes `validateEventCards` (per-item resilient, Sentry drift capture). The map (`game-map.tsx` + `utils/mapDiscovery.ts`) consumes the typed `EventCard` instead of a local ad-hoc interface — zero behavior change.

**Tech Stack:** React Native / Expo, TypeScript, zod v3, Jest (ts-jest), `@/utils/sentry`.

**Spec:** `docs/superpowers/specs/2026-09-01-event-card-contract-design.md`

## Global Constraints

- Run all tooling under **nvm Node 20**: `source ~/.nvm/nvm.sh && nvm use 20` before `npx tsc` / `npx jest` / `npx eslint`.
- Client schema convention: zod v3, `.passthrough()`, drift captured via `captureException` from `@/utils/sentry` (there is **no** `captureMessage`). Validator signature mirrors `event.ts`: `validateX(endpoint: string, payload: unknown)`.
- The validator must **never throw into a screen**. Malformed wrapper → `[]`; malformed individual items → drop them, keep the rest.
- Schema is **lenient**: only `id` and `source_type` are effectively required; everything else nullable/optional; unknown fields pass through. This keeps per-item drops rare (only genuinely unrenderable items).
- Zero product-behavior change on the map. The existing `mapDiscovery` and `EventMap.autofit` test assertions must stay green unchanged.
- Import paths: `@/api/schemas/eventCard` resolves to `apiclient/schemas/eventCard` (alias). Inside `apiclient/schemas/*`, import Sentry as `@/utils/sentry`.
- Branch: `feat/event-card-contract` (already created, stacked on `fix/map-calendar-lane1`). Commit per task; never `--no-verify`.

---

### Task 1: Canonical `EventCard` schema + `validateEventCards`

**Files:**

- Create: `apiclient/schemas/eventCard.ts`
- Test: `apiclient/schemas/__tests__/eventCard.test.ts`

**Interfaces:**

- Consumes: nothing (leaf module). Uses `captureException` from `@/utils/sentry`.
- Produces:
  - `eventCardSchema` (zod object, `.passthrough()`)
  - `type EventCard = z.infer<typeof eventCardSchema>`
  - `validateEventCards(endpoint: string, payload: unknown): EventCard[]`

- [ ] **Step 1: Write the failing test**

Create `apiclient/schemas/__tests__/eventCard.test.ts`:

```ts
import { eventCardSchema, validateEventCards, type EventCard } from '../eventCard';

// Mirrors the server's /event-discovery serialized items
// (server/src/__tests__/event-discovery-contract.test.ts shape).
const SERVER_GAME_ITEM = {
  id: 'game-1',
  source_type: 'game',
  event_id: 'event-linked',
  game_id: 'game-1',
  title: 'Varsity Final',
  date: '2026-08-31T20:00:00.000Z',
  location: 'Main Field',
  latitude: 40,
  longitude: -73,
  sport: 'football',
  status: null,
  banner_url: null,
  pro_home_color: null,
  pro_away_color: null,
  pro_league: null,
  venue_photo: null,
  map_visibility: {
    visible: true,
    reason_code: null,
    surface_window: { from: '2026-08-31T12:00:00.000Z', to: '2026-09-05T12:00:00.000Z' },
  },
  feed_priority: 2,
  live_window: { state: 'live' },
  posting_capabilities: { window_state: 'live', geofence_radius_km: 3 },
};

const SERVER_EVENT_ITEM = {
  id: 'event-only',
  source_type: 'event',
  event_id: 'event-only',
  game_id: null,
  title: 'NCAA Fixture',
  date: '2026-09-01T00:00:00.000Z',
  location: 'Arena',
  latitude: 41,
  longitude: -74,
  sport: 'basketball',
  status: 'published',
  banner_url: null,
  pro_home_color: '#123456',
  pro_away_color: null,
  pro_league: 'ncaamb',
  venue_photo: null,
  map_visibility: {
    visible: true,
    reason_code: null,
    surface_window: { from: '2026-08-31T12:00:00.000Z', to: '2026-09-05T12:00:00.000Z' },
  },
  feed_priority: 3,
  live_window: null,
  posting_capabilities: { window_state: 'closed', geofence_radius_km: 3 },
};

describe('eventCardSchema', () => {
  it('accepts real server-shaped game and event items (client<->server contract)', () => {
    expect(eventCardSchema.safeParse(SERVER_GAME_ITEM).success).toBe(true);
    expect(eventCardSchema.safeParse(SERVER_EVENT_ITEM).success).toBe(true);
  });

  it('requires id and a valid source_type', () => {
    expect(eventCardSchema.safeParse({ ...SERVER_GAME_ITEM, id: undefined }).success).toBe(false);
    expect(eventCardSchema.safeParse({ ...SERVER_GAME_ITEM, source_type: 'post' }).success).toBe(
      false
    );
  });

  it('tolerates unknown extra fields and nullable optionals (lenient)', () => {
    const withExtra = { ...SERVER_EVENT_ITEM, brand_new_server_field: 'x', location: null };
    const parsed = eventCardSchema.safeParse(withExtra);
    expect(parsed.success).toBe(true);
  });
});

describe('validateEventCards', () => {
  it('returns the items from a well-formed wrapper', () => {
    const cards = validateEventCards('/event-discovery?surface=map', {
      items: [SERVER_GAME_ITEM, SERVER_EVENT_ITEM],
      surface: 'map',
    });
    expect(cards.map((c: EventCard) => c.id)).toEqual(['game-1', 'event-only']);
  });

  it('accepts a bare array payload too', () => {
    const cards = validateEventCards('/x', [SERVER_GAME_ITEM]);
    expect(cards).toHaveLength(1);
  });

  it('drops only the malformed item and keeps the valid ones (per-item resilience)', () => {
    const cards = validateEventCards('/x', {
      items: [SERVER_GAME_ITEM, { source_type: 'game' /* no id */ }, SERVER_EVENT_ITEM],
    });
    expect(cards.map(c => c.id)).toEqual(['game-1', 'event-only']);
  });

  it('returns [] (never throws) on a malformed wrapper', () => {
    expect(validateEventCards('/x', null)).toEqual([]);
    expect(validateEventCards('/x', { items: 'not-an-array' })).toEqual([]);
    expect(validateEventCards('/x', 42)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest apiclient/schemas/__tests__/eventCard.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../eventCard'`.

- [ ] **Step 3: Write minimal implementation**

Create `apiclient/schemas/eventCard.ts`:

```ts
/**
 * Canonical client-side event-card contract.
 *
 * Mirrors the server's `/event-discovery` item shape (server/src/lib/
 * eventDiscovery.ts). This is the single client-side definition of "an event
 * card" — every surface that renders games/events should consume `EventCard`
 * instead of re-deriving the Game/Event blend. The schema is deliberately
 * lenient (only id + source_type required; everything else nullable/optional;
 * unknown fields pass through) so the server can add fields without breaking
 * clients, and so per-item validation only drops genuinely unrenderable items.
 */
import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const mapVisibilitySchema = z
  .object({
    visible: z.boolean().optional(),
    reason_code: z.string().nullable().optional(),
    surface_window: z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const eventCardSchema = z
  .object({
    // Identity
    id: z.string(),
    source_type: z.enum(['game', 'event']),
    event_id: z.string().nullable().optional(),
    game_id: z.string().nullable().optional(),
    // Display
    title: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    banner_url: z.string().nullable().optional(),
    sport: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    pro_home_color: z.string().nullable().optional(),
    pro_away_color: z.string().nullable().optional(),
    pro_league: z.string().nullable().optional(),
    venue_photo: z.string().nullable().optional(),
    // Location
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    map_visibility: mapVisibilitySchema.nullable().optional(),
    // Ranking
    feed_priority: z.number().nullable().optional(),
    // Capabilities — kept opaque so capability drift never fails the parse.
    live_window: z.unknown().optional(),
    posting_capabilities: z.unknown().optional(),
  })
  .passthrough();

export type EventCard = z.infer<typeof eventCardSchema>;

const discoveryWrapperSchema = z
  .object({
    items: z.array(z.unknown()),
    surface: z.string().optional(),
    counts: z.unknown().optional(),
  })
  .passthrough();

/**
 * Parse a `/event-discovery` response into typed cards. Never throws into a
 * screen. A malformed wrapper degrades to `[]`; individual malformed items are
 * dropped (keeping the valid subset). Both paths capture drift to Sentry.
 *
 * NB: this deliberately differs from `event.ts`'s pass-through-on-failure — a
 * keyed list feeding the map is safer dropping an unrenderable item than
 * passing a card with no `id`.
 */
export function validateEventCards(endpoint: string, payload: unknown): EventCard[] {
  const normalized = Array.isArray(payload) ? { items: payload } : payload;
  const wrapper = discoveryWrapperSchema.safeParse(normalized);
  if (!wrapper.success) {
    captureException(new Error(`[eventCard] malformed discovery payload`), {
      endpoint,
      issue: wrapper.error.issues[0]?.message ?? 'invalid wrapper',
    });
    return [];
  }

  const cards: EventCard[] = [];
  let dropped = 0;
  let firstIssue: string | null = null;
  for (const raw of wrapper.data.items) {
    const parsed = eventCardSchema.safeParse(raw);
    if (parsed.success) {
      cards.push(parsed.data);
    } else {
      dropped += 1;
      if (!firstIssue) firstIssue = parsed.error.issues[0]?.message ?? 'invalid item';
    }
  }
  if (dropped > 0) {
    captureException(new Error(`[eventCard] dropped ${dropped} invalid item(s)`), {
      endpoint,
      dropped,
      firstIssue,
    });
  }
  return cards;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest apiclient/schemas/__tests__/eventCard.test.ts --no-coverage`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apiclient/schemas/eventCard.ts apiclient/schemas/__tests__/eventCard.test.ts
git commit -m "feat(schema): canonical EventCard contract + validateEventCards"
```

---

### Task 2: Map consumes the canonical card

**Files:**

- Modify: `utils/mapDiscovery.ts` (remove local `MapDiscoveryItem`; use `EventCard`)
- Modify: `utils/__tests__/mapDiscovery.test.ts` (import `EventCard` instead of `MapDiscoveryItem`)
- Modify: `app/game-map.tsx` (parse discovery response via `validateEventCards`)

**Interfaces:**

- Consumes: `EventCard`, `validateEventCards` from `@/api/schemas/eventCard`.
- Produces: `toMapEvents(items: EventCard[], now?, opts?)` and `buildUpcomingDateButtons` unchanged in behavior; `buildMapDiscoveryPath` unchanged.

- [ ] **Step 1: Retype the mapDiscovery test to `EventCard` (keep assertions)**

In `utils/__tests__/mapDiscovery.test.ts`, change the import so the fixtures are typed by the canonical card. Replace:

```ts
import {
  buildMapDiscoveryPath,
  toMapEvents,
  buildUpcomingDateButtons,
  type MapDiscoveryItem,
} from '../mapDiscovery';
```

with:

```ts
import { buildMapDiscoveryPath, toMapEvents, buildUpcomingDateButtons } from '../mapDiscovery';
import type { EventCard } from '@/api/schemas/eventCard';
```

Then change the two fixture array annotations `const items: MapDiscoveryItem[]` and `const withPast: MapDiscoveryItem[]` to `: EventCard[]`. Leave every assertion unchanged.

- [ ] **Step 2: Run the test to verify it fails to compile/resolve**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest utils/__tests__/mapDiscovery.test.ts --no-coverage`
Expected: FAIL — `mapDiscovery` still exports `MapDiscoveryItem` (old type) and does not yet accept `EventCard`; ts-jest type error on the fixtures, or unresolved `@/api/schemas/eventCard` import if the fixtures don't match. (Any red is acceptable here; it must not pass yet.)

- [ ] **Step 3: Retype `mapDiscovery.ts` onto `EventCard`**

In `utils/mapDiscovery.ts`:

1. Add the import and remove the local interface. Replace:

```ts
import type { EventMapData } from '@/components/EventMap.types';
import { normalizeSportSlug } from '@/constants/sports';
import { shouldShowEventOnMap } from '@/utils/mapEventFilters';
```

with:

```ts
import type { EventMapData } from '@/components/EventMap.types';
import type { EventCard } from '@/api/schemas/eventCard';
import { normalizeSportSlug } from '@/constants/sports';
import { shouldShowEventOnMap } from '@/utils/mapEventFilters';
```

2. Delete the entire `export interface MapDiscoveryItem { ... }` block.

3. Change `toMapEvents`'s parameter type from `MapDiscoveryItem[] | null | undefined` to `EventCard[] | null | undefined`. The body is unchanged (it already reads only `id`, `source_type`, `title`, `date`, `location`, `latitude`, `longitude`, `sport`).

- [ ] **Step 4: Run the mapDiscovery tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest utils/__tests__/mapDiscovery.test.ts --no-coverage`
Expected: PASS — same 9 assertions, now typed by `EventCard`.

- [ ] **Step 5: Wire `game-map.tsx` to validate through the contract**

In `app/game-map.tsx`, add the import:

```ts
import { validateEventCards } from '@/api/schemas/eventCard';
```

Then, inside `loadGames`, replace the raw item extraction:

```ts
const res: any = await httpGet(buildMapDiscoveryPath());
const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
const now = new Date();
```

with:

```ts
const res: unknown = await httpGet(buildMapDiscoveryPath());
const items = validateEventCards('/event-discovery?surface=map', res);
const now = new Date();
```

The two `toMapEvents(items, ...)` calls below stay exactly as they are (they now receive `EventCard[]`).

- [ ] **Step 6: Typecheck + lint**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 20
npx tsc --noEmit
npx eslint app/game-map.tsx utils/mapDiscovery.ts apiclient/schemas/eventCard.ts
```

Expected: 0 tsc errors; 0 eslint errors.

- [ ] **Step 7: Run the full affected suite (behavior parity)**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 20
npx jest apiclient/schemas/__tests__/eventCard.test.ts utils/__tests__/mapDiscovery.test.ts components/__tests__/EventMap.autofit.test.tsx __tests__/discover-map-no-calendar.test.ts --no-coverage
```

Expected: all suites PASS. The unchanged `mapDiscovery` + `EventMap.autofit` assertions passing is the proof of zero behavior change.

- [ ] **Step 8: Commit**

```bash
git add utils/mapDiscovery.ts utils/__tests__/mapDiscovery.test.ts app/game-map.tsx
git commit -m "refactor(map): consume canonical EventCard via validateEventCards"
```

---

## Self-Review

**1. Spec coverage:**

- Contract artifact (`eventCard.ts` schema + type + `validateEventCards`, per-item resilient) → Task 1. ✓
- Proof surface = map (`mapDiscovery` retype + `game-map` validate) → Task 2. ✓
- Pinning: client↔server contract test + adapted mapDiscovery tests → Task 1 Step 1, Task 2 Steps 1/4/7. ✓
- Error handling (never throw; wrapper→[]; per-item drop; Sentry capture) → Task 1 Step 3 + tests. ✓
- Non-goals (no server serializer, no feed/Discover migration, no filters) → not implemented, correct. ✓

**2. Placeholder scan:** No TBD/TODO; all code blocks are complete and runnable. ✓

**3. Type consistency:** `EventCard`, `validateEventCards`, `eventCardSchema`, `toMapEvents(items: EventCard[])`, import path `@/api/schemas/eventCard` used identically across both tasks. `captureException(error, context?)` matches the real `@/utils/sentry` signature. ✓
