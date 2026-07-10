# VarsityHub — System Architecture (verified)

Canonical reference for how the system is actually built and how its layers fit
together. Verified by reading the codebase and running the full suite (2026-06).
`CLAUDE.md` and `AGENTS.md` point here; keep this the single source of truth.

**One-line:** a modular monolith on **PostgreSQL + Redis + Railway**, with
**Cloudinary** for media and **Sentry** for observability. Not microservices,
not Kubernetes — and that is the correct choice at this scale.

## What each layer actually is

| Layer                    | Reality                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Frontend                 | Expo SDK 54 / React Native, Expo Router (~90 file-based routes)                                                  |
| API / backend            | Express + Prisma, domain-split routes (`server/src/routes/*`)                                                    |
| Database & storage       | PostgreSQL via Prisma (47 models, ~178 indexes, `$transaction` for race-safety). Media in Cloudinary, not the DB |
| Auth & permissions       | JWT + `session_epoch` single-session (`server/src/middleware/auth.ts`), bcrypt, server-side role/plan/ownership  |
| Hosting / deploy         | Railway, single Dockerfile service; `start.sh` runs `prisma migrate deploy` on **every** deploy                  |
| Cloud & compute          | Railway-managed; `railway.toml` `numReplicas=2`                                                                  |
| CI/CD                    | GitHub Actions (18 workflows) + Railway auto-deploy from `main`; EAS for binaries/OTA                            |
| Security & RLS           | Helmet/TLS/JWT; Postgres RLS **enabled-not-forced** (dormant defense-in-depth)                                   |
| Rate limiting            | Redis-backed, fails closed in prod (`redisRateLimit.ts`)                                                         |
| Caching & CDN            | Redis cache (`cache.ts`, DB 2) + react-query (client) + Cloudinary CDN + Expo OTA                                |
| Load balancing / scaling | Railway edge LB; multi-replica safe via `runClusterOnce`                                                         |
| Error tracking / logs    | Sentry + pino-http                                                                                               |
| Availability / recovery  | Health checks, retries, distributed locks, DB backup sync, circuit breaker                                       |

## Buzzword audit (what's present vs. correctly absent)

- **Present:** ACID (Postgres tx), encryption (bcrypt/JWT/TLS/helmet), CI/CD,
  database design (`pg_trgm` trigram search — _not_ Elasticsearch), error logging
  (Sentry/pino), caching (Redis + react-query), CDN (Cloudinary + OTA),
  **message queues = BullMQ on Redis** (this is the SQS/Kafka/RabbitMQ role),
  polling, S3 (GDPR data-export archives only).
- **Substituted / platform-managed:** SQS/Kafka/RabbitMQ → BullMQ; load
  balancer/reverse proxy/firewall → Railway edge; circuit breaker → `circuitBreaker.ts`;
  websockets → `realtime/socketServer.ts` (pilot; polling is the fallback).
- **Correctly ABSENT — do not add (resume-driven complexity at this scale):**
  Kubernetes, Kafka, RabbitMQ, DynamoDB, Elasticsearch, sharding, partitioning,
  microservices, sidecar, SFTP. "cherry-picking" is a git term, not architecture;
  "throughput" is a metric (the real bottleneck was data-fetch latency, not structure).

## Canonical integration patterns — one way to do each thing

These exist so features compose _together_ instead of stacking redundant
mechanisms on top of each other. New code MUST follow the established pattern,
not introduce a parallel one.

1. **Outbound third-party calls → one circuit breaker.** Wrap network calls to
   SendGrid / Cloudinary / Google Play / Apple in `runWithBreaker(name, fn)`
   (`server/src/lib/circuitBreaker.ts`). Stripe is the one exception: it uses the
   SDK's own `timeout` + `maxNetworkRetries` (all 5 client constructions), not a
   breaker — do not also wrap Stripe calls. Don't add ad-hoc retry loops around
   external calls; extend the breaker (now also wraps `geocoding.ts` → Google Maps).
2. **Screen data fetching → react-query, one client.** Use the shared
   `lib/queryClient.ts`; gate the full-screen spinner on `isPending` (never
   `isFetching`). Do NOT add a second QueryClient or a parallel fetch cache.
   `PostCacheContext` is a _different_ concern (cross-screen sharing of already-
   loaded post objects), not a fetch cache — don't duplicate its role in react-query
   or vice-versa.
3. **Realtime → one socket.io server.** `realtime/socketServer.ts` (JWT handshake,
   per-conversation room auth, Redis adapter for cross-replica fanout,
   websocket-only transport). Polling is retained as a **fallback**, not removed —
   new realtime surfaces add a socket channel and keep their poll as backstop.
