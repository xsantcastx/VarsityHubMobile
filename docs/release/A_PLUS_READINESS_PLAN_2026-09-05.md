# VarsityHub A+ readiness plan

Prepared September 5, 2026 from the [tab-by-tab audit](../END_TO_END_FLOW_MATRIX_AUDIT_2026-09-05.md). The original milestone plan below is preserved. The dated execution status records subsequent remediation; it does not certify the A+ grade or a deployment.

The remediation baseline is `374a785b`, one commit after audited `ec27781e`. That commit changes web icon resolution and removes its shim. The earlier audit remains evidence for its pinned version; final release/version/browser evidence is maintained separately by the release owner.

## Published remediation — September 5

The subsequent session-recovery step is now published from `8b8543e3`: API `54143be0`, OTA `1795b001` for iOS/Android runtime 1.0.5, and the matching website. Full client tests pass (217 suites / 1,534 assertions), focused server tests pass (six suites / 38 assertions), and five iPhone simulator lifecycle/recovery scenarios pass. The physical iPhone's approximately weekly sign-out still needs observation. See the [session evidence](../audits/2026-09-05/session-restoration-remediation.md).

The next bounded settings repair is [data-export readiness](../audits/2026-09-05/data-export-readiness-gap.md): private export storage is unconfigured, the worker lacks production startup wiring, and availability/expiry need enforcement. The advertised queued export cannot be marked complete from its current tests or whole-API health alone.

The earlier remediation was published for owner testing: API `6bb32c40` / Railway `44e31b96`, client `e6af820d` / production OTA `6f4b1579` for iOS and Android runtime 1.0.5, and the matching website. Final evidence is 215 client suites / 1,511 assertions, 319 server suites / 2,982 assertions (aggregated reruns), passing type/build/runtime gates, and 14 live browser route/theme checks. See the [release record](../audits/2026-09-05/release-verification.md) and [device handoff](../audits/2026-09-05/device-test-handoff.md).

This supersedes the publication-pending language in the historical checkpoint below. A+ remains unmet: direct Instagram Stories and authorized minor-league population are not implemented; native/provider journeys and operational/performance/recovery acceptance remain open. The existing review-account privilege and refund-copy questions remain explicit product decisions.

## Execution status — September 5 remediation checkpoint

**A+ is not yet earned.** Critical reproduced code defects have local fixes and regression evidence, but native journeys, actual provider transactions, remaining data coverage and operational drills are not all proven. Passing test counts do not replace those gates. This status describes the working-tree remediation, not the final integrated commit or production availability.

