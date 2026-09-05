# Shipped notes / production grant reconciliation — read-only, 2026-09-05

**All three stated production access grants are present and active.** This is independently observed production data, not acceptance of the pasted notes as proof. At 2026-09-05 07:34 UTC, each target pair had both an `EventPostingUnlock` row refreshed on September 5 and an `EventDesignatedPoster` marker. Three executions of the checked-in one-off script in explicit dry-run mode exited 0 and showed the same rows/expiry times. No grant, revoke, deployment, token issuance, SSH setup, or production write was performed.

## Observed production rows

| Account   | Event page (event date UTC)                                       | Persisted unlock UTC    | Expiry UTC              | Story marker                             | Current result |
| --------- | ----------------------------------------------------------------- | ----------------------- | ----------------------- | ---------------------------------------- | -------------- |
| @superfan | Giants at Jets, 2026-08-28 23:30; `cmsgoxrtw007bf6nioxe8yllz`     | 2026-09-05 07:22:41.037 | 2026-09-12 07:22:41.037 | Present; created 2026-08-30 16:47:19.025 | Active         |
| @nico     | Red Sox at Yankees, 2026-08-29 17:05; `cmsgoyfva00qzf6niwaz4axpf` | 2026-09-05 07:22:43.568 | 2026-09-12 07:22:43.568 | Present; created 2026-08-30 16:47:19.025 | Active         |
| @nico     | Red Sox at Yankees, 2026-08-29 23:15; `cmsgoygmd00rnf6nixj1os096` | 2026-09-05 07:22:46.435 | 2026-09-12 07:22:46.435 | Present; created 2026-08-30 16:47:19.375 | Active         |

New York time: the grants expire on September 12 around **3:22 a.m. EDT**, at the individual seconds shown above. All three pages currently have `game_id: null`. They are event pages; this confirms why an event-specific permission path is required. Marker creation on August 30 is not an old expired grant: regrant deliberately refreshes `unlocked_at` while preserving the existing designated marker, and the seven-day clock uses `unlocked_at`.

The production records prove the refreshed access prerequisites. They do not prove actual camera upload, playback, UI selection, or installed-client OTA receipt. Root separately verified the shipped version; this pass did not impersonate either production account or upload content.

## Read-only method and secret handling

- Used the already-authenticated Railway CLI. Queried service configuration inside a Python subprocess with output captured in memory, never echoed or saved. Matched the live production `api` DATABASE_URL's database host/name to `Postgres-TnGR`, then used that service's `DATABASE_PUBLIC_URL` privately. No credentials or DB connection strings appear in this report or evidence file.
- Executed a bounded SELECT against `EventPostingUnlock`, `User`, `Event`, and `EventDesignatedPoster` using PostgreSQL `default_transaction_read_only=on`, 15-second statement timeout and 10-second connect timeout. Returned only the needed account/page/permission timestamps; retained the three target rows in the evidence artifact.
- Inspected [grant-event-post-access.ts](/Users/varsityhub/Code/VarsityHubMobile/server/scripts/one-off/grant-event-post-access.ts). `apply` is `has('yes') && !has('dry-run')`; the `if (!apply)` branch prints current state and returns before any transaction. Explicit `--dry-run` therefore wins even if `--yes` accidentally appears. This execution never passed `--yes`.
- Ran the checked-in script for each exact user/event pair with `--dry-run`, using each **persisted** `--unlocked-at` value. Passing the persisted anchor matters: without it, the script's proposed `Expires` line defaults to now plus seven days and could be mistaken for actual stored expiry.
- Child environment contained PATH/HOME, the privately supplied read-only connection URL, `VARSITYHUB_ENV_PATH=/dev/null`, and `DOTENV_CONFIG_PATH=/dev/null`. No provider keys were inherited. The connection was supplied via environment, not command-line arguments. URL connection options set `default_transaction_read_only=on` as additional protection.
- Initial launch used a root `node_modules/.bin/tsx` path that does not exist; no script/DB operation ran on that attempt. Corrected to `server/node_modules/.bin/tsx`; all three definitive dry-runs succeeded.

Sanitized evidence: [grants-readonly.json](grants-readonly.json), containing the three rows and full dry-run outputs, no credentials/tokens/connection URLs.

## Current source agrees with the expiry note

- [geofencing.ts:43](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/geofencing.ts:43): canonical posting unlock duration is seven days.
- [geofencing.ts:389](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/geofencing.ts:389): permission checks elapsed time from persisted unlock anchor.
- [geofencing.ts:518](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/geofencing.ts:518) and [geofencing.ts:622](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/geofencing.ts:622): designated marker plus active unlock permits stories and posts before normal live-window denial.
- [eventPostAccess.ts:63](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/eventPostAccess.ts:63): regrant updates the unlock timestamp; designated marker upsert deliberately preserves its original metadata.
- Script: [grant-event-post-access.ts:133](/Users/varsityhub/Code/VarsityHubMobile/server/scripts/one-off/grant-event-post-access.ts:133) and the dry-run return before its mutation branches.

## Version-note reconciliation

Current HEAD remains `ec27781e3d6cd9688064bb20bab30babd33fd00c`. I independently observed Railway production `api` latest deployment `083bbc8d-2655-496b-afed-558bb35f67bc`, status SUCCESS, from `railway status --json` filtered in a subprocess. Root independently verified the same deployment and OTA group `12f04b7d` points both platform updates at `ec27781e`. This subaudit did not repeat EAS checks or certify each of the eight desktop notes individually.

The three refreshed-grant notes can now be classified **Closed for production persisted access prerequisites**, with actual media/device runtime QA still outstanding. Nothing in this production read invalidates the separate newly reproduced role/email/settings defects: those were exercised against the same current source and cover additional scenarios.
