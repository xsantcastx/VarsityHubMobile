# Current settings re-audit — September 5, 2026

The earlier privacy-save and theme defects pass current regressions. Settings still cannot receive an unrestricted “works as advertised” sign-off: the published Request to Host Event page raises a hydration error, and production data export remains unconfigured.

## Current execution

The actual published web script is `entry-b8803f9237ff9f192e05de1188373291.js`, SHA-256 `70e7ad5835d5236677b7fc3202698a602bbb35b9a673d846280fa0eab38d4258`. The live HTML and script were fetched read-only. Chromium loaded that bundle from `www.varsityhub.app`; **all API traffic was intercepted to a dedicated loopback Express/PostgreSQL instance**. Other provider requests were blocked. This tests the delivered UI with current real server code, not authenticated production account behavior.

The browser matrix was enumerated before the run: five tabs, privacy-save/navigate/reopen, notification save/reload, and founder denial for each of fan/coach/org owner (24 checks), plus 12 fan settings destinations. **35/36 passed.** This is not 35 complete product journeys: destination checks verify rendering and errors, while the two preference checks assert the persisted API result and the reopened switch.

| Setting/workflow                                                 | Evidence                                                                                             | Current classification                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Private profile, immediate navigation, reopen                    | Actual browser press → local PATCH → fresh `/auth/me` → checked switch; all three roles              | Closed for exercised behavior                                                       |
| Notification save/reload                                         | Actual browser and fresh API state; all three roles                                                  | Closed for exercised behavior; physical delivery not run                            |
| Failed saves, queued changes, account switching                  | Actual Settings/AuthProvider rendered regressions in full client suite                               | Pass with mocked transport; not multi-device acceptance                             |
| Dark theme and cross-account theme reset                         | ThemeProvider/rendered tests; published browser checks in dark mode                                  | Prior THEME-01/02 locally closed; physical device not run                           |
| Username, RSVP history, followed teams, favorites, blocked users | Published page rendering; existing component/API suites                                              | Covered read/validation cases pass; not every row action exercised in browser       |
| Password, logout, session restore, account deletion              | Current existing server/client suites, including sole-owner deletion guards                          | Local tests pass; provider login/password mail and two-device acceptance pending    |
| Billing history/manage subscription                              | Existing canonical billing/payment suites, browser billing-history render                            | Payment lifecycle defects AD-C01/C02 remain; real store/provider acceptance pending |
| Feedback/contact/legal/DMCA                                      | Published feedback/legal/DMCA pages render, existing support auth tests pass                         | No actual support message or email sent; no legal compliance claim                  |
| Request to Host Event                                            | Published page repeatedly raises React error 418                                                     | **Open Bug SET-C01**                                                                |
| Download My Data                                                 | Current HTTP/worker/component tests; actual unavailable UI; read-only production health/config check | **Blocked in production**, not a successful downloadable ZIP journey                |
| Founder controls                                                 | All three ordinary roles denied `/admin/metrics` and no Admin Dashboard control                      | Pass; review-demo admin is a separate explicit policy                               |

## SET-C01 — Published host-request page has hydration mismatch

**Open Bug; medium/low priority.** Direct navigation to `/settings/request-host-event` raises `Minified React error #418` in a clean Chromium context; repeated final runs reproduce it. Other tested settings pages produce no new page errors. The form eventually renders, so this is not proof that submission always fails.

The final read-only reproduction also captured [the rendered page](current-host-request.png); it still raises error 418 before recovery.

[React's official error decoder](https://react.dev/errors/418) identifies server/client markup disagreement followed by client regeneration. `app/settings/request-host-event.tsx:39` initializes a date from `Date.now()` and renders locale date/time strings at lines 228/243, which is a plausible source of the mismatch. **That root cause is an inference, not yet isolated by a patch/retest.** Fix: make initial server/client rendering deterministic, then rerun direct navigation in multiple time zones and test date/time selection plus successful/failed submission. The visible settings link is wired at `app/settings/index.tsx:1077`; the source TODO calling it unwired is stale.

## Production export remains unavailable

Fresh read-only Railway configuration inspection confirms no bucket, endpoint, access key or secret for `DATA_EXPORT_S3_*`. Authenticated health reports `dataExportStorage:false`; general API readiness is true. The current screen correctly shows unavailable rather than accepting a request that cannot finish. This means the operational prerequisite remains **Blocked**, not that Download My Data works in production.

The current full server suite passes export builder/worker/cleanup and HTTP child suites using local DB and fixture storage. The earlier remediation's actual MinIO/BullMQ integration remains dated evidence; it was not repeated in this re-audit. No production export request, object, or bucket was created. Private storage activation and physical iPhone ZIP open/save remain **0/2** acceptance cases in this run.

## First runs retained

The initial local Expo web server reached its 8 GiB heap limit; that run was discarded as journey evidence and retained in `browser-metro-first.json`/`metro.log`. An early published-bundle run had incomplete coach organization fixtures and an incorrect display-name expectation (profiles intentionally show usernames), plus a route-callback shutdown error. These harness defects were corrected; the final run uses actual organization membership, team staff and canonical organization pointers. No product code was changed to make the tests pass.

Reproduction: start `server/scripts/e2e/audit-current-settings-api.mts` with its explicitly named loopback database, `/dev/null` env paths, `NODE_ENV=test`, `EMAIL_PROVIDER=test` and a local 32+ character JWT secret. Then run:

```sh
CURRENT_BROWSER_BASE=https://www.varsityhub.app node scripts/audit-current-settings-browser.cjs
```

The browser script refuses production API traffic by intercepting it to loopback and never sends fixture credentials to the production API. It intentionally exits nonzero for SET-C01. Evidence: `/tmp/varsityhub-current-reaudit-20260905/browser-current.json`, `browser-live-final.log`, and `production-health.json`; durable outcomes are in `current-reaudit-evidence.json`.