| Milestone / package                            | Current status                                          | Evidence and remaining gate                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0: baseline and safe assertions                | Implemented for owned audit findings                    | Original before-fix reports retained; forensic privacy/role/payment/settings assertions now expect safe behavior. Dedicated local databases were used. Final combined suites, repaired contract drift and exact release version remain release-owner gates.                                                                                                                                                                                                       |
| 1: FAN-01/02/03 privacy                        | Remediated and independently reviewed                   | Shared game/event/OG/story policy, filter-before-limit, current authorization reads and bounded cached-game revalidation. 84 actual HTTP/DB checks, 9 real-Redis/two-process checks, 15 DM checks and 126 distinct focused server assertions represented by final runs. See [privacy/settings remediation](../audits/2026-09-05/privacy-settings-remediation.md).                                                                                                 |
| 1: ROLE-01/02/03                               | Remediated and independently reviewed                   | Attempt/reviewer/current-owner binding, transactional token claim/replay safety and canonical legacy ownership. [Role report](../audits/2026-09-05/roles.md) records 334 passing assertions across 23 distinct suites represented by final runs, plus a 39-case real-DB helper matrix. Actual delivered email/device scenarios remain separate.                                                                                                                   |
| 1 and 3: SET-01/02/03, THEME-01/02             | Remediated and independently reviewed                   | Provider-owned serial saves, complete rollback/canonical refresh, account/session isolation through 401 retries, explicit save status and application theme. Seven focused client suites/33 tests pass. A subsequent Followed Teams recovery/account-cache fix adds three passing behavior cases (affected group: three suites/eight tests, overlapping earlier evidence). Killed-process/offline durability and native theme/lifecycle journeys remain unproven. |
| 2: ADS-01–05, PAY-01/02                        | Remediated with local acceptance and independent review | Transactional capacity, separate per-purchase holds, scoped refund/entitlement handling, retryable callbacks, real-date validation and checkout handler corrections. Payment lane reports 162 distinct tests across 17 suites represented by final runs. Additive `20260905000000_ad_purchase_holds` migration and safe old/new worker rollout required; real provider sandbox transactions/refunds remain open.                                                  |
| 3: FAN-04 and feed/map recovery                | Remediated locally                                      | Profile active-tab errors retry correctly; feed waits for event enrichment before empty state; map uses per-date query keys and visible retry, with Major/Minor/NCAA chips. Root UX run: 8 suites/25 tests; map run: 5 suites/28 tests. Groups overlap other runs. Native map/share/upload verification remains open.                                                                                                                                             |
| 3: latest PDF event forms/crop                 | Remediated locally; client and HTTP/DB checks pass      | Shared five/12-hour after-start picker, home defaults, location validation, manual opponent, 16:9 banner/crop and browser picker. Event lane reports 27 distinct client assertions across five suites plus 9/9 actual Express/PostgreSQL assertions after resolving the ESM harness collision; real routes and DB remain exercised. See [per-note ledger](../audits/2026-09-05/notes-remediation.md).                                                             |
| 3: production posting grants                   | Persisted prerequisites verified, actual media UAT open | September 5 read-only observation found all three intended unlock/marker pairs, expiring September 12 around 03:22 EDT. Exact timestamps and IDs are in [shipped-notes evidence](../audits/2026-09-05/shipped-notes.md). No blanket admin exception or new grant was added in remediation.                                                                                                                                                                        |
| 3: direct Instagram Stories and minor coverage | Open                                                    | No dedicated native Stories integration. Fifteen minor catalog rows have zero current production events in the preflight snapshot. [Minor provider plan](../audits/2026-09-05/minor-league-ingest-plan.md) identifies an MLBAM commercial/bulk authorization gap; no new source enabled.                                                                                                                                                                          |
| 4: physical devices/providers/shared state     | Partial                                                 | Local real-Redis privacy revocation and real-DB races pass. Nine local Chromium navigation checks completed with 79 API requests and zero captured page errors, plus persisted/reloaded privacy and dark-subpage observations; redirects and screenshots are retained in the notes ledger. Installed iOS/Android, actual stores/Stripe purchases, live messages/push/email, storage exports and cross-device session journeys are not established by these runs.  |
| 5: operations/performance/recovery             | Partial                                                 | Read-only ad inventory preflight found no immediate production repair need. Privacy query costs are measured only on a small diagnostic dataset. Workload budgets/load proof, backup restore, real alert/recovery drills and production rollback rehearsal remain open.                                                                                                                                                                                           |
| 6: release and A+ decision                     | Not signed off by this document                         | Release owner records integrated checks, release commit, Railway/OTA/web versions, migration postflight and runtime/UAT/rollback evidence separately. No full-grade claim until required unknowns close.                                                                                                                                                                                                                                                          |

A subsequent team-page follow review found a separate program-summary race: the follow action could choose Team instead of Program while metadata was pending. The role lane now gates that action until valid metadata is ready and provides retry on failed/malformed data; seven component regressions pass. See [roles/events remediation](../audits/2026-09-05/roles-events-remediation.md). This is additional local behavior evidence, not new provider/device coverage.

Final privacy-lane integration follow-ups retain security intent: seven verified-admin/shared-policy contract and helper tests pass, and all six team-entitlement scenarios pass through a guarded ordinary Node child running the full production app with actual HTTP/PostgreSQL. Public locked-team reads remain public while privileged owner access returns `403 TEAM_PLAN_LOCKED`; no blanket 404 acceptance was introduced. The release-owner aggregate uses the final per-suite results without double-counting intermediate harness runs.

Detailed latest-PDF statuses: [notes remediation](../audits/2026-09-05/notes-remediation.md). These status links supersede old “open bug” prose only for the specific locally reproduced/fixed cases; they do not rewrite the historical audit observations or convert source evidence into platform acceptance. Founder/reviewer privilege policy and refund wording remain explicit owner decisions where unresolved.

## Original milestone plan

## What earns A+

