# VarsityHub nightly production triage

Operational checklist derived from the September 5 production and monitoring audits. This document defines the intended daily loop; it does not activate schedules, provider alerts, or automatic deployments.

## Matrix reference and evidence contract

Use the [matrix verification ledger](../audits/2026-09-05/matrix-verification-ledger.md) for scenario dimensions and execution states, the [current production matrix review](../audits/2026-09-05/current-production-reaudit.md) for dated findings, and [scenario evidence](../audits/2026-09-05/current-reaudit-evidence.json) for recorded assertions. Current source and newly executed tests take precedence over those notes. The generic nightly checklist is not a separate release sign-off.

Before executing a nightly run, enumerate required cases across identity, ownership, staff authority, malformed/forged inputs, lifecycle, session/connectivity, payment rail and actual delivery. Include fan, approved/pending/rejected coach, organization owner/manager and founder controls; cover own, foreign and mixed-ID resources. Begin with auth bypass, privilege escalation, IDOR, payment spoofing, webhook replay, stale-cache access and deep-link injection.

For every row record: matrix case/finding ID, tab and API path, role/resource owner, fixture state, expected versus actual result, persisted state and forbidden-side-effect assertions, client/server/deployed version, platform, timestamp and evidence link. Keep finding classification separate from execution state:

- Finding: `Closed`, `Open Bug`, `Policy Decision`, `Deferred Feature`, or `Stale/Deleted`.
- Execution: `Verified locally`, `Verified deployed`, `Device/provider acceptance pending`, `Blocked`, or `Not run`, as defined by the ledger.
- Dashboard PASS/FAIL/UNKNOWN is only a summary of those records. A local pass is not a deployed pass. UNKNOWN retains blocked/not-run cases in the required denominator.

Report **passed / required scenarios**, separately from test-suite assertion totals. Do not carry forward a dated pass as fresh evidence. Reclassify a bug as Closed only after an applicable current reproduction no longer fails, with explicit remaining release/device limits.

### Findings to carry into each nightly review

These are the last verified matrix findings, not new execution results from this documentation update. Keep them visible until new evidence changes their status.

| Matrix ID  | Nightly scenario / expected behavior                                                                 | Reference                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ROLE-C01   | Pending organization cannot bypass approval through bulk game creation                               | [Role cases](../audits/2026-09-05/current-roles-reaudit.md); `audit-20260905-current-team-isolation.test.ts`  |
| ROLE-C02   | Mixed-team bulk scheduling follows approval rules without an enum-related 500 or unauthorized writes | Same role cases and test                                                                                      |
| ROLE-C03   | Canonical legacy org owner receives the correct team admin summary                                   | Same role cases and test                                                                                      |
| AD-C01     | PaymentSheet settlement retains the purchase reference needed to process its refund                  | [Ad cases](../audits/2026-09-05/current-ads-reaudit.md); `current-ads-persona-reaudit-2026-09-05.test.ts`     |
| AD-C02     | Refunding one purchase preserves entitlement from another valid paid booking                         | Same ad cases and test                                                                                        |
| NATIVE-C01 | Installed iOS map opens, filters and reopens without AIRMap crash                                    | [Native/Sentry evidence](../audits/2026-09-05/current-sentry-reaudit.md); physical-device acceptance required |
| SET-C01    | Host-event request renders consistently without hydration failure; submission checked separately     | [Settings cases](../audits/2026-09-05/current-settings-reaudit.md)                                            |
| OPS-C01    | Export remains honestly unavailable until private storage/worker delivery is activated and verified  | Settings cases and export rows in the matrix ledger; blocked configuration                                    |
| OBS-C01    | Error evidence identifies the installed OTA/runtime and applicable deployment                        | Native/Sentry evidence; attribution gap                                                                       |

Track monitoring-specific findings alongside these rows using the [monitoring verification report](../audits/2026-09-05/monitoring-loop-verification.md): feedback loss, skipped uptime alert, incomplete/stale Snyk coverage, failed remediation push and unverified PostHog/notification receipt. Do not silently give these the IDs of unrelated matrix defects.

