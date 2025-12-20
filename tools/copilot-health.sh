#!/usr/bin/env zsh
# Copilot connectivity + auth health check for macOS (zsh)
set -u

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; RESET="\033[0m"

function header() { echo "${BLUE}==> $1${RESET}" }
function ok() { echo "${GREEN}✔ $1${RESET}" }
function warn() { echo "${YELLOW}⚠ $1${RESET}" }
function err() { echo "${RED}✖ $1${RESET}" }

REPORT_FILE=${REPORT_FILE:-"copilot-health-report.txt"}
: > "$REPORT_FILE"

function record() { echo "$1" | tee -a "$REPORT_FILE" > /dev/null }

function check_url() {
  local url=$1
  local name=${2:-$1}
  local out
  out=$(curl -sS -o /dev/null -w "http_code=%{http_code} remote_ip=%{remote_ip} time_total=%{time_total}s" --max-time 15 "$url" 2>&1) || out="error=$?"
  if [[ $out == http_code=2* ]]; then
    ok "${name} reachable ($out)"
    record "URL ${name} OK: $out"
  else
    err "${name} unreachable ($out)"
    record "URL ${name} FAIL: $out"
  fi
}

header "Environment"
record "DATE: $(date -u)"
record "SHELL: $SHELL"
record "OS: $(sw_vers 2>/dev/null | tr '\n' '; ')"
record "HTTP_PROXY: ${HTTP_PROXY:-}"; record "HTTPS_PROXY: ${HTTPS_PROXY:-}"; record "NO_PROXY: ${NO_PROXY:-}"

header "Network Proxy (macOS)"
if command -v networksetup >/dev/null; then
  for svc in $(networksetup -listallnetworkservices | tail -n +2); do
    record "SERVICE: $svc"
    record "HTTP Proxy: $(networksetup -getwebproxy "$svc" 2>/dev/null | tr '\n' '; ')"
    record "HTTPS Proxy: $(networksetup -getsecurewebproxy "$svc" 2>/dev/null | tr '\n' '; ')"
  done
else
  warn "networksetup not available"
fi

header "Endpoint Reachability"
check_url "https://copilot-proxy.githubusercontent.com/_ping" "copilot-proxy"
check_url "https://api.github.com" "api.github.com"
check_url "https://github.com" "github.com"
# Some environments use api.githubcopilot.com; harmless if blocked
check_url "https://api.githubcopilot.com/_ping" "api.githubcopilot.com"  

header "VS Code Copilot Extension"
EXT_DIR="$HOME/.vscode/extensions"
if [[ -d "$EXT_DIR" ]]; then
  local count
  count=$(ls -1 "$EXT_DIR" | grep -i "github.copilot" | wc -l | tr -d ' ')
  record "Copilot extensions installed: $count"
  ls -1 "$EXT_DIR" | grep -i "github.copilot" | tee -a "$REPORT_FILE" >/dev/null || true
  if [[ $count -gt 1 ]]; then warn "Multiple Copilot extensions detected (consider keeping only stable)"; fi
else
  warn "VS Code extensions folder not found ($EXT_DIR)"
fi

header "GitHub CLI session"
if command -v gh >/dev/null; then
  gh auth status 2>&1 | tee -a "$REPORT_FILE" >/dev/null || warn "gh auth status failed"
else
  warn "GitHub CLI (gh) not installed"
fi

header "Summary"
record "Finished. Full report: $REPORT_FILE"
ok "Health check complete"
