# Current production matrix re-audit — September 5, 2026

**The latest VarsityHub code does not earn an all-clear.** Normal fan/coach/organization-owner boundaries and previously fixed privacy/email cases pass the exercised scenarios, but new tests reproduce three team/game defects, two ad refund defects, and a published settings rendering error. Sentry additionally confirms a recent production iOS map crash. Production Download My Data remains unavailable because dedicated private storage is unconfigured.

This is an audit with repeatable expected-behavior regressions and evidence, not a product-fix release. No product source, production account/payment/grant, email, deployment, Git commit or push was changed.

## Exact version tested

| Surface               | Fresh observation                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source                | Clean at start; `fix/desktop-notes-map-collage-share`, `fccdc186d07d8f7588f0195e9655d0eb3ecb70a3`. Both remotes fetched twice. HEAD still equals the newest fetched fork branch.                                                                                               |
| Older main            | `origin/main=cc02129b`, 175 commits behind HEAD; using main would have missed your latest fixes.                                                                                                                                                                               |
| Native production OTA | EAS read-only `update:list`/`update:view`: production group `7e09e4a5-4dd3-4437-bf3b-a32535ab96e1`, runtime `1.0.5`, both iOS/Android, client source `cab5b133`. Current client product files are unchanged since that source.                                                 |
| Server                | Latest Railway API deployment `1afb5524-95d5-4242-8f8d-a8b1f92072e4`, SUCCESS, Sep 5 21:40:18 UTC, CLI source label `e7f38857`. Current server product files are unchanged since that commit. CLI source labels are not independent byte-for-byte source attestation.          |
| Website               | Fresh GET of live settings HTML and JS gives SHA-256 `70e7ad5835d5236677b7fc3202698a602bbb35b9a673d846280fa0eab38d4258`, matching the latest publication record. Browser cases run that actual live bundle with all API requests redirected to isolated current-source API/DB. |
| Health                | Fresh public HTTP 200 and authenticated readiness true; `dataExportStorage:false`. Health does not certify an authenticated product journey.                                                                                                                                   |
| Installed device      | Sentry reports build 56; events lack OTA identity. No claim that every installed device is running the latest OTA.                                                                                                                                                             |

Only documentation follows the deployed server source on the audited branch. The earlier OTA's client code also matches current client code; the intervening product change was server export preferences, not a missing client publication.

## Findings to address

| ID         | Finding / impact                                                                                                                               | Evidence and next repair                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ROLE-C01   | **High: bulk games bypass organization approval.** Same coach/payload gets single-create 403 but bulk-create 201 with approved persisted game. | [Role report](current-roles-reaudit.md); use one per-row org-approval pipeline. Real client path: `manage-season` → `Game.bulkCreate`. |
| AD-C01     | **High: PaymentSheet refund returns 500 indefinitely.** Completed purchase lacks the dedicated PaymentIntent reference used by refund lookup.  | [Ad report](current-ads-reaudit.md); write reference atomically and reconcile existing missing references.                             |
| AD-C02     | **High: refunding an older overlapping ad booking removes a later paid date.** Both purchases complete, but only first provenance survives.    | [Ad report](current-ads-reaudit.md); prevent duplicate paid-date purchase or represent overlap losslessly.                             |
| NATIVE-C01 | **High: real production iOS map crash.** Nil child insertion in AIRMap after event-discovery HTTP 200; latest at Sep 5 23:12 UTC.              | [Sentry report](current-sentry-reaudit.md); native reproduction and fix validation required. Exact OTA attribution unavailable.        |
| ROLE-C02   | **Medium: mixed-team bulk game scheduling returns 500.** `pending` is written to the wrong Event enum; transaction rolls back.                 | [Role report](current-roles-reaudit.md); map lifecycle fields consistently with single-create.                                         |
| ROLE-C03   | **Medium: legacy org owner denied team admin summary despite valid edit rights.**                                                              | [Role report](current-roles-reaudit.md); use canonical owner resolver in viewer access.                                                |
| SET-C01    | **Medium/low: published Request to Host Event raises hydration error.** Form renders after client regeneration.                                | [Settings report](current-settings-reaudit.md); make initial rendering deterministic, then test submission.                            |
| OPS-C01    | **Blocked feature: production data export storage absent.** UI correctly says unavailable.                                                     | [Settings report](current-settings-reaudit.md); configure dedicated private storage and exercise real ZIP lifecycle/device save.       |
| OBS-C01    | **Attribution gap: native build number does not identify OTA release in Sentry.**                                                              | [Sentry report](current-sentry-reaudit.md); add update/runtime/channel and server deployment identity; verify symbolication.           |

A separate production EXC_BAD_ACCESS startup/teardown crash also appears today, before the latest publication. It is retained as an open native investigation, not merged into the map crash or declared fixed by recent JS changes.

## Tab-by-tab scenario outcome

