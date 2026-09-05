# Role, event creation, and startup remediation — 2026-09-05

Worktree remediation from audited HEAD `374a785b`. This handoff records implementation and local evidence; it is not a production deployment or device acceptance claim. Root owns the integrated release gates and cutover. No production writes, messages, provider calls, commit, or deployment were performed by this lane.

## Organization review links — ROLE-01 / ROLE-02 / ROLE-03

Email review capabilities now bind organization, request, reviewer user ID, exact application attempt stamp, and action. The current canonical owner is checked before review and again in the shared app/email transaction. Legacy links without bindings fail closed with instructions to open Organization Settings → Join Requests. Reapplication invalidates an earlier attempt's links.

The shared transaction locks the Organization row, rechecks authority/self-review, and atomically persists the guarded pending decision, membership, coach state, audit, and in-app notification. Ownership transfer uses the same row lock and rotates pending application stamps. Transfer-back cannot resurrect links. Serializable conflicts retry at most three fresh transactions; exhausted conflicts return retryable503. The persisted decision consumes both links for that attempt; a rolled-back decision remains retryable. External email/push work runs only after the winning commit, so losing retries do not repeat side effects.

Canonical ownership prefers the active owner membership and falls back to `league_owner_id` only if no active owner membership exists. `organizationAuthorization`, `teamAuthorization.isOrgOwner`, join-request recipients, and review audit actors share this resolver. A stale pointer cannot create a second owner. Batch ownership checks are bounded to5,000 IDs; privacy list callers chunk larger candidate sets.

Admin allowlist/demo policy and ordinary owner versus verified platform-admin boundaries are unchanged. `reviewTokens.ts` and unrelated token consumers are unchanged. The platform-admin event-post-access endpoint still rejects an ordinary organization owner.

### Role evidence

All database evidence used disposable localhost databases named `varsityhub_audit_*`, with environment-file loading disabled and test mail suppression enabled.

- Original before-fix evidence: three failing safe assertions plus five passing controls, `roles-before.json/log`.
- Focused five suites:122/122. Covers owner transfer, reapplication, consumed/stale links, transfer-back, simultaneous approve/reject, actual PostgreSQL lock-wait authority race, canonical legacy recipient/audit actor, and FK-injected transactional rollback followed by retry with the same token.
- Final canonical owner group:34/34 across five suites, including stale pointer denied and active membership owner admitted through both organization and team helpers.
- Final access matrix:46/46. Its pending RSVP fixture is now explicitly proven to exist and be pending; unrelated users receive the intended404, creator receives400, and no RSVP is written. Other404 classifications remain missing-route flags.
- Canonical authorization helper real-DB matrix:39/39; final team-helper delegation is covered by the later canonical owner group.
- Latest deduplicated results across23 distinct role/auth suites:334 passing assertions. This combines recorded runs, **not one passing combined sweep**. Earlier broad batches had migration-fixture, transient authorization, and stale route-classification failures; original logs are retained.
- `coach-flow-invariants.test.ts` now exercises both organization create aliases over HTTP/DB with forged owner/admin-approval inputs. The release `verify:coach-approval` script follows both aliases through shared route → preflight → conditional pending transaction; all9 checks pass.
- Role server TypeScript and formatting checks passed. Full integration belongs to root.

Local evidence directory: `/tmp/varsityhub-remediation-2026-09-05/`. Detailed role chronology and exact safe command are in `role-fixes.md`; role-focused logs/JSON are retained there.

### Role release limits and rollback

No role migration or backfill is required. Ownership transfer refreshes pending request `created_at` ordering because this existing field is also the application-attempt stamp. Current owners can review pending requests in the app; no production email reissue was sent.

The unrelated additive ad-hold migration was applied only to the disposable roles test database to match the shared Prisma client; production sequencing/rollback belongs to the payment lane. Rolling code back to the original role handler restores revoked-owner/replay vulnerabilities. Prefer forward repair or temporarily disabling the affected email mutation handlers while app review remains available. Real mailbox delivery and production multi-process operation remain runtime checks.

## PDF pages12–16 — event creation

The primary quick form already supported manual opponents, a home default, and required location in the UI. The missing behavior was in payload forwarding, shared presentation, and duration selection:

- Discover and season management now use `buildQuickGamePayload`, preserving the local selected clock time, actual venue for each event type, coordinates including zero, manual opponent names, and the creator team's correct home/away ID. Discover previously omitted the required location. Empty locations are rejected; no fabricated venue is sent.
- QuickAdd, AddGame, and standalone fan/coach creation expose5/12-hour options, with5 selected for new forms. Duration is stored on the existing `Event.live_window_hours_after_start` through single-game, bulk-game, standalone-event, and edit routes. Invalid duration values and blank edit locations are rejected server-side.
- The exact closing semantics are **5 or12 hours after scheduled start**. Existing geofencing intentionally has no early cutoff; that earlier owner rule remains intact, as do venue checks and earned posting grace. This does not introduce a new pre-start boundary or claim a total elapsed window beginning before kickoff. Existing3-hour defaults and18-hour special overrides remain unchanged when the optional field is absent. Editing a legacy event preserves its window until a new choice is made.
- Both competitive and noncompetitive forms show the banner control even before an opponent is entered. The shared frame is16:9 across form preview, feed card, and detail banner, sized from available width instead of a fixed device height. Existing banner selection/privacy/collage behavior remains intact.
- `ImageEditor` offers crop mode through `ImageCropEditor`, retaining the existing decorative mode for other callers. Pinch zoom/drag clamps to image bounds and exports a crop from original pixels, up to1,200 pixels wide, rather than a low-resolution screenshot. Zoom buttons/reset provide another way to adjust the frame. Failed uploads retain the old banner and keep the editor open.
- Browser photo buttons open the file picker directly; picker/crop/upload failures render visible errors. Native action menus remain available. Form saves await success and retain entered values on a failed request.