All critical privacy, role, financial-integrity and recovery gates pass; every supported core user journey has evidence on its actual platform; remaining noncritical limitations are explicitly documented; and the team can detect, diagnose and recover from failures. Test counts alone do not award the grade. No unresolved required gate can be averaged away by scores in other areas.

Use the existing [release workflow](RELEASE_WORKFLOW.md) and [launch sign-off](LAUNCH_READINESS_GATE.md). This plan supplies the concrete remediation and scenario evidence those gates currently lack.

## Milestone 0 — Establish one reproducible baseline

1. Pin the current commit and preserve existing audit tests/reports and unrelated work.
2. Reproduce the audit findings against that commit. Record any already-fixed or superseded case with actual evidence.
3. Keep test data in isolated local/staging databases and provider sandboxes. Verify the environment loader and script destination before executing scenario tools; some commands labelled local also inspect runtime services.
4. Convert forensic tests that currently assert broken behavior into expected-safe assertions as their corresponding fixes land. Preserve the original before-fix output.
5. Repair the five drifted source-contract tests by asserting behavior: thumbnail sizing, banner selection/visibility, paid-state transitions, organization creation validation, and password validation. Keep security intent intact.
6. Maintain one finding ledger containing ID, owner, affected sibling paths, before proof, fix commit, after proof, release target, and status. Link historic notes to it instead of creating conflicting closure claims.

**Exit:** every current finding has a reproducible case or an explicit evidence gap; no assertion is removed merely to obtain a green suite.

## Milestone 1 — Protect privacy and revoke authority correctly

Privacy and organization authorization can run as independent implementation lanes, each with its own isolated database. Each patch receives review by someone other than its implementer.

| Work package                                 | Audit IDs       | Required implementation and proof                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Apply one visibility policy to every read    | FAN-01/02/03    | Enforce team privacy, author privacy, approval and bidirectional block rules on game/event detail, summaries, media/stories, OG and share landings. Apply filtering before ranking/pagination. Use a branded fallback when no public image qualifies. Preserve explicitly authorized followers, staff, owners and contributor-access exceptions. |
| Revoke stale organization email capabilities | ROLE-01/02      | Bind a review link to its intended reviewer, current ownership and application attempt. Validate/claim before business effects; concurrent retries must not duplicate decisions or audit/notification effects. Old-owner, used and old-attempt links must leave state untouched.                                                                 |
| Resolve organization ownership consistently  | ROLE-03         | Use the same canonical resolver for app authorization, email recipient and audit actor, including supported legacy ownership rows.                                                                                                                                                                                                               |
| Persist privacy settings reliably            | SET-01          | Prevent a fast back-navigation or backgrounding action from silently discarding a privacy change. Expose pending/saved/failure state. Verify the effective setting from an independent session.                                                                                                                                                  |
| Remove ambiguous founder/reviewer privileges | Policy decision | Recommended: use an isolated/scoped App Store reviewer account. Retain organization-owner administration only within its organization. Record the owner's decision before changing deliberate demo access.                                                                                                                                       |

**Permission matrix:** anonymous visitor, unrelated fan, accepted/pending follower, blocked user in either direction, coach A/team A, coach B/team B, assistant, team manager, organization manager, owner A/org A, owner B/org B, former owner, founder and reviewer. Include direct HTTP requests that bypass UI controls.

**Exit:** all listed negative cases reject without protected data or mutation; authorized positive cases still succeed; stale/duplicate links cannot change state; audit records identify the actual authorized actor. A privacy or privilege bypass blocks progression to production sign-off.

Because the app is already live, review narrowly scoped containment while durable fixes are prepared: generic share images, rejecting unsafe rebooking/retarget requests, and disabling affected email mutation paths while app review remains available. Any containment must have a tested user recovery path and documented removal condition. This plan does not apply those changes or deploy them.

## Milestone 2 — Preserve every purchased date and entitlement

