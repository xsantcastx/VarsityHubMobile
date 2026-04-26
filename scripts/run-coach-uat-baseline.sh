#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[coach-uat] Running Expo doctor"
doctor_status=0
doctor_output="$(npm run doctor 2>&1)" || doctor_status=$?
printf '%s\n' "$doctor_output"
if [ "$doctor_status" -ne 0 ]; then
  if grep -q "Check for app config fields that may not be synced in a non-CNG project" <<<"$doctor_output"; then
    echo "[coach-uat] Expo doctor reported the expected prebuild sync warning; continuing"
  else
    exit "$doctor_status"
  fi
fi

echo "[coach-uat] Running client-side coach guard tests"
npm test -- --runInBand \
  __tests__/roleChecks.test.ts \
  __tests__/postAuthRouting.test.ts \
  __tests__/approval-flow.test.ts \
  __tests__/onboarding-no-skip.test.ts

echo "[coach-uat] Running server-side coach gate tests"
npm --prefix server test -- --runInBand \
  src/__tests__/coach-gate-matrix.test.ts \
  src/__tests__/coach-upgrade-paid-plan-guard.test.ts \
  src/__tests__/coach-agreement-versioning.test.ts \
  src/__tests__/coach-approval.test.ts \
  src/__tests__/coach-ui-approval-guards.test.ts

echo "[coach-uat] Baseline checks complete"
echo "[coach-uat] Next: npm run coach:uat:prepare"
echo "[coach-uat] Checklist: docs/COACH_DEVICE_UAT.md"
