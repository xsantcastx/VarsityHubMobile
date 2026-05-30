#!/bin/bash
set -euo pipefail

REPORT_PATH="${REPORT_PATH:-verification-report.txt}"

{
  echo "# VarsityHub Production Readiness Report"
  echo
  echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  bash scripts/verify-confidence.sh
} | tee "$REPORT_PATH"