| Work package                                        | Audit IDs    | Acceptance scenarios                                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transactional ad retargeting                        | ADS-01       | Two slots already sold in destination ZIP: third retarget rejected with original targeting/reservations unchanged. Race booking against retargeting; capacity never exceeds the limit.                                                                                                              |
| Separate pending purchase holds from paid inventory | ADS-02       | Existing paid dates survive additional-date success, cancellation, timeout, abandoned checkout, duplicate callback and cleanup job. Cleanup deletes only that failed purchase's holds. Existing paid delivery continues. Schema changes, if needed, require migration and rollback/backfill design. |
| Match refunds to the current entitlement            | PAY-01       | Old Stripe refund/dispute updates the correct accounting record but leaves a different current Stripe/Apple/Google entitlement intact. A refund of the matching current purchase follows the intended business policy.                                                                              |
| Keep incomplete webhook work retryable              | PAY-02       | Inject a database failure: event remains unprocessed and returns retryable non-2xx. Retry commits once; duplicate delivery adds no effects. Include lock failure and crash-after-commit/retry scenarios.                                                                                            |
| Correct checkout success and validation             | ADS-03/04/05 | Free web promo reaches confirmation; iOS Apple flow works without Stripe configuration; malformed/impossible dates return 400 before pricing/payment; day 56 allowed, day 57 rejected.                                                                                                              |

Then execute actual sandbox transactions: iOS Apple subscriptions and ads, Android Google subscriptions and Stripe ads, web Stripe subscriptions and ads. Cover payment cancellation, pending purchase, restore/reinstall, retries, expired session, interruption, approval/rejection and allowed refund recovery. Verify the provider receipt/dashboard, API state, ledger and purchased inventory agree.

Resolve the advertising policy wording explicitly: the current “No refunds” statement is broader than the SLOT_FULL and moderation-rejection refund behavior. Agree on the intended exceptions and make copy, support guidance and backend behavior consistent. Preserve necessary financial recovery while that decision is made.

**Exit:** zero oversold dates, erased paid reservations, duplicate charges/effects, lost retryable events, or wrong-entitlement revocations across the defined cases. Provider tests have transaction IDs and screenshots/logs with secrets removed.

## Milestone 3 — Make every screen's promise reliable

Fix SET-02/03, THEME-01/02 and FAN-04: whole-batch rollback, canonical preference refresh, application theme on all affected settings pages, per-account theme reset, and active-tab profile errors with retry. Check every sibling posts/replies/upvotes query and both system/app theme combinations.

Finish the visible tabs in the user's requested order:

| Tab / destination | User journey to complete                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feed              | Sign in as fan, follow people/team/program, receive correct feed, upvote/comment/bookmark, refresh, block and confirm removal.                                                                         |
| Highlights        | Find and play actual uploaded media, change sort/filter, paginate, navigate to correct event and share with appropriate privacy.                                                                       |
| Create            | Camera/gallery and location permission allow/deny; correct event/team destination; upload progress, interruption/retry, post versus story; active and expired seven-day grants.                        |
| Discover/map      | Date and sport filters, search, map/list agreement, private/pending visibility, follow scope, empty results, permission denial and failed requests.                                                    |
| Profile           | Own and visitor views, posts/replies/upvotes, edit profile, private/public transitions, block/follow changes, failed first page and pagination recovery.                                               |
| Settings          | Username/password/provider controls, notification preferences, privacy/comment rules, blocked users, theme, ZIP, follows/favorites/RSVPs, export, billing, support/legal, account deletion and logout. |
| Connected tools   | Coach/team and organization controls; owner email review; founder-only panel; messaging, group chat and notifications.                                                                                 |

For each journey test **loading, success, empty, error/retry, offline/interrupted request, rapid repeat taps, and account switching** where applicable. Inspect light/dark themes, text scaling, keyboard behavior, readable contrast and screen-reader labels on important actions.

**Exit:** the owner-visible behavior and server state agree; no failed request masquerades as empty/saved/success; no duplicate mutation from repeated interaction; user can recover from errors.

## Milestone 4 — Prove reliability on real devices and real shared state

Use physical iOS and Android devices plus web, production-like staging configuration and seeded personas. Use two real sessions for messaging, blocked/private visibility and permission revocation. Use real Redis with two local/staging server processes for invalidation and race tests; production currently has one replica with deployment overlap, so cross-process correctness still matters.

Required drills:

