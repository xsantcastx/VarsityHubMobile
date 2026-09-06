# Matrix verification ledger

Latest re-audit: [current production matrix review](current-production-reaudit.md),
pinned to `fccdc186` and checked against fresh EAS/Railway/live-web metadata.
It adds three reproduced team/game defects, two ad refund defects, a published
host-request rendering error, and a fresh Sentry native-crash review. Passing
historical rows below do not close those additional cases. Scenario outcomes and
unrun acceptance groups are retained in [current evidence](current-reaudit-evidence.json).

This ledger supplements the historical September 5 matrix. A passing historical
row does not certify a later release. The owner requested explicit evidence that
the latest app, fixes and notes have been verified.

## Required evidence for each journey

Record the note/page or product promise, screen and API routes, client commit and
OTA runtime/group, server commit/deployment, platform, role, resource owner,
fixture state, expected result, actual result, assertion and evidence location.
Include what the check does **not** prove. A test name or HTTP 200 alone is not
completion: assert the persisted result and absence of forbidden side effects.

Use these execution states independently of finding severity:

- **Verified locally:** the current source has a reproducible passing assertion.
- **Verified deployed:** the delivered version and applicable runtime behavior
  have been checked. Public health does not establish an authenticated journey.
- **Device/provider acceptance pending:** native behavior, payment/email delivery
  or other external outcomes still need their own evidence.
- **Blocked:** identify the missing configuration/access and the smallest next step.
- **Not run:** no applicable evidence yet; never count as a pass.
- **Policy decision / deferred:** an explicit product choice, not an inferred pass.

## Scenario dimensions

| Dimension            | Required checks where applicable                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity             | Guest, verified fan, unverified user, approved/pending/rejected coach, removed staff, organization owner, organization manager, founder admin                  |
| Ownership            | Own resource, another team in the same org, another org, mixed-ID batch, reassignment, stale membership/cache                                                  |
| Staff authority      | Coach administers only authorized teams; assistant/manager event authority does not confer roster/settings/ownership authority; org owner is not founder admin |
| Input and abuse      | Valid request, missing/malformed fields, boundary values, forged role/plan/payment/approval fields, private resource, IDOR and self-approval                   |
| Lifecycle            | First use, loading/error/empty/success, retry, duplicate tap, concurrent requests/workers, cancel, interrupted response, expiry, deletion                      |
| Connectivity/session | Offline, slow response, recoverable 5xx, expired access with valid refresh, explicit revocation, cold start, account switch                                    |
| Payments and ads     | Each platform's payment rail, real sandbox receipt, webhook retry/replay, inventory conflict, existing paid dates preserved, refund/expiry/current entitlement |
| Delivery             | Installed runtime versus source, OTA manifest, API deployment, web export, dark/light theme, deep link and back navigation                                     |

Generate combinations around each real authority/lifecycle boundary; enumerate
the required cases before execution. Report **passed / required** and retain
blocked/not-run cases in the denominator. Broad test-suite counts must remain
separate from journey coverage. No finite suite proves every possible state.

## Current data-export evidence

Baseline source: `3334afd9` (product `8b8543e3`). Candidate source and publication
are recorded in [the export remediation record](data-export-remediation.md).

| Case                         | Expected result                                                                                         | Evidence / execution state                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Storage absent               | Unavailable UI; POST 503 before creating a row                                                          | Local HTTP + rendered screen tests pass             |
| No live worker               | Availability false; POST 503; no queued row                                                             | Real Redis/S3 integration passes                    |
| Request/build/download       | One queued job, all 26 archive sections, valid ZIP                                                      | Real PostgreSQL/BullMQ/MinIO integration passes     |
| Data isolation               | Owned content included; other account posts and auth/provider secrets absent; canonical billing         | Actual ZIP-content assertions pass                  |
| Unauthorized access          | Guest denied; other account list/get/download/delete cannot access the archive                          | Authenticated HTTP fixture suites pass              |
| Concurrent requests/workers  | One accepted request; one upload                                                                        | Parallel request and worker assertions pass         |
| Expiry                       | Endpoint rejects after expiry without waiting for cleanup; signed URL does not exceed archive lifetime  | HTTP and actual S3 signature-expiry assertions pass |
| Cancel during upload         | Terminal cancellation; no revived archive; uploaded object removed                                      | Paused-upload race assertion passes                 |
| Delete during outage         | Download revoked; object key retained; cleanup retries successfully                                     | HTTP/storage failure-injection assertion passes     |
| Cooldown                     | Deleting a completed archive cannot bypass 24 hours                                                     | HTTP assertion passes                               |
| Abandoned request            | Reap old pending/building rows; preserve fresh work                                                     | Cleanup assertions pass                             |
| UI failure/account switch    | No false empty/success, retry works, old account data hidden, duplicate tap suppressed, polling bounded | Seven rendered screen tests pass                    |
| Production activation        | Dedicated private bucket, scoped credential, deployed worker, real provider probe                       | **Blocked: export storage configuration absent**    |
| Physical iPhone ZIP handling | Download opens and can be saved using the installed release                                             | **Not run**                                         |

## Remaining audit closure

Continue tab by tab against the inventory in the
[A+ readiness plan](../../release/A_PLUS_READINESS_PLAN_2026-09-05.md).
The previous role/privacy/booking and session releases retain their dated evidence.
Their outstanding physical-device/provider checks, direct Instagram Stories,
minor-league data authorization, operational recovery/performance drills and
explicit policy decisions remain open. This ledger does not relabel them complete.

For each new fix: preserve a before-fix repro, assert the after-fix result, test
sibling routes, run the required release gates, verify actual delivery, and update
the note-to-test-to-release links. Never erase a failed first run; record the cause
and the exact rerun that resolved it.

## September 6 local root-cause patch

See [root-cause fixes and verification](root-cause-fixes-2026-09-06.md) for the local fixes to ROLE-C01/C02/C03, AD-C01/C02, SET-C01, durable feedback and monitoring. Reproducing scenarios now pass locally; production closure remains pending release and deployed acceptance. NATIVE-C01, OPS-C01 and live provider/alert receipt checks remain open. Earlier production failures are retained as before-fix evidence.

## September 6 publication update

[Release record](release-2026-09-06.md): source `63f5a8b1` is pushed; Railway `c46c3898` is successful; production OTA `6db590e9` covers iOS/Android runtime 1.0.5; the website is published to both custom domains. Production health/configuration checks passed. Release delivery does not replace authenticated device/provider scenario acceptance. Snyk ran on the release commit: dependency scans clean at the configured high threshold; code scans reported 48/60 findings requiring triage. Native map crash, private export activation, provider receipt and the other documented acceptance gaps remain open.
