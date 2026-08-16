# Server-Controlled Marketing Feed Takeover — Design

|            |                                               |
| ---------- | --------------------------------------------- |
| **Date**   | 2026-08-16                                    |
| **Branch** | `feat/marketing-feed-devonly`                 |
| **Status** | Approved design — pending implementation plan |
| **Author** | Claude Code (Opus 4.8), with VarsityHub       |

## Goal

Let an admin turn the public feed into a shuffled reel of the most-active event
pages for a bounded window (default 1 hour), for **all** users, then have it
revert automatically. Must have a reliable, server-enforced expiry and an
instant kill-switch.

This builds on the existing admin-only marketing capture feed
(`docs/superpowers/specs/2026-08-15-marketing-feed-devonly-design.md`), which
already ranks events by activity and shuffles them — but is gated to an admin's
own device via a per-device toggle. This design adds a **server-controlled**
trigger so the same feed swap can be activated for everyone, time-boxed.

## Non-goals

- No new screen, countdown UI, or banner (YAGNI).
- No change to how "most active" is ranked — reuse `GET /events?marketing=1&sort=active`.
- No DB schema change.
- Not a scheduler/cron — the window self-expires via Redis TTL.

## Mechanism — self-expiring Redis flag

A single Redis key holds the window end time, written with a TTL equal to the
duration. When the TTL lapses the key disappears — that _is_ the auto-revert.
Cross-replica by construction (matches the repo rule "everything cross-replica
coordinates via Redis"). No migration, no background job.

- **Key:** `marketing:feed_takeover`
- **Value:** `{ until: <ISO string> }`
- **TTL:** `minutes * 60` seconds
- Helpers already exist in `server/src/lib/cache.ts`: `cacheGet`, `cacheSet(key, value, ttlSeconds)`, `cacheDel`.

## Components

### 1. Control endpoints — `server/src/routes/admin.ts`

- `POST /admin/marketing-takeover`
  - Body: `{ minutes?: number }` — default `60`, clamped to `[1, 180]`.
  - Effect: `cacheSet('marketing:feed_takeover', { until: now + minutes }, minutes*60)`.
  - Returns: `{ active: true, until }`.
- `DELETE /admin/marketing-takeover`
  - Effect: `cacheDel('marketing:feed_takeover')` — the instant kill-switch.
  - Returns: `{ active: false, until: null }`.
- Both: `requireAuth` + `requireAdmin`; both write an `AdminActivityLog` row
  (actor / action `marketing_takeover_start|stop` / timestamp) via
  `server/src/lib/adminActivityLogger.ts` (auditability invariant).
- Errors use the standard envelope; handlers wrapped in `asyncHandler`.

### 2. Bundle exposure — `server/src/routes/feed.ts` `GET /feed/bundle`

Add one field to the existing JSON response, from a single `cacheGet`:

```
marketing_takeover: { active: boolean, until: string | null }
```

`active` is true when the key exists and `until` is in the future. Read failures
fall back to `{ active: false, until: null }` (fail-closed — never force the
takeover on a Redis hiccup). No new endpoint; the client already fetches the
bundle each load.

### 3. Client consumer — `app/feed.tsx` `load()` (ships via OTA)

The condition that triggers the existing marketing branch changes from:

```
if (marketingActiveRef.current) { ... }
```

to also honor the server flag:

```
if (marketingActiveRef.current || bundle?.marketing_takeover?.active) { ... }
```

When active, it runs the **already-shipped** path unchanged: fetch
`Event.filter({ marketing: true, show_all: true, include_past: true })`
(`?marketing=1&sort=active`), `pickTopShuffled(events, 8)`, replace the feed
list. No new UI. A non-admin with the server flag active sees the takeover; with
it inactive, the normal feed. The admin per-device toggle continues to work
independently.

## Data flow

1. Admin calls `POST /admin/marketing-takeover { minutes: 60 }` → Redis key set, TTL 3600s.
2. Each client's next `GET /feed/bundle` returns `marketing_takeover.active = true`.
3. Clients carrying the new OTA swap their feed to the shuffled top-8.
4. After 60 min the Redis key expires → bundle reports `active = false` → clients revert on next load/refresh.
5. Kill early: `DELETE /admin/marketing-takeover` → revert on next load.

## Rollout order & reach caveat

1. **Server** — commit to `feat/marketing-feed-devonly`; on merge/push to `main`,
   Railway auto-deploys. Flag + endpoints + bundle field go live but do nothing
   until the flag is set.
2. **Client OTA** — publish the consumer to production, both runtimes
   (1.0.4 + 1.0.5) per the dual-runtime rule.
3. **Activate** — flip the flag whenever. Reusable; no redeploy to run again.

**Reach:** only devices with the new OTA honor the flag, so the takeover reaches
users as the OTA propagates (hours/days for full coverage), not instantly. The
window itself is server-enforced (reliable expiry, instant kill).

## Security / invariants

- Endpoints are admin-only (`requireAdmin`); a normal user cannot start/stop a takeover.
- Bundle read is fail-closed: a Redis error never activates the takeover.
- Admin actions emit `AdminActivityLog` rows.
- No client-controlled security-critical state — the client only _reads_ `active`.

## Testing

- **Server:** unit test the flag round-trip and TTL expiry; endpoint tests for
  `requireAdmin` gating (401/403 for non-admin), the `[1,180]` minute clamp, the
  `AdminActivityLog` row, and the bundle field reflecting active/inactive/expired.
- **Client:** test that `bundle.marketing_takeover.active === true` drives the
  marketing branch for a **non-admin** user (no toggle), and that `false` renders
  the normal feed.

## Product note

The current top-8 most-active pages are seeded demo/pro events (Fanatics Fest
days, a FIFA World Cup slate, "The Connecticut Cup"). A live public run shows all
users that content and replaces their followed feed for the window.