4. **Startup-once work → `runClusterOnce`.** Anything that must run on exactly one
   replica (scheduler repeatable-job reconfig, data backfills) goes through
   `runClusterOnce` (`distributedLock.ts`), which reuses the existing Redis lock —
   do not invent a new leader-election mechanism. The scheduler _worker_ still runs
   on every replica.
5. **Postgres RLS → enabled-not-forced.** Policies key on
   `current_setting('app.current_user_id', true)`. The app connects as the owner
   and bypasses them (dormant). NEVER `FORCE ROW LEVEL SECURITY` without first
   adding a non-owner DB role + per-transaction `SET LOCAL app.current_user_id`
   middleware — and remember `start.sh` auto-applies migrations to prod on deploy.

## Org → program → team hierarchy (sport-program layer, 2026-07, Phase 0+1)

Teams are grouped one level above the roster by `SportProgram`
(`organization_id`, `sport`, `gender`) — a unique constraint means an org has
at most one program per sport/gender pair (e.g. "Boys Basketball"). A team's
`level` (`varsity`/`jv`/`freshman`/`middle_school`/`unified`/`other`) and
`program_id` are both nullable, additive columns — pre-existing teams are
unaffected until the one-time `server/scripts/backfill-sport-programs.ts`
runs (dry-run by default; it reports unresolved teams and never guesses a
program). Canonical sport slugs live in `shared/sports-taxonomy.json`, the
single taxonomy loaded server-side by `server/src/lib/sportsTaxonomy.ts`
(`normalizeSportToSlug`) and client-side by `constants/sports.ts`, which
feeds the create-team sport picker — same pattern as `shared/` JSON reuse
elsewhere in the repo. Program endpoints: `POST /organizations/:id/programs`
is gated to the org owner or an active org member;
`GET /organizations/:id/programs` is any authenticated user (public read).
This ships dark: billing still counts teams, not programs — the per-sport
billing re-unit is Phase 4 and not yet built.

## Sport-program public page (2026-07, Phase 3)

The program page (`app/program-page.tsx`) is now the canonical **public**
surface for a sport program: collapsible level folders (first one expanded),
a follow button, and the standard loading/error/success/empty states. A
level team keeps its own page (`app/team-page.tsx`) — it still renders
normally standalone — but redirects once to `/program-page` whenever the
team carries a `program_id` (a ref latch plus `params.from !== 'program'`
stop the program page's own link-back to a level team from bouncing right
back to the program page). Three endpoints back this: `GET
/programs/:id/screen-summary` (`server/src/routes/programs.ts` — program +
`levels[]`, each with its serialized team and that level's games, plus
counts), `POST /programs/:id/follow` / `DELETE /programs/:id/follow`, and
`GET /programs/:id` (branded share-landing page, `server/src/routes/
shareLanding.ts`, falls back to a generic landing for unknown ids).

`screen-summary` privacy-filters level teams through the same
`isTeamHiddenFromViewer` gate used by `GET /teams/:id/screen-summary` —
hidden teams drop out of both `levels` and `counts`, and a program that is
all-hidden still returns 200 with `levels: []` (the program object itself
is not private). `followers_count` / `is_following` are computed over ALL
active level teams regardless of per-team visibility, since follow state
isn't private information and needs to stay viewer-stable.

**Follow semantics are union-read / fan-out-write, deliberately with no
`ProgramFollow` table and no feed-clause change.** `is_following` is true if
the viewer follows _any_ level team; `followers_count` is a DISTINCT-user
count across all level teams. `POST /follow` fans out and creates a
`TeamFollow` row for every current active level team (`createMany` +
`skipDuplicates`, idempotent under the `(user_id, team_id)` composite key).
`DELETE /follow` removes follows for all of the program's teams regardless
of team status (so it also clears a stale follow on an archived level
team). Accepted consequence: a level team added to the program _after_ a
user already follows the program does not retroactively inherit that
follower — there is no reconciliation job for this, by design. No
`TEAM_FOLLOWED` notification fan-out on program follow (would spam the same
staff once per level team for a single user action). Group chats remain
per level team; there is no program-level group chat.

Deep links: `/programs` is in `SHAREABLE_PATHS` and the iOS `IOS_PATHS` AASA
allowlist, `AppLinks.program()`, and both `program`/`programs` map to
`/program-page` in `utils/deepLinks.ts`. The Android `/programs`
intent filter added to `app.json` is **native config — it only ships via
`eas build`, never via `eas update` OTA** (an OTA'd client with the new
program-page code, but running on a binary built before this intent filter
existed, simply can't be opened via an Android `/programs` deep link until
the next store build).

## Shared coordination substrate

Everything that must work across replicas coordinates through **Redis**, never
in-process state: rate limiting (DB 1), BullMQ queues (DB 0), cache (DB 2),
distributed locks, and the socket.io adapter. This is what makes `numReplicas>1`
safe. If you add stateful behavior, route it through Redis or it will break under
multiple replicas.