| Tab or connected workflow | Current evidence                                                                                   | Remaining issue/limit                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Feed                      | Published page for all three roles; local feed/privacy/block regressions                           | Populated physical-device performance and every feed combination not certified      |
| Highlights                | Published page for all three roles; mapper/caption/preview and private-share regressions           | Real video playback and native share destination acceptance pending                 |
| Create                    | Published entry for fan/coach/org owner; existing post/event ownership/validation tests            | Bulk season-game defects; camera/library/provider/geofence acceptance pending       |
| Discover/map/game/event   | Published Discover for all roles; 84 private-resource assertions                                   | Actual native map crash; data-provider completeness is not proven by empty fixtures |
| Profile                   | Published username/profile for all roles; rendered load/error regression                           | Native mixed-media layout, user editing permutations not fully exercised            |
| Messages/notifications    | 15 HTTP/DB DM assertions, client routing tests, existing group/access suites                       | Two-device realtime, notification receipt and cold-start taps pending               |
| Coach/team/organization   | 136 targeted regression assertions, 39 helper scenarios, 5/8 new boundary cases                    | Three role/game findings; real owner email delivery pending                         |
| Settings                  | Privacy and notification persistence for all roles; 12 fan destinations; full component/API suites | Host-request hydration and unconfigured export; see detailed coverage table         |
| Ad booking/My Ads         | 17/19 new persona/lifecycle scenarios; existing date/inventory/payment regressions                 | Two refund defects; 0/9 real platform/persona purchase acceptance cases             |

## Gates actually run

- Full client Jest: **218/218 suites, 1,541/1,541 tests passed**. Existing force-exit/open-handle warning remains harness debt.
- Baseline full server first invocation: **316 passed / 5 failed suites**. Initial failures included an audit environment mistake (short JWT secret and disabled rate limits), plus colliding truncated fixture usernames. Correct-environment targeted reruns and a fresh isolated critical-flow database yield **321 distinct baseline suite paths / 2,974 assertions passing**. This is a merged final result across runs, **not a clean first full-suite pass**.
- New team scenarios: **5 passed / 3 failed**; new ad scenarios: **17 passed / 2 failed**. They deliberately remain red as current defect evidence. They are separate from the pre-existing baseline count.
- Dedicated fan checks: **84/84 privacy**, **15/15 DM**, **9/9 two-process Redis/privacy**. Separate focused client subset: 20 suites / 137 tests (already overlaps full client coverage).
- Published-bundle browser: **35/36**; fails only host-request hydration after correcting harness setup. Baseline pages/labels are not counted as complete purchase or notification journeys.
- Client and server `tsc --noEmit`: exit 0. Server typecheck repeated with the new regression files: exit 0.
- ESLint: exit 0. Navigation audit: 0 REVIEW. Conflict scan: no markers. Error-envelope guard: no new violations compared with original audited `ec27781e` (default HEAD-parent check had no server diff). Secret-literal scan passed; its implementation scans a narrow token pattern, not every class of secret.
- Formatting is checked after formatting only the new audit artifacts. Its initial run saw an in-progress unformatted audit document; no product formatting sweep was performed.

Final durable scenario names, statuses and gate limits: [current-reaudit-evidence.json](current-reaudit-evidence.json). Detailed temporary logs are under `/tmp/varsityhub-current-reaudit-20260905`, `/tmp/vh-reaudit-roles-20260905`, and `/tmp/vh-reaudit-fan-20260905`.

## How to use the notes now

The September 5 original audit is a pinned **before-fix** report, not the current open-bug list. Its privacy, email, settings-save and theme regressions were rechecked and pass locally. The latest remediation ledgers are more reliable about publication and explicitly pending device/provider work, but their broad payment guarantees are incomplete for AD-C01/C02. Preserve the old evidence and add these cases; do not relabel all earlier failures as still open or all newer notes as end-to-end certified.

The September 1 App Verification Matrix and August/March “current main” summaries are **Stale as release sign-offs**. Some statements are directly superseded: 1000-character DMs, entity-encoded names, old role ownership and old publication commits. The current source/tests and new case failures take precedence. The source-of-truth instruction file for this audit is AGENTS.md, not old prose pointing to CLAUDE.md.

Direct Instagram Stories and most minor-league automatic ingestion remain **Deferred Features**. Broad “no refunds” wording, the older DM rate target, and App Review's full platform-admin inclusion remain **Policy Decisions**. Organization owners do not become founder admins, but the hardcoded platform allowlist intentionally includes founder, customer service and demo review identities; “founder only me” is not literally the implemented account list.

## Closure and efficiency limits

No finite matrix proves every possible state. Required cases that were not run remain in the denominator: fan native/provider groups **0/6**, role email/native delivery **0/1**, real ad platform/persona purchases **0/9**, export activation/device ZIP acceptance **0/2**. These groups are distinct from the passing test counts above. Authenticated production persona journeys, provider sandbox receipts/refunds, physical iOS/Android acceptance, backup restore/rollback and representative load remain unverified in this run.

The audit observed bounded reads, shared query clients and atomic inventory/role decisions, but made no production performance certification. Local Expo web exhausted an 8 GiB heap; the actual published bundle passed the subsequent browser checks except SET-C01. Sentry's native crash and historical app hangs need device profiling. Existing shared pipelines should be reused to repair the demonstrated sibling-route drift; adding another cache/retry/authorization mechanism would not resolve it.

Repair payment provenance and organization-approval gaps first, while reproducing the native crash on the affected build. Then fix mixed scheduling, legacy admin access and host-request rendering, activate private exports, and execute the explicit provider/device rows. Any eventual fixes need normal hooks, tests and the canonical release workflow; this audit did not publish a new app version.
