# Pro Schedule Rolling Ingest — Enable Runbook

Turns on the live, all-league event-page population (NFL/NBA/WNBA/MLB via ESPN,
WWE via TheSportsDB). Everything ships **dormant** — nothing writes to prod until
the env vars below are set. Enable deliberately.

## Prerequisites (must be merged + deployed first)

1. **PR #225** (pro-sports foundation) — adds the `ProTeam` model + migration.
   `start.sh` runs `prisma migrate deploy` on deploy, so merging applies it.
2. **PR #229** (this branch) — the adapters + cron.
3. **Seed the pro teams** once (games whose team isn't seeded are quarantined):
   ```bash
   cd server && npx tsx scripts/seed-pro-teams.ts --apply
   ```

## Environment variables (Railway → service `api`)

| Var                            | Value                    | Effect                                                                       |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------- |
| `PRO_SCHEDULE_PROVIDER`        | `espn`                   | Selects the composite adapter (ESPN 4 leagues + WWE). Without it: no-op.     |
| `PRO_SCHEDULE_ROLLING_ENABLED` | `1`                      | Allows **writes**. Omit/unset → daily job runs as a **dry-run** (logs only). |
| `PRO_SCHEDULE_TSDB_KEY`        | _(optional)_ Patreon key | Full WWE slate. Default `3` (free) returns only the **next** WWE event.      |

The cron (`pro-schedule-rolling`, daily 08:00) is already registered in the
in-app scheduler (`server/src/jobs/scheduler.ts`). It is **double-gated**: it
writes only when `PRO_SCHEDULE_PROVIDER=espn` **and**
`PRO_SCHEDULE_ROLLING_ENABLED=1`.

## Recommended enable sequence (safe)

1. **Dry-run first:** set only `PRO_SCHEDULE_PROVIDER=espn`. The daily job now
   logs what it _would_ create per league and writes nothing. Confirm the counts
   look right (offseason leagues show 0; NBA is offseason until October).
   Or run it on demand:
   ```bash
   cd server && PRO_SCHEDULE_PROVIDER=espn npx tsx src/cron/pro-schedule-rolling.ts
   ```
2. **Go live:** add `PRO_SCHEDULE_ROLLING_ENABLED=1`. Next run (or an on-demand
   `--apply`) populates the configured forward window as event pages. Default is
   **45 days**, which is long enough to cover the full NFL preseason slate:
   ```bash
   cd server && PRO_SCHEDULE_PROVIDER=espn PRO_SCHEDULE_ROLLING_ENABLED=1 \
     npx tsx src/cron/pro-schedule-rolling.ts --apply
   ```
   Optional override:
   ```bash
   PRO_SCHEDULE_WINDOW_DAYS=60
   ```
3. **Full WWE (optional):** add `PRO_SCHEDULE_TSDB_KEY=<patreon key>` for the
   whole WWE schedule instead of just the next show.

## Verify after enabling

- Job log line: `[pro-schedule-rolling] APPLY via composite(espn+thesportsdb:wwe) …`
  followed by per-league `created/updated/skipped`.
- DB: `Event` rows with a non-null `pro_external_ref` and `event_type='game'`.
- Quarantined games are logged with a reason (unmapped team / no venue coords) —
  they are **not** published; investigate if the count is unexpectedly high.

## Rollback

Unset `PRO_SCHEDULE_ROLLING_ENABLED` (and/or `PRO_SCHEDULE_PROVIDER`). The cron
goes dormant immediately. Already-created event pages remain — ingest is
idempotent and never deletes, so nothing is lost by turning it off.

## Coverage notes

- **NBA** is offseason until ~October — it will populate automatically once its
  season opens (no action needed).
- **International games** (e.g. NFL in London/Melbourne, MLB in Mexico City) are
  detected and geocoded to the real venue, not the home stadium.
- **WWE** venues are geocoded per show (touring). A venue that can't be geocoded
  is quarantined rather than mislocated.
