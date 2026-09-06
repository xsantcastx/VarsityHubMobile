# Nightly matrix execution — September 5, 2026, approximately 10:42–10:46 p.m. EDT

**FAIL: the known defects still reproduce.** This is a new targeted execution, not a reuse of earlier passing counts. Reference: [matrix ledger](matrix-verification-ledger.md) and [production matrix](current-production-reaudit.md).

## Version checked now

- Fresh fetch: local and latest fetched production branch remain `fccdc186d07d8f7588f0195e9655d0eb3ecb70a3`.
- Railway's latest successful API deployment remains `1afb5524-95d5-4242-8f8d-a8b1f92072e4`, September 5 at 21:40 UTC.
- Fresh EAS query: production OTA group remains `7e09e4a5-4dd3-4437-bf3b-a32535ab96e1`, runtime 1.0.5, Android/iOS.
- Fresh published web entry SHA-256 remains `70e7ad5835d5236677b7fc3202698a602bbb35b9a673d846280fa0eab38d4258`.
- Product source has not changed since the preceding audited release. Local changes are audit documentation and tests. CLI deployment metadata retains the source-attestation limitations documented in the production audit.

## New execution results

| Check                                                          | This run    | Meaning                                                                                                |
| -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| Team/organization boundary HTTP tests                          | 5/8 pass    | ROLE-C01, ROLE-C02 and ROLE-C03 still fail                                                             |
| Ad persona/lifecycle HTTP + DB tests, Stripe transport stubbed | 17/19 pass  | AD-C01 and AD-C02 still fail                                                                           |
| Fan privacy HTTP + DB assertions                               | 84/84 pass  | Exercised hidden/private/blocked resource cases hold                                                   |
| Fan DM HTTP + DB assertions                                    | 15/15 pass  | Exercised age/follow/block/ownership/length cases hold                                                 |
| Actual published web, isolated local API                       | 35/36 pass  | SET-C01 still produces React error 418; remaining tab/settings checks pass                             |
| Server monitoring tests                                        | 14/14 pass  | Includes a characterization test that **confirms dropped feedback**; not 14 successful delivery checks |
| Client monitoring tests                                        | 15/15 pass  | Mocked SDK behavior/scrubbing; no fresh provider ingestion proof                                       |
| Client and server TypeScript                                   | Both exit 0 | Executed on the current tree                                                                           |
| Navigation and conflict checks                                 | Both exit 0 | No navigation-review or conflict failures                                                              |

Scenario groups and assertion totals are intentionally separate. The full baseline suites, Redis cross-process matrix, provider/device acceptance, load, and restore drills were not rerun in this targeted nightly execution.

## Reproduced findings

1. **ROLE-C01 — organization-approval bypass:** bulk endpoint returns 201 and persists an approved game when the expected result is 403 with no game.
2. **AD-C01 — PaymentSheet refund failure:** dedicated PaymentIntent reference is null; signed local refund event gets 500 instead of 200.
3. **AD-C02 — loss of paid ad delivery:** refunding the first overlapping purchase leaves zero paid dates and a draft/refunded ad despite a second completed purchase.
4. **ROLE-C02 — mixed-team scheduling failure:** expected valid per-row handling, received 500.
5. **ROLE-C03 — legacy owner access failure:** expected admin summary 200/canAdminister, received 403.
6. **SET-C01 — host-event request rendering:** actual published page still raises error 418. Recovery rendering does not certify submission.
7. **Feedback intake — false success:** synthetic HTTP submission returns success with no persistence/email invocation and omits the message from the log.

## Fresh production/monitoring observations

At 02:42 UTC, `/health` was healthy and `/health/egress` reached 4/4 targets. Dedicated export storage configuration is still absent. Healthy infrastructure does not close the role/payment/UI defects.

Sentry's production issue query still returns the iOS map crash [VARSITYHUB-3T](https://lime-productions.sentry.io/issues/7655376217/), last seen September 5 at 23:12:15 UTC. Its last-seen value did not advance; there is no new native reproduction or fix proof in this run. The separate startup crash and older routing-loop group retain their previous timestamps. Eight issue-alert rules remain active; the production new-error rule last triggered at 23:35:31 UTC. Inbox receipt remains unverified.

Latest Snyk workflow is still [34005457086](https://github.com/emilmancero-dev/VarsityHubMobile/actions/runs/34005457086), checking older `dd580f62`. No newer scan supersedes the previously inspected Forbidden SAST output. The feedback, uptime-alert condition, failed remediation push and PostHog access gaps remain documented in [monitoring verification](monitoring-loop-verification.md). Only feedback was re-executed locally in this run; no provider notifications or repository workflow failures were deliberately triggered.

## Evidence and limits

Fresh logs/JSON: `/tmp/varsityhub-nightly-now/` (`roles.json`, `ads.json`, `monitoring.json`, `browser-current.json`, fan logs, `live-signals.json`, `ota.json`, `web-version.json`, typecheck/navigation/conflict logs).

All test writes went to dedicated loopback PostgreSQL fixtures. Browser traffic used the actual published web assets with API requests redirected locally and unrelated provider traffic blocked. API process was stopped after testing. No production users, purchases, emails, alert rules, deployments or product fixes were changed.

Retain device/provider acceptance as pending: fan 0/6 groups, owner email/native 0/1, real ad platform/persona purchases 0/9, export activation/device ZIP 0/2. PostHog acceptance/alert receipt remain UNKNOWN. There is no all-clear or automatic incident closure.
