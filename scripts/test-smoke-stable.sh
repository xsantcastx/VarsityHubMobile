#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_LOG="$(mktemp -t varsityhub-smoke-server.XXXXXX.log)"
WEB_LOG="$(mktemp -t varsityhub-smoke-web.XXXXXX.log)"
SERVER_PID=""
WEB_PID=""
export HEALTH_CHECK_SECRET="${HEALTH_CHECK_SECRET:-varsityhub-local-smoke-secret}"

kill_repo_listener() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return 0
  fi

  for pid in $pids; do
    local command
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"

    case "$command" in
      *"$ROOT_DIR"*|*"server/src/index.ts"*|*"expo start --web --port 8081"*)
        echo "[test:smoke] Stopping stale $label listener on :$port (pid $pid)"
        kill "$pid" >/dev/null 2>&1 || true
        wait "$pid" >/dev/null 2>&1 || true
        ;;
      *)
        echo "[test:smoke] Refusing to kill non-repo process on :$port"
        echo "[test:smoke] pid=$pid command=$command"
        return 1
        ;;
    esac
  done

  return 0
}

cleanup() {
  local exit_code=$?
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  if [ -n "${WEB_PID}" ] && kill -0 "${WEB_PID}" >/dev/null 2>&1; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
  fi
  wait "${SERVER_PID}" >/dev/null 2>&1 || true
  wait "${WEB_PID}" >/dev/null 2>&1 || true
  if [ $exit_code -ne 0 ]; then
    echo "[test:smoke] server log: $SERVER_LOG"
    echo "[test:smoke] web log: $WEB_LOG"
    echo "[test:smoke] --- server tail ---"
    tail -n 80 "$SERVER_LOG" || true
    echo "[test:smoke] --- web tail ---"
    tail -n 80 "$WEB_LOG" || true
  else
    rm -f "$SERVER_LOG" "$WEB_LOG"
  fi
  exit $exit_code
}

trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-120}"
  local started_at
  started_at="$(date +%s)"

  until curl -fsS "$url" >/dev/null 2>&1; do
    if [ $(( $(date +%s) - started_at )) -ge "$timeout_seconds" ]; then
      echo "[test:smoke] Timed out waiting for $label at $url"
      return 1
    fi
    sleep 1
  done
}

wait_for_log() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  local timeout_seconds="${4:-120}"
  local started_at
  started_at="$(date +%s)"

  until grep -Eq "$pattern" "$file" 2>/dev/null; do
    if [ $(( $(date +%s) - started_at )) -ge "$timeout_seconds" ]; then
      echo "[test:smoke] Timed out waiting for $label"
      return 1
    fi
    sleep 1
  done
}

kill_repo_listener "4000" "API"
kill_repo_listener "8081" "web"

echo "[test:smoke] Starting API server..."
NODE_ENV=development ENABLE_DEV_CODES=1 DISABLE_RATE_LIMITING=1 PLAYWRIGHT_E2E=1 npx tsx server/src/index.ts >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

wait_for_url "http://127.0.0.1:4000/health" "API server"

echo "[test:smoke] Starting web server..."
EXPO_PUBLIC_API_URL=http://localhost:4000 npm run web:playwright:ci >"$WEB_LOG" 2>&1 &
WEB_PID=$!

wait_for_url "http://127.0.0.1:8081" "web server"
wait_for_log "$WEB_LOG" "Web Bundled .*node_modules/expo-router/entry.js|LOG  \\[web\\] Logs will appear in the browser console" "Expo web bundle"

echo "[test:smoke] Running Playwright..."
API_URL=http://127.0.0.1:4000 EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 PLAYWRIGHT_SKIP_SERVER=1 npx playwright test "$@"
