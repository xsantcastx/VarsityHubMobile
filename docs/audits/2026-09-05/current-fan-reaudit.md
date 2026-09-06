# Current fan and tab re-audit — September 5, 2026

Source: `fccdc186`, the newest fetched branch; the delivered web bundle was checked independently. The exercised privacy and messaging boundaries pass. This does not certify native camera/map/media playback, device push, or every possible fan state.

Threat model: private/blocked author and team disclosure, direct-ID bypass, stale cross-process caches, unsafe OG/share fallback, mixed visibility batches, adult/minor/missing-DOB messaging, conversation IDOR and deep-link injection.

## Enumerated scenarios and results

| Area                                | Required local cases       | Result        | What was actually exercised                                                                                                                                                                               |
| ----------------------------------- | -------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture/content privacy             | 84                         | **84 passed** | Guest/fan/authorized staff/follower/contributor reads; private home/away/event/game, summaries/stories/media/OG, private or blocked authors, expiry, vote/RSVP batches, opponent consent, public controls |
| Direct messaging                    | 15                         | **15 passed** | Adult↔minor with accepted/missing follow, null DOB, recipient policy, both block directions, forged/foreign conversation, 5001-character rejection                                                        |
| Cross-process privacy               | 9                          | **9 passed**  | Real PostgreSQL plus dedicated Redis and two Node processes; restrictions apply to warmed payloads and deliberately repopulated stale Redis values                                                        |
| Fan-related client regression suite | 20 suites / 137 assertions | **Pass**      | Rendered smoke/error states plus mapping, program labels, query, deep-link and notification/upload contracts; network/native dependencies mocked                                                          |
| Five visible tabs × three roles     | 15 browser checks          | **15 passed** | Actual published web bundle with synthetic fan/coach/org-owner state and isolated real API/database; page text, no unexpected auth/onboarding redirect or new page error                                  |

The 84 privacy assertions and 15 DM assertions execute real requests against the production Express app module. Synthetic users are seeded locally. The Redis process is isolated at port 6408, and the database is `vh_reaudit_fan_20260905_tabs`. This is stronger than source-only tests but not a production multi-replica load run.

## Notes reconciliation

- Historical FAN-01/02/03 privacy bypasses are **Closed for these local regression cases**, including stale-cache and OG branches.
- FAN-04 profile load error is **Closed for the rendered regression**; “No posts yet” is not accepted as success after a failed query. Browser checks additionally verify own profile handles for all three personas.
- September 3/5 map/filter/category/collage/preview notes retain local/component evidence. **Native map safety is Open** after the current Sentry review: a real iOS crash reaches AIRMap insertion following event discovery. See `current-sentry-reaudit.md`.
- DM composer currently allows 5000 characters and server rejects 5001. The old 1000-character mismatch is **Closed**. A previous matrix's different rate-limit target is a **Policy Decision**, not a test failure.
- The older `&amp;` sanitization claim is stale for the current `sanitizeHtml.ts`, which decodes stripped text entities; the current baseline regression suite passes.
- Direct Instagram Stories and broad minor-league ingestion remain **Deferred Features**. The notes explicitly preserve these gaps; they are not “fixed” by sharing a link or listing leagues.

## Efficiency and remaining acceptance

The code uses bounded page sizes, shared query state and server bundles in the exercised flows; the cross-process security check deliberately refuses stale authorization data. This audit did not establish a production latency/memory budget, run representative media/peak load, or measure battery/frame rate. The local development web server hit its configured 8 GiB heap limit while navigating; that is recorded as a development/test runtime failure, not attributed to the production mobile process.

Native/provider fan acceptance groups remain **0/6** in this run: camera/library upload and geofence; photo/video playback and collage; map/location/filter interaction; native share/deep link; two-device messages/reconnect; APNs/FCM notification delivery/cold-start tap. Existing dated simulator notes remain historical evidence, not a fresh run.

Reproduction scripts: `server/scripts/e2e/audit-current-fan-privacy.mts`, `audit-current-fan-dm.mts`, `audit-current-privacy-redis.mts`. Set loopback DB, both env-file paths to `/dev/null`, `NODE_ENV=test`, `EMAIL_PROVIDER=test`, and a local JWT secret of at least 32 characters. The Redis script also requires `REDIS_URL=redis://127.0.0.1:6408`.

Logs: `/tmp/vh-reaudit-fan-20260905/{privacy,dm,client}.log` and `/tmp/varsityhub-current-reaudit-20260905/privacy-redis.log`. Scenario names/results are retained in `current-reaudit-evidence.json`. No production account, content, grant, message or email was created.