Carry the matrix's unrun acceptance groups forward explicitly: fan native/provider **0/6**, owner email/native **0/1**, real ad platform/persona purchases **0/9**, and export activation/device ZIP **0/2**, until those dated counts are replaced by actual execution evidence. Deferred Instagram Stories/minor-league ingestion and deliberate platform-admin allowlist/refund-policy decisions remain separate from regressions.

## Use the actual stack

VarsityHub uses Expo / React Native / Expo Router (including web), Express on Railway, PostgreSQL, Redis / BullMQ, Sentry, PostHog, Cloudinary, SendGrid, and platform-specific payments. Use these systems' evidence. Firebase Crashlytics, Next.js, AdSense, Supabase, and a third-party sports-score feed have not been established as VarsityHub dependencies. Do not add their dashboards to the checklist as if they existed.

Use Sentry for native crashes and error incidents; Xcode Organizer can supplement native diagnostics when available. Check game/event freshness against VarsityHub's own recorded schedule and authorized updates. A quiet game schedule or empty nearby result is not itself a failed data feed.

## Background signals

The cadence below is a proposed target, not a claim about currently active monitoring. Every check must report PASS, FAIL, or UNKNOWN, with timestamp, source/release identity, evidence link, and owner. Missing access, a skipped scan, stale evidence, or no traffic is UNKNOWN, never PASS.

| Area                            | Proposed cadence                                           | Evidence / acceptance                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web/API availability            | External probe every minute; alert after repeated failures | Web renders the expected entry surface; API health and egress checks return their expected status/body. Check certificate validity. A 200 alone does not establish readiness or usable screen content.                                                                   |
| Database, Redis, queues         | Continuous metrics; nightly review                         | Connections and queue processing remain healthy; failed jobs and oldest pending-job age stay within recorded operating thresholds. Check backup freshness separately from restore verification.                                                                          |
| Production crashes and failures | On new/regressed critical issue; nightly trend review      | Group by environment, server SHA, OTA update ID, runtime/native build, platform and route. Prioritize startup/map crashes, payment failures and access-control failures. Show affected users/sessions and observation window alongside any crash-free percentage.        |
| Fan journeys                    | Nightly isolated E2E; published-web read checks            | Sign-in, all five tabs, discovery filters, valid empty states, game details, RSVP add/remove, and settings persistence. Assert displayed data and persisted state, not only HTTP status. Validate inaccessible/private content remains hidden.                           |
| Coach / organization boundaries | Every relevant PR and nightly isolated matrix              | Own-team actions succeed; foreign-team actions fail without state changes. Org owners have intended org powers; ordinary owners never receive founder powers. Include pending approval, mixed-team bulk writes, legacy ownership, and self-review rejection.             |
| Ad journeys                     | Every payment change and nightly isolated matrix           | Fan, coach and organizer: booking eligibility, dates, inventory limits, competing holds, expiration, completion, retry, cancellation, refund and Run Again. Assert paid reservations match valid purchase entitlements. Provider sandbox acceptance is a separate check. |
| Telemetry pipeline              | Scheduled controlled canary plus event freshness           | Confirm SDK capture → provider acceptance/query → alert execution → destination receipt. Use dedicated synthetic identity and a designated test destination. Detect a missing canary from outside the application.                                                       |
| Analytics impact                | Nightly; anomaly alerts after baselining                   | Compare successful sign-ins, RSVP attempts/results and ad attempts/completions against relevant attempts and traffic. Zero purchases in 12 hours alone is not an outage. Reconcile payment outcomes against server records; analytics is not the payment ledger.         |
| Snyk and dependency checks      | PRs plus daily deployed-revision scan                      | Record exact source SHA, scan time, policy/threshold, scan errors and findings separately. Scan both root and server; verify SAST actually completed. Retain sanitized artifacts outside commits.                                                                        |
| Bug-report intake               | Nightly isolated test; controlled delivery acceptance      | Submission is durably stored with report ID and available to the authorized reviewer. Notification failure remains visible/retryable. Verify notification receipt separately from an API success response.                                                               |