### Event evidence

- Five distinct focused client suites:27 assertions pass after deduplication. `events-client-focused.json` covers payload/local-time/manual opponent/venue mapping, crop geometry, banner persistence, and detail privacy contract. `events-web-crop-final.json` supersedes the QuickAdd results and adds actual shared-field crop/upload/browser-picker interactions. There is no claim that mocked image manipulation or upload called a real provider.
- Both client and server TypeScript commands completed with exit0 after event source freeze; logs `events-client-tsc-final.log` and `events-server-tsc-final.log`.
- Owned event implementation ESLint completed0 with no warnings; formatting and `git diff --check` passed.
- Existing live-window serialization and geofencing/grace suites passed44 assertions in the earlier focused run. The approval-write parity guard was updated to examine mutation `data` assignments, so an approved-only privacy read filter does not falsely fail it; its four assertions pass.
- Real Express HTTP + isolated PostgreSQL:9/9 pass, `events-server-http-narrow.json/log`. Covers5/12-hour linked game persistence and serialized cutoffs, manual opponent/banner/venue preservation, standalone noncompetitive creation, existing18-hour override preservation on unrelated edits, explicit game/event duration updates, invalid values, blank locations, and bulk duration forwarding. The payment lane repaired the harness after initial Jest ESM linking and invalid fixture failures: sequential imports, real games/events routes with auth and parental-consent middleware, and the actual PATCH event-edit method. No route or database implementation mocks were used. Initial failing logs are retained and are not counted as acceptance evidence.

### Event release limits and rollback

No event schema migration, data backfill, new package, or native configuration is required. Server deployment enables API persistence; installed clients require the production client update for the new controls/presentation. Native pinch/camera/iCloud picker behavior, actual Cloudinary upload, and rendered device screenshot acceptance have not been exercised here. Crop math and component interaction tests do not replace device UAT. Rollback should retain server support for already stored duration choices and required venue invariants.

## Independent review

Privacy source review found and resolved the oversized ownership batch call; no other blocking finding in the reviewed entity visibility, games/events, OG, or share landing changes. Settings/AuthProvider review found the queue, account-keyed screen state, session guard at send/retry/completion, and stale `/me` revision handling coherent. These were independent source reviews, not duplicate claims of running the other lane's entire tests.

## Startup readiness

The old startup placeholder returned `/health`200 before migrations and the real API. It now returns503 with `Retry-After:15` for all paths. Exhausted primary migrations stop startup instead of launching against an unverified schema; the actual failed command status is preserved. Historical resolve and failure diagnostics are bounded, and timeout commands include a five-second forced-kill backstop. Backup reconciliation remains nonfatal and bounded. Root owns the Railway healthcheck timeout adjustment to600 seconds.

Default maximum pre-API work is about515 seconds including forced-kill allowances: historical resolve35; migrations up to295; backup185. A failed primary sequence skips backup and exits after bounded diagnostics. Custom environment timeout/retry overrides can exceed the default budget and require matching deployment settings. A command-availability check fails clearly if `timeout` is missing. Docker's existing Debian-based startup already used GNU timeout; the local Docker daemon was unavailable, so no image execution is claimed.

`startup-readiness.test.ts` exercises the actual placeholder over localhost HTTP for health variants and API paths, and runs the actual shell with stubbed Prisma/node commands to prove failed migration retries never start the API, real exit status remains visible, and backup failure does not block a successfully migrated API. These tests perform no database/provider calls. Shell syntax check passed; final3/3 startup assertions are recorded in `startup-readiness.json/log`.

A migration failure now leaves the new deployment unready. An initial deployment or unavailable prior replica can therefore remain unavailable until repaired; this is preferable to serving an incompatible schema. Root must verify migration history before cutover and preserve the payment lane's compatible-inventory rollback constraints. No old checkout writer should be reintroduced after new ad-hold writers are active.

## Final integration follow-up — team/program follow readiness

The full client sweep exposed a real pre-existing race in `app/team-page.tsx`: the team summary renders before the program summary, so an early press saw zero sub-teams and called `Team.follow(team1)` instead of following the whole sport. Waiting in the test alone would have hidden this user-visible defect.

The button and its handler now wait until the program lookup can determine the target. A valid cached summary for the same program remains usable during a background refresh. Failed or malformed metadata (missing levels or mismatched program ID) renders a visible retry and cannot fall through to a team mutation. A successfully resolved single-team program retains direct team follow; multiple sub-teams use program follow. No post mapper fields changed.

`team-follow-before.json/log` preserves the failing delayed-summary readiness assertion; the original isolated failure log also records the wrong `Team.follow(team1)` call. `team-follow-after.json/log` passes7/7: whole-sport follow, delayed summary, direct callback invocation despite disabled UI, failed lookup retry then single-team follow, malformed missing-levels/wrong-ID responses, and existing redirect/plain-page controls. Client TypeScript and source ESLint passed; root owns the final integrated rerun and production client update.

The full server sweep also exposed three stale role test contracts. `canArchiveTeam` now models actual role/status filtering and the canonical owner query result, with active owner/coach permitted and manager/assistant/inactive memberships denied. Membership status guards pin the active-owner SQL and legacy precedence. Notification guards parse actual function bodies and require both decisions to await the same transaction's notification/audit writes and propagate failure; the existing real FK rollback/retry test remains intact. These three suites pass28/28 in `roles-integration-followup.json/log`. These later counts are recorded separately and must not be added to the earlier334 without deduplicating suite overlap.
