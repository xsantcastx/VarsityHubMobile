# Download My Data remediation — September 5, 2026

The code defects in the advertised ZIP export flow have fixes and local regression
evidence. **Production export activation remains blocked on private storage
configuration.** This does not close physical iPhone download/save acceptance or
the wider A+ audit. The verified publication identifiers are recorded below.

## Reproduced baseline

Baseline `3334afd9` / product `8b8543e3`: a synthetic account against a newly migrated
local PostgreSQL database reproduced POST 202 with no storage, HTTP 200 for an
already-expired ready archive, loss of the cleanup key when deletion failed, and
eight missing ZIP sections: profile, owned teams, team memberships, organization
memberships, comments, group memberships, RSVPs and consent history. Queries used
stale schema fields hidden by `as any`. Preferences also exposed raw provider fields.

The production read-only aggregate found **zero DataExport rows**, so activating
the reviewed bounded cleanup has no existing export backlog. No production export,
test account, account credential or bucket was created for these checks.

## Changes and guarantees

- Availability checks storage configuration and a live BullMQ consumer before
  creating requests. Settings uses the shared React Query client, account-specific
  keys, explicit error/unavailable states, a duplicate-tap guard and bounded polling.
- Requests lock the account row while checking/inserting; duplicate queue deliveries
  claim work atomically. Completed or canceled requests cannot be revived by workers.
- The existing worker starts/stops with the API. The existing scheduler runs a
  bounded cleanup every 15 minutes, including abandoned pending/building requests.
  Failed object deletion retains the key for retry; recent canceled uploads settle
  before cleanup touches their keys.
- Typed selectors match the current schema. All 26 promised sections must succeed
  before upload. Canonical billing fields replace stale preference-only reads;
  preference exports allowlist user-facing values and exclude provider credentials.
- Downloads check real expiry independently of cleanup. Signed links live at most
  five minutes and never beyond archive expiry. Archive/link responses use no-store.
  Deletion stops new download links; already issued links can live until their short
  signature expires if storage deletion is temporarily unavailable.
- Export storage uses bounded SDK calls and the existing circuit breaker. R2 custom
  endpoints omit the unsupported S3 SSE header; private bucket encryption is a
  provider configuration property. The server XML parser override advances from
  broken 5.7.1 to 5.11.1 after the real S3 test reproduced response parsing failure.
  The [upstream changelog](https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md)
  records the numeric-entity compatibility repair and subsequent fixes.

No database migration or native binary change is needed. Archive retention is
seven days. A domain over 50,000 rows or total uncompressed content over 32 MiB
fails explicitly rather than silently truncating; a separate assisted export would
be required for such an account. Media URLs are included, not copies of media files.
This verifies the stated 26-section registry, not a legal certification that every
current/future database model belongs in that registry.

## Verification

See [the matrix ledger](matrix-verification-ledger.md) for scenario-level closure.
The real local integration uses PostgreSQL, BullMQ/Redis and a private MinIO bucket:
HTTP request, actual worker, complete ZIP download, unsigned denial, real signed
URL expiry, endpoint expiry, deletion and worker shutdown all pass. Fixtures are
restricted to loopback services; no provider messages or paid transactions occur.

The focused server suites include real authenticated HTTP tests and pause an upload
to test cancellation races. Child Node test processes avoid the repository's Jest
VM module-linker collision; child assertions still determine the suite result.
Seven rendered screen cases cover unavailable service, load/retry, account isolation,
duplicate taps/503 and bounded polling. Exact counts and first-run/rerun results are recorded in [the verification record](data-export-verification.json).

Keep first-run failures in the evidence: the default local database lacked the new
ad-hold table, the org-manager verifier initially paired the isolated DB with an
existing local API, and two full-client cases hit timeouts before passing targeted
reruns. The corrected local gate must use one isolated API/database pair.

The server dependency audit still reports three moderate entries unrelated to the
XML parser repair (sanitize-html, query-string and decode-uri-component). They are
not resolved by this export step and remain part of the wider readiness backlog.

## Production storage setup — outstanding

The API has no `DATA_EXPORT_S3_*` configuration. Existing media R2 credentials
return AccessDenied for bucket administration. Use the Cloudflare dashboard to:

1. Create a **dedicated private** R2 bucket such as `varsityhub-data-exports`.
   Leave public `r2.dev` access disabled; attach no public custom domain or worker
   route. Do not reuse the public media bucket.
2. Create an object read/write credential scoped only to this bucket. Add its
   values directly to the Railway **api / production** service, not to chat or git:

   ```text
   DATA_EXPORT_S3_BUCKET=varsityhub-data-exports
   DATA_EXPORT_S3_REGION=auto
   DATA_EXPORT_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   DATA_EXPORT_S3_ACCESS_KEY_ID=<bucket-scoped access key>
   DATA_EXPORT_S3_SECRET_ACCESS_KEY=<bucket-scoped secret>
   DATA_EXPORT_SIGNED_URL_TTL_SECONDS=300
   ```

3. Add a bucket lifecycle expiration rule for the `exports/` prefix after seven
   days as a storage-side backstop for crashes/account deletion. Keep encryption
   at rest enabled (R2 default). Preserve the existing Redis configuration.
4. Deploy the verified API and confirm the worker starts. Validate a non-personal
   private storage probe (upload, unsigned denial, signed download, expiry, delete).
   Then request an archive from the owner's own account and verify iPhone save/open.
   Configuration presence and general API health alone do not close this row.

Cloudflare documents [R2 credential scopes](https://developers.cloudflare.com/r2/api/tokens/),
[public bucket controls](https://developers.cloudflare.com/r2/buckets/public-buckets/)
and [S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

Until setup is complete, the released screen must show **Temporarily Unavailable**
and POST must fail before enqueueing. The user has authorized code publication;
missing provider access remains an activation dependency, not permission to expose
private archives through media storage.

## Release and rollback

Client source: `cab5b1339feadf4db5c06466fb4022f53e23912d`. Final server source: `e7f38857fd5964dcc897d4807d90a0b6ad48c6a9`. The server follow-up includes the actual saved notification switches; its ZIP assertions preserve false values and reject unknown nested token fields. The local release gate, both typechecks, worker/lifecycle regressions and real private-storage journey passed again: [field-level follow-up evidence](data-export-preferences-verification.json). Client code is unchanged.

- API: Railway `1afb5524-95d5-4242-8f8d-a8b1f92072e4`, SUCCESS (supersedes `fc1e39a0`); runtime gate passed, zero pending migrations.
- OTA: production `7e09e4a5-4dd3-4437-bf3b-a32535ab96e1`, iOS/Android runtime 1.0.5; both served manifests verified and Sentry source maps uploaded.
- Website: Vercel `dpl_3b6PfEGQVob7BzvTGE9ziFe3Zh1F`, READY; both public aliases serve matching export bytes. Ten guest route/theme checks pass with no page errors or attempted API writes.
- [Publication record](data-export-publication.json), [API evidence](data-export-api-verification.json), [OTA evidence](data-export-ota-delivery.json), [web evidence](data-export-web-verification.json).

Production `dataExportStorage=false` remains the explicit activation blocker; no production authenticated export or physical iPhone ZIP save is claimed. PR #281 remains open in the original repository; this fork branch was deployed directly. No EAS native build or submission was run.

Preserve the earlier session, role, privacy and
ad-booking fixes already deployed on this branch. Rollback is a normal source
revert, not a database rollback. Do not roll back to pre-ad-hold checkout writers.
Do not restore the broken 5.7.1 XML parser if reverting unrelated export UI code.
