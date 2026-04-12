#!/usr/bin/env bash
#
# Connection-pool sanity check.
#
# Fires N parallel GET requests against a chosen endpoint and reports p50/p95
# latency plus error rate. The goal is not a load test — it's proof that the
# auto-injected `connection_limit=20` (server/src/lib/prisma-pool-defaults.ts)
# holds under modest concurrency without starving on Railway Postgres.
#
# Usage:
#   API_URL=https://api-production-…up.railway.app \
#   AUTH_JWT=eyJ…            # required if hitting a protected path
#   ENDPOINT=/posts?limit=20 # default
#   CONCURRENCY=50           # default
#   REQUESTS=500             # default
#   bash scripts/release-checks/pool-stress.sh

set -euo pipefail

API_URL="${API_URL:?API_URL is required}"
ENDPOINT="${ENDPOINT:-/posts?limit=20}"
CONCURRENCY="${CONCURRENCY:-50}"
REQUESTS="${REQUESTS:-500}"
AUTH_ARGS=()
if [[ -n "${AUTH_JWT:-}" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${AUTH_JWT}")
fi

TARGET="${API_URL%/}${ENDPOINT}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "→ Target: ${TARGET}"
echo "→ Concurrency: ${CONCURRENCY}   Requests: ${REQUESTS}"
echo "→ Starting at $(date -u +%FT%TZ)"
echo

# Worker function. Emits `<http_status>,<ms>` on stdout, one line per request.
run_one() {
  local i="$1"
  local status elapsed_ms
  local start_ms end_ms
  start_ms=$(perl -MTime::HiRes=time -e 'printf("%.0f", time()*1000)')
  status=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH_ARGS[@]}" "$TARGET" || echo "000")
  end_ms=$(perl -MTime::HiRes=time -e 'printf("%.0f", time()*1000)')
  elapsed_ms=$((end_ms - start_ms))
  printf '%s,%s\n' "$status" "$elapsed_ms" > "$TMP/r-$i"
}
export -f run_one
export TMP TARGET
export AUTH_ARGS_STR
AUTH_ARGS_STR=$(printf ' %q' "${AUTH_ARGS[@]}")

seq 1 "$REQUESTS" | xargs -P "$CONCURRENCY" -I{} bash -c '
  start=$(perl -MTime::HiRes=time -e "printf(\"%.0f\", time()*1000)")
  status=$(eval curl -sS -o /dev/null -w "%{http_code}"${AUTH_ARGS_STR}" \"$TARGET\"" || echo "000")
  end=$(perl -MTime::HiRes=time -e "printf(\"%.0f\", time()*1000)")
  printf "%s,%s\n" "$status" "$((end - start))" > "$TMP/r-{}"
'

cat "$TMP"/r-* > "$TMP/all.csv"
TOTAL=$(wc -l < "$TMP/all.csv" | tr -d ' ')
OK=$(awk -F, '$1 == "200" { c++ } END { print c+0 }' "$TMP/all.csv")
FAIL=$(awk -F, '$1 != "200" { c++ } END { print c+0 }' "$TMP/all.csv")

echo
echo "Results"
echo "-------"
echo "Total:   ${TOTAL}"
echo "200 OK:  ${OK}"
echo "Errors:  ${FAIL}"

LATENCIES=$(awk -F, '{ print $2 }' "$TMP/all.csv" | sort -n)
pct() {
  local p="$1"
  echo "$LATENCIES" | awk -v p="$p" -v t="$TOTAL" 'NR==int(t*p)+1'
}
echo "p50 ms:  $(pct 0.50)"
echo "p95 ms:  $(pct 0.95)"
echo "p99 ms:  $(pct 0.99)"
echo "max ms:  $(echo "$LATENCIES" | tail -1)"
echo

if [[ "$FAIL" -gt 0 ]]; then
  echo "Error breakdown:"
  awk -F, '$1 != "200" { c[$1]++ } END { for (s in c) printf "  %s: %d\n", s, c[s] }' "$TMP/all.csv"
  echo
fi

echo "Pass criteria (suggested for a 50-concurrency / 500-request probe):"
echo "  - error rate < 1%"
echo "  - p95 < 1000ms against a hot feed endpoint"
echo "  - no 503/504 (those mean the pool starved or Postgres timed out)"