Production synthetic writes require dedicated controlled accounts and cleanup; ordinary production users and real charges are not test fixtures. The existing isolated role/ad tests do not establish production payment-provider acceptance. iOS payments use the existing Apple path; Android ads use Stripe, Android subscriptions use Google Play, and web uses Stripe.

## Five-minute nightly review

| Minute | Review                                                                   | Required outcome                                                                                                          |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 0–1    | Latest server, OTA and web publication identities; audit completion time | Confirm checks apply to what is deployed. Mark stale/missing coverage UNKNOWN.                                            |
| 1–2    | Critical Sentry incidents, availability, queues and payments             | Assign each new critical incident an owner and response deadline. Check ongoing incidents, not only newly created issues. |
| 2–3    | Fan/coach/owner/ad matrix and feedback intake                            | Review failures and coverage gaps; link the specific scenario and actual versus expected state.                           |
| 3–4    | PostHog/canary freshness, Snyk completion, report delivery               | Confirm the monitors themselves worked. Distinguish no user activity from missing telemetry.                              |
| 4–5    | Incident queue and releases                                              | Deduplicate, set next action, link fixes and verify deployed recoveries. Escalate unacknowledged critical incidents.      |

The five-minute review summarizes automated evidence. It cannot replace device testing. Run the broader native check after relevant client changes and rotate a short device scenario through the nightly review: GPS allowed/denied/unavailable, map open/filter/reopen, background/foreground, offline/reconnect, deep links on an installed app, media playback, and push navigation. A browser test cannot certify iOS Universal Links, native maps, native crashes, or store payments.

## Telemetry details that matter

- Current client telemetry is disabled in development. A debug-build synthetic error is therefore not an acceptance test for the production pipeline. Use a release-mode staging build with explicit test routing; separately verify production capture through controlled evidence.
- Record permission status and location-source category (`device`, `manual`, `unavailable`) where useful. Do not routinely log precise GPS or high-resolution quadkeys, particularly for an app used by minors. Any regional aggregation should have a concrete diagnostic need and coarse granularity.
- SDK network emission, provider ingestion, alert triggering, and inbox receipt are four separate checks. The September 5 intercepted-browser test proved emission only.
- Error counts and crash-free rates need denominators and traffic windows. Establish a measured baseline before choosing a numeric alert threshold; any new reproducible startup crash still merits immediate investigation at low volume.
- Capture actionable unexpected failures while keeping handled empty results, permission denial and expected authentication errors out of critical paging. Preserve useful UI error/retry states.

## Closure loop

Detected → assigned → reproduced → regression test → reviewed fix → deployed release → scenario rechecked → observed recovery → closed. Reopen on recurrence. A proposed 24-hour observation window is a starting point; extend it until the affected flow has meaningful traffic. Keep unresolved/no-traffic incidents visible.

Automation may gather evidence, deduplicate incidents and prepare tested draft PRs. Production release uses the existing guarded server/client/native workflows. Never equate a merged server fix with a published mobile fix, and never suppress an incident merely because a fix was proposed.

## Current prerequisites

Before treating this checklist as an active monitoring system, address the findings in [monitoring-loop-verification](../audits/2026-09-05/monitoring-loop-verification.md): dropped feedback messages; uptime alert failure condition; Snyk SAST Forbidden responses, outdated scan target and failed remediation push; missing OTA attribution; unverified PostHog ingestion/access and actual alert receipt. Record an incident owner and destination before activating notification canaries.

The [production matrix audit](../audits/2026-09-05/current-production-reaudit.md) contains the known role, booking, settings and native failures to carry forward into nightly triage. This checklist does not clear those defects.

## September 6 implementation update

The [local root-cause patch](../audits/2026-09-05/root-cause-fixes-2026-09-06.md) implements durable feedback, failure-aware uptime alerts, explicit scheduled Snyk source selection, unavailable-scan failure, sanitized findings and OTA attribution. It is not deployed. After release, set and maintain `PRODUCTION_SOURCE_REF`, restore Snyk Code access, verify PostHog ingestion and confirm an alert arrives at its intended destination before marking those monitoring rows verified deployed.
