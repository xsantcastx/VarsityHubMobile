# September 5 remediation release verification

## Release intent and source

Owner authorized fixes, verification and production API, OTA and website publication so they can perform device testing. This is a remediation release for testing; it does not certify A+ or every conceivable scenario. Audited base was `ec27781e`; integration began on `374a785b` on `fix/desktop-notes-map-collage-share`. No native dependency/config upgrade, EAS build or store submission is part of this release.

See [PDF note ledger](notes-remediation.md), [privacy/settings](privacy-settings-remediation.md), [roles/events](roles-events-remediation.md), [payments](payments-remediation.md), and [A+ gates](../../release/A_PLUS_READINESS_PLAN_2026-09-05.md). Earlier audit reports are before-fix evidence, not the final disposition.

## Completed integration evidence before publishing

- Client full suite: 211 suites, 1,472 assertions passed, including the final Follow readiness and Followed Teams recovery fixes. Jest is configured to force exit; passing counts do not prove no retained timers.
- Server suite: 319 suites and 2,976 assertions pass across the full sweep plus fresh-process reruns and final affected-file reruns; zero skipped. This is an aggregate, not one green full-suite process. The entitlement suite runs all six scenarios against the actual full app in a child Node process to avoid Jest's module-loader interference.
- Canonical `release:verify:local`: exit 0, including both TypeScript checks, access matrix, navigation (zero REVIEW), guardrails, regression suites, Expo doctor, coach approval wiring, local HTTP organization-manager access and email catalog/config checks.
- `release:verify:build`: exit 0 with four nonblocking warnings. This checked build readiness; it did not build or submit binaries.
- PostgreSQL dump/restore and additive migration were rehearsed against a disposable local database. This is not a production backup restore drill.
- Production read-only preflight found two paid ads with five historical reservations, no future reservations, no active legacy checkout holds, no oversold future slots, and no ad repair required at the snapshot. No unresolved failed Prisma migration was present. The configured backup target was also reached read-only through its matching Railway private-domain/public-proxy mapping; its new table/column were absent before this release and must be verified after startup reconciliation. No backup URL or credential was changed.
- Dependency audit remains client 18 advisory nodes (8 high, 10 moderate) and server 3 moderate. No blind upgrade was applied. The available sanitize-html patch requires a newer Node runtime than this deployment; package upgrade plus supported runtime validation remains an explicit follow-up. Advisory counts are not demonstrated app exploits.

Detailed raw local logs live under `/tmp/varsityhub-remediation-2026-09-05/`; durable scenario descriptions and commands are in the linked handoffs. The audit fixtures use isolated loopback PostgreSQL and suppressed provider credentials. Production inspection is read-only, apart from the explicitly authorized deployment migration. No live test charge or test email was sent.

## Browser evidence

A fresh local Chromium run against the isolated API opened Feed, Highlights, Create, Create Post, Discover, Game Map, Profile, Settings and Followed Teams: all nine had zero browser page errors and zero app error boundaries. It recorded 79 API requests; this is a route smoke test, not a performance budget. Screenshots confirm [visible metallic media buttons](browser-evidence/ui-create-post.png), [real Discover icons](browser-evidence/ui-discover.png), and [Followed Teams in Dark appearance](browser-evidence/ui-settings-followed-dark.png). [Route result JSON](browser-evidence/route-smoke.json) records the nine destinations.

An actual settings interaction saved Private Profile, independently read `true` from `/me`, reloaded and observed the checked switch, selected Dark appearance, and opened Followed Teams with the dark text color (`rgb(148, 163, 184)`) and no error screen. Mock tests separately cover failed saves, unmount, stale refresh and account changes. An earlier browser attempt hit a local Metro heap limit and transient pre-fix bundles; the successful fresh run supersedes those smoke attempts, not their diagnostic history.

## Cutover and migration

Migration `20260905000000_ad_purchase_holds` adds `AdSlotHold` and nullable reservation purchase provenance. It does not guess ownership of old paid dates. New holds and existing purchased dates are separate so a failed Run Again purchase cannot erase paid inventory.

Old checkout writers do not count the new hold table. Railway's documented zero-overlap/zero-drain settings still permit a slight transition overlap; they are not an atomic writer boundary. For this release, stop the old API deployment and verify it removed before starting the new deployment. This causes a temporary API outage while the new image builds/starts. Confirm public API readiness, migration history and inventory postflight before the OTA and website publication. The startup placeholder now returns HTTP 503 with Retry-After, failed primary migrations abort startup, and migration/backup commands have bounded execution. Three executable shell/HTTP tests pass. The 600-second health-check window covers the default bounded startup work; real deployment readiness still requires post-start checks.

Rollback must retain the new inventory adapter after any new holds/purchases exist. Never blindly redeploy the old binary while new holds are active. The additive table/column can remain. If the new API never accepted traffic, verify no new holds before using the old binary as recovery. Avoid destructive schema rollback.

Railway references: [deployment lifecycle](https://docs.railway.com/deployments/reference#singleton-deploys) and [configuration](https://docs.railway.com/config-as-code/reference#deployment-teardown). The explicit stop boundary is required by this schema transition, not proof of general zero-downtime deployment.

Build-context exclusions now explicitly omit local dotenv files, private keys and agent state in both Railway uploads and Docker builds. Ignore-rule checks confirm these exclusions and preserve the Dockerfile's required source/manifests. No credential was rotated.

## Publication record

Pending completion by release owner: exact commit, server deployment, verified migration and runtime checks, OTA group/platform runtime, web deployment and browser verification. No publication is claimed at this checkpoint.

## Remaining acceptance gates

Native camera/gallery/crop/location/share, sandbox Apple/Google/Stripe purchase/recovery, actual email/push delivery, recurring cold-start sessions, representative workload performance and production backup recovery remain unverified. Direct Instagram Stories requires configuration and native integration/build. Minor-league schedule population requires an authorized provider; see [bounded plan](minor-league-ingest-plan.md). The deliberately privileged review account remains a product-policy decision, separate from tested organization-owner restrictions.
