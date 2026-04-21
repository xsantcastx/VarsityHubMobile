# Audit: Version Drift Assumptions 2026-04

This audit did not find an active production break. It found that the app currently relies on disciplined deploy ordering rather than explicit client/server compatibility enforcement.

## Current assumption

- deploy order is:
  1. server first
  2. OTA second
  3. new binary only when runtime version changes
- older clients are rare enough that silent field fallback is acceptable

## Current gaps

- no `X-App-Version` header on API requests
- no `/capabilities` or `/version` compatibility endpoint
- no server-side force-update or min-supported-version gate
- several client reads use optional chaining and fallbacks that degrade silently instead of failing loudly

## Known masking behavior

- missing plan/tier fields can fall back to rookie/free-tier behavior
- field drift may look like “feature unavailable” instead of “protocol mismatch”
- pre-`1.0.1` binaries do not receive `1.0.1` OTA content if runtime versions differ

## Why this is not a bug today

- current releases are close together
- the agreed release discipline for `1.0.1` is server deploy, verification, then OTA
- no evidence in this pass that live users are split across incompatible protocol generations

## What becomes a bug later

- a future release introduces a required field or required server behavior
- an old binary remains in the field long enough to miss OTA compatibility
- silent fallback hides a payments, entitlements, or onboarding regression

## Future hardening plan

1. Add `X-App-Version` to API requests.
2. Add a lightweight `/capabilities` or `/version` endpoint on the server.
3. Define `min_supported_version` server-side for force-update behavior.
4. Replace silent client defaults in money/onboarding/subscription paths with explicit mismatch handling where appropriate.

## Status

No code change required for `1.0.1`.
