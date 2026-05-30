#!/bin/bash
#
# Canonical release workflow for VarsityHub.
# This keeps the older verification scripts, but puts them in one strict order.
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BLUE=$'\033[0;34m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
NC=$'\033[0m'

PHASE="${1:-help}"

print_header() {
  printf '\n%s== %s ==%s\n' "$BLUE" "$1" "$NC"
}

run_step() {
  local label="$1"
  shift
  printf '%s->%s %s\n' "$BLUE" "$NC" "$label"
  "$@"
}

resolve_base_url() {
  if [ -n "${BASE_URL:-}" ]; then
    printf '%s' "${BASE_URL%/}"
    return 0
  fi

  node -e "require('dotenv').config(); process.stdout.write((process.env.EXPO_PUBLIC_API_URL || '').replace(/\\/$/, ''));" 2>/dev/null || true
}

phase_local() {
  print_header "Phase 1: Local code and approval gate"
  run_step "Lint" npm run lint
  run_step "App typecheck" npm run typecheck
  run_step "Server typecheck" npx tsc --noEmit --project server/tsconfig.json
  run_step "Guardrails" npm run verify:guardrails
  run_step "Pre-release drift audit" npm run audit:pre-release
  run_step "Release readiness audit" npm run verify:release
  run_step "Regression suites" npm run test:regressions
  run_step "Expo doctor" npm run doctor
  run_step "Coach UAT baseline" npm run coach:uat:baseline
  run_step "Coach approval wiring" npm --prefix server run verify:coach-approval
  run_step "Org-manager approval access" npm --prefix server run verify:org-manager-access
  run_step "Email go-live audit" npm --prefix server run verify:email-go-live
}

phase_build() {
  print_header "Phase 2: Build-specific gate"
  run_step "Build readiness verification" env SKIP_RELEASE_READINESS=1 bash scripts/verify-build-ready.sh
}

phase_runtime() {
  local base_url
  base_url="$(resolve_base_url)"

  if [ -z "$base_url" ]; then
    printf '%sMissing BASE_URL.%s Set BASE_URL or EXPO_PUBLIC_API_URL before runtime verification.\n' "$RED" "$NC" >&2
    exit 1
  fi

  print_header "Phase 3: Runtime and provider gate"
  printf '%sUsing BASE_URL=%s%s\n' "$GREEN" "$base_url" "$NC"
  run_step "Production health" env BASE_URL="$base_url" npm --prefix server run verify:production-health
  run_step "Email catalog/env audit" npm --prefix server run verify:email-go-live
  run_step "Email runtime config" npm --prefix server run verify:email

  printf '\n%sManual follow-up required:%s\n' "$YELLOW" "$NC"
  printf '  - docs/release/PENDING_OPERATOR_ACTIONS.md\n'
  printf '  - docs/release/EMAIL_GO_LIVE_CHECKLIST.md\n'
  printf '  - docs/COACH_DEVICE_UAT.md\n'
  printf '  - docs/release/LAUNCH_READINESS_GATE.md\n'
}

phase_full() {
  phase_local
  phase_build
  phase_runtime
}

print_help() {
  cat <<'EOF'
Usage:
  bash scripts/release-workflow.sh local
  bash scripts/release-workflow.sh build
  bash scripts/release-workflow.sh runtime
  bash scripts/release-workflow.sh full

Phase meanings:
  local    code, regression, approval, and local runtime checks
  build    pre-build checks that protect EAS credits
  runtime  production/Railway/SendGrid verification after env changes
  full     run all phases in order

Canonical doc:
  docs/release/RELEASE_WORKFLOW.md
EOF
}

case "$PHASE" in
  local)
    phase_local
    ;;
  build)
    phase_build
    ;;
  runtime)
    phase_runtime
    ;;
  full)
    phase_full
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    printf '%sUnknown phase:%s %s\n' "$RED" "$NC" "$PHASE" >&2
    print_help
    exit 1
    ;;
esac
