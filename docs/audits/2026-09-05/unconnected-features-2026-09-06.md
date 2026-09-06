# Connection audit — September 6, 2026

Read-only source and production-data audit at source commit `31f3a8ed`.
No simulator, production mutations, or deployment. These findings are not a
complete certification of every application flow.

## Confirmed coverage gaps

Production has 73 active SportsLeague entries. Of these, **60 have no provider,
zero related Event rows, and zero SportsIngestRun rows**: 15 minor, 10 major,
35 college entries. Counts are catalog entries, not distinct sports. FBS/FCS
subdivision entries are empty while the combined NCAA football importer works.

Evidence: `server/src/lib/sportsLeagueCatalog.ts` defaults every entry to
`active: true`; `server/src/lib/proSchedule/espnAdapter.ts` defines the smaller
actual ESPN import set; `server/src/cron/pro-schedule-rolling.ts` iterates
`adapter.leagues`, not all active catalog entries. Thus a successful scheduled
job does not prove coverage for all catalog entries.

- **MLS NEXT Pro:** active catalog entry, provider null, zero events/runs.
- **MLS NEXT youth:** no matching catalog entry or automatic importer found.
  The only production league matching “MLS NEXT” is `mls_next_pro`. This does
  not rule out manually created club games; it establishes absent automatic
  competition coverage. MLS NEXT youth and MLS NEXT Pro must remain distinct:
  [MLS NEXT](https://www.mlssoccer.com/mlsnext/),
  [MLS NEXT Pro](https://www.mlsnextpro.com/about/).
- **Major leagues:** MLS, NHL, NWSL, UFC, PGA Tour, LPGA, NASCAR Cup, IndyCar,
  Formula 1, USL Super League have the same empty/unconnected catalog state.
- **Other minor leagues:** all MiLB tiers, AHL, ECHL, SPHL, FPHL, NBA G League,
  USL Championship/League One, NISA and Arizona Fall League are catalog-only.
- **NCAA:** examples without automatic coverage include men's/women's soccer,
  volleyball, lacrosse, softball, women's hockey, and field hockey. The working
  NCAA adapters are football, men's/women's basketball, baseball and men's hockey.
- **FIBA women's World Cup:** 24 events exist, but this is a one-off seed path
  (`server/scripts/one-off/one-off-events.data.ts`), not a rolling FIBA importer.
  Zero ingestion-run rows do not mean those seeded events are absent.

The backend already distinguishes `provider_backed`, `event_seeded`, and
`catalog_only` in `/events/sports-leagues` (`server/src/routes/events.ts:63`).
The client type includes that status, but no use of `schedule_status` or
`has_current_events` was found in app/components/hooks. Availability metadata
therefore does not currently explain missing coverage in the user interface.

## Other confirmed incomplete connections

1. **Email health monitoring targets the legacy queue.**
   `server/src/app.ts:524` starts `startOvernightMonitoring`; its checks in
   `server/src/cron/overnightTasks.ts:62` inspect `emailQueue`. However
   `server/src/jobs/queues.ts:232` explicitly documents that queue as having no
   producer/consumer for real delivery. Real mail uses EmailService and
   SendGridProvider. Queue health is not proof of email delivery health. This
   finding does not assert emails are failing; other provider checks exist.
2. **Season standings and playoffs are deferred UI features.**
   `app/manage-season.tsx:1459` and `:1488` render unconditional Coming Soon
   placeholders for these tabs. They are honestly labeled, but unfinished.
3. **Program-follow overflow lacks its stated recovery path.**
   `server/src/lib/programFollowFanout.ts:34` caps propagation to 5,000 users;
   the overflow message directs an operator to a reconcile script that was not
   found. Followers beyond the cap can miss a newly added team's content.
   Production currently has one ProgramFollow row total, so this is a latent
   scale gap rather than an observed current omission.

## Excluded from confirmed live bugs

Analytics/media queue helpers have no live callers found, and the legacy email
queue has no enqueue API. Unused scaffolding is not evidence that today's media
uploads or analytics are silently queued and lost. Existing contact/feedback
screens do call backend APIs; their input placeholders are not missing features.

## Repair priorities

1. Publish an accurate coverage inventory and connect the intended schedule
   sources. Do not rename MLS NEXT youth into MLS NEXT Pro or fabricate games.
2. Add a release/operational coverage check that compares intended supported
   leagues with actual adapter registrations and recent import results. Preserve
   legitimate offseason zero counts and identify manual coverage separately.
3. Use availability metadata in relevant empty states so no scheduled games and
   no schedule connection are distinguishable.
4. Point email health monitoring at actual delivery evidence; retain provider
   checks rather than adding a second email mechanism.
5. Finish or hide deferred season tabs, and implement resumable program-follow
   reconciliation before programs approach the follower cap.

Earlier feed/map parity checks established consistency of returned records,
not completeness of league coverage. Earlier database health checks established
database operation, not whether every product feature had a producer and consumer.
