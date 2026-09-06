# Data export readiness follow-up — 2026-09-05

Follow-up: [current remediation and activation dependency](data-export-remediation.md). The source trace below remains the before-fix evidence.

Read-only review of deployed API source `8b8543e3`, deployment `54143be0-d7ae-4a40-bfb0-2b830bf44384`. No production export request, account/token use, storage request, email, environment mutation, or source edit was performed. This is a source trace plus production configuration-presence evidence, not an end-to-end export test.

## Result

The settings ZIP export journey is not ready. `dataExportStorage=false` is accurate: all four required `DATA_EXPORT_S3_BUCKET`, `DATA_EXPORT_S3_REGION`, `DATA_EXPORT_S3_ACCESS_KEY_ID`, and `DATA_EXPORT_S3_SECRET_ACCESS_KEY` variables are absent. The optional endpoint is also absent. `REDIS_URL` is present and the production runtime health check reports Redis ready. Values were kept in memory; only booleans were saved to `data-export-config-presence.json`.

`server/src/lib/objectStorage.ts:64` uses only those export-specific variables. Its sole production adapter is S3-compatible; Cloudinary/public media storage is not a fallback. `server/src/routes/health.ts:86` delegates directly to that adapter's `isConfigured()` check. Health treats export storage as optional for whole-API readiness, which explains the passing runtime gate.

## User-visible behavior inferred from current source

- `app/settings/index.tsx:994` advertises **Download My Data** and opens `/settings/data-export`.
- `app/settings/data-export.tsx:201` disables requests only while busy/in flight or within the successful-export rate limit. It does not query storage/worker availability. The page offers **Request New Export** and promises a ZIP archive, seven-day expiry, and automatic status updates.
- `apiclient/entities.ts:236` calls the queued `/me/data-export` lifecycle only. It has no alternative export path.
- `server/src/routes/dataExport.ts:148` creates a pending row and enqueues it without checking storage. A successful queue insertion returns 202. The 503 path at this stage is queue failure, not storage failure.
- `startDataExportWorker` is exported in `server/src/workers/dataExportWorker.ts:146` but has no production import/caller in the repository. `server/src/index.ts:256` initializes queues and starts the separate scheduler worker; it does not start the export worker. Therefore, absent a separately maintained external consumer not represented in this repository, a successful request remains pending. The UI polls every five seconds for at most five minutes, then stops. A pending export blocks another request until dismissed.
- If the existing export worker were started while configuration remained absent, its explicit check at `server/src/workers/dataExportWorker.ts:66` would set `failed` with `error_category=storage_not_configured`. The UI renders this as **Failure reason: storage not configured**.

There is an older authenticated `GET /users/me/export` endpoint at `server/src/routes/users.ts:363` that returns JSON directly from database queries without object storage. It exports fewer domains than the ZIP builder (for example, it lacks the ZIP's billing, team membership, group chat, and event exports). It is mounted in the production app, but the client has no reference to it. It is not a fallback for the advertised settings journey, and its production execution was not tested in this review.

## Related readiness claims that must remain open

- The current health warning and `docs/release/LAUNCH_READINESS_GATE.md:150` say missing export storage makes POST return 503. The current route instead accepts/enqueues when Redis works. Record the actual condition rather than repeating that stale claim.
- `startDataExportCleanup` is deliberately deferred in `server/src/app.ts:501`. Merely adding storage credentials and starting the worker would not establish retention/expiry. The download route at `server/src/routes/dataExport.ts:229` checks the persisted `expired` status, not whether a ready row's `expires_at` is already past. Cleanup needs its own reviewed activation; first activation can process accumulated rows. The existing cleanup sweep reaps `building` rows, not indefinitely `pending` rows.
- Existing endpoint tests mock queue insertion and worker tests invoke `processExportJob` directly. Those checks do not prove production worker startup, private storage writes, downloads, or expiry.

## Minimal concrete next step

Keep this journey open in the A+ settings ledger and take it as a separate bounded data-export readiness step. First make unavailable service behavior truthful: reject before creating/enqueuing an export when the backend is unavailable and present a clear unavailable state in settings. To enable the feature, use a dedicated private S3/R2 bucket with the existing adapter, wire the existing export worker into startup/shutdown, review pending-row handling and the intentionally deferred cleanup backlog, and enforce expiry at download time. Then run an authorized synthetic-account request → actual archive build → signed download → expiry/deletion test against private storage. A successful configuration-presence check alone does not close this journey. Do not repurpose the public media bucket or silently route settings to the narrower legacy JSON endpoint.

No change is proposed for the in-flight session-recovery release.