- Privacy/block/team updates immediately affect other sessions and shared caches; define any acceptable propagation bound before testing and ensure it cannot authorize writes or leak newly restricted content.
- Ownership transfer and staff removal revoke app, email and group-chat access as intended.
- Websocket disconnect/reconnect preserves messages, unread counts and room authorization; polling fallback works.
- APNs/FCM and actual email delivery arrive for the correct users; warm/cold app taps reach the intended authorized screen.
- Refresh-token rotation, logout, forced revocation, password change and session expiry behave across devices.
- Full data export builds, downloads and expires against configured private storage. Historical “configured” or local mock results do not close this journey.
- Concurrent booking, invite acceptance, approval, ownership transfer and webhook retries preserve invariants under conflict and process failure.

**Exit:** recordings/logs identify device, OS, account persona, server commit, binary/runtime and update group. Passing mocked tests cannot substitute for these rows.

## Milestone 5 — Demonstrate operational recovery and efficient behavior

1. Write workload and performance budgets before testing: representative media/data size, supported devices/network, expected peak traffic, acceptable screen/API latency and error rate. Measure p50/p95 latency, memory, database queries and queue delay at expected load and a stated headroom target. Fix measured slow paths using existing bundles, indexes, pagination, caching and image sizing.
2. Test failure alerts for authentication, server errors, webhook backlog/failures and queue problems. Confirm client/server traces identify the deployed version and scrub sensitive data.
3. Restore a recent backup into an isolated database and validate critical relationships and application operations. Record actual restore duration and recovery point; a reachable backup is not a restore drill.
4. Rehearse API/client rollback and safe forward repair for any schema or accounting change. Record abort criteria, operator, commands and measured recovery time.
5. Review dependency advisories and secret scanning. Address reachable high/critical risks; document any time-limited tooling-only exception with evidence, owner and review date. Avoid an untested Expo major upgrade just to reduce an advisory count.
6. Align the maintained branch, reviewed release commit, Railway deployment and each supported client runtime. Record old-client compatibility. Require normal hooks/checks; never bypass guardrails.
7. Examine whether existing production data needs repair: overbooked/missing paid dates, failed refund events and questionable email approvals. Start with bounded read-only reconciliation; prepare an idempotent, reviewable repair with rollback before authorizing production mutations.

**Exit:** operators can detect an induced failure, identify the affected release, restore/reconcile data and recover service using tested procedures. Performance meets the predeclared workload budgets without integrity drift.

## Milestone 6 — Release evidence and final A+ decision

Follow the canonical local → build-readiness → runtime → device UAT → go/no-go workflow. Choose explicit test/staging destinations and inspect scripts before execution. Native builds/submissions remain user-run under repository rules. A code fix is not live until its required server deployment and/or client OTA/binary is verified.

Record evidence for:

- `npm run release:verify:local` and both complete client/server suites, including the repaired scenario tests.
- `npm run release:verify:build` for the exact release candidate.
- `BASE_URL="<intended environment>" npm run release:verify:runtime` plus actual provider/device evidence it does not itself supply.
- Every required row in [LAUNCH_READINESS_GATE.md](LAUNCH_READINESS_GATE.md), with owner, evidence and PASS/FAIL/UNKNOWN.
- A staged rollout, tested abort/rollback procedure, and observation period chosen before rollout. Track real failures, support incidents, payment reconciliation and cohort/device coverage; an arbitrary quiet period with no relevant traffic is insufficient proof.

**A+ decision:** all critical privacy/permission/money invariants pass; every supported core journey has real-platform evidence; required operational gates pass; no critical/high product defect or unknown critical result remains. Record any lower-risk limitation explicitly. The decision remains evidence-based and does not imply software will never have another bug.

## Execution order and ownership

Start with baseline and independent privacy, organization-email, and payment lanes; settings privacy persistence belongs in the first correction batch. Each lane uses separate test data and bounded file ownership. Integrate and verify one reviewable domain change at a time. Then finish remaining UX/settings, perform shared-state/provider/device drills, and complete operational/release evidence.

Engineering owns patches, regression proof and staging automation. The product owner chooses deliberate policy changes and supplies/coordinates physical-device and account/provider access where needed. The release owner records deployment, rollback and production sign-off. Existing session authorization governs actions; this plan is not blanket authorization for charges, outbound messages, credential changes, deployments or production data repair.

A credible completion estimate comes after Milestone 0 and the paid-reservation data-model decision. Track progress by proven gates, not number of commits, code volume, or a promised calendar date.
