#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/varsityhub-web-static.XXXXXX")"
SCOPE="${VERCEL_SCOPE:-${1:-}}"
if [[ -n "${VERCEL_CUSTOM_DOMAINS:-}" ]]; then
  read -ra CUSTOM_DOMAINS <<< "$VERCEL_CUSTOM_DOMAINS"
else
  CUSTOM_DOMAINS=(www.varsityhub.app varsityhub.app)
fi

VERCEL_ARGS=()
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  VERCEL_ARGS+=(--token "$VERCEL_TOKEN")
fi
if [[ -n "$SCOPE" ]]; then
  VERCEL_ARGS+=(--scope "$SCOPE")
fi

cleanup() {
  rm -rf "$DEPLOY_DIR"
}

trap cleanup EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd npx
require_cmd node
require_cmd cp
require_cmd mkdir
require_cmd perl

if [[ ! -f "$ROOT_DIR/.vercel/project.json" ]]; then
  echo "Missing .vercel/project.json. Run 'npx vercel link' first." >&2
  exit 1
fi

cd "$ROOT_DIR"

echo "Exporting static web bundle..."
node scripts/with-production-client-env.js npx expo export --platform web

echo "Preparing static-only Vercel deployment..."
mkdir -p "$DEPLOY_DIR/.vercel"
cp -R "$ROOT_DIR/dist/." "$DEPLOY_DIR/"
cp "$ROOT_DIR/.vercel/project.json" "$DEPLOY_DIR/.vercel/project.json"
if [[ -f "$ROOT_DIR/.vercel/README.txt" ]]; then
  cp "$ROOT_DIR/.vercel/README.txt" "$DEPLOY_DIR/.vercel/README.txt"
fi

# Vercel ignores uploaded files nested under a `node_modules` path, but Expo's
# web export writes several runtime assets there (icon fonts, router images,
# calendar arrows). Move them under a neutral path and rewrite references in the
# exported bundle before deploying.
if [[ -d "$DEPLOY_DIR/assets/node_modules" ]]; then
  mkdir -p "$DEPLOY_DIR/assets/vendor"
  cp -R "$DEPLOY_DIR/assets/node_modules/." "$DEPLOY_DIR/assets/vendor/"
  rm -rf "$DEPLOY_DIR/assets/node_modules"

  while IFS= read -r -d '' file; do
    perl -0pi -e 's#/assets/node_modules/#/assets/vendor/#g' "$file"
  done < <(find "$DEPLOY_DIR" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.map' \) -print0)
fi

# Derive the deployment vercel.json from the repo root vercel.json — the
# single source of truth for redirects/rewrites/headers. Build-time keys are
# stripped because this deploy dir is a prebuilt static bundle.
node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const key of ["buildCommand", "outputDirectory", "installCommand", "framework", "ignoreCommand"]) {
  delete cfg[key];
}
fs.writeFileSync(process.argv[2], JSON.stringify(cfg, null, 2) + "\n");
' "$ROOT_DIR/vercel.json" "$DEPLOY_DIR/vercel.json"

cd "$DEPLOY_DIR"

echo "Deploying static bundle to Vercel..."
if [[ ${#VERCEL_ARGS[@]} -gt 0 ]]; then
  if ! DEPLOY_OUTPUT="$(npx vercel --prod --yes "${VERCEL_ARGS[@]}")"; then
    printf '%s\n' "$DEPLOY_OUTPUT" >&2
    echo "Vercel deployment failed before aliasing custom domains." >&2
    exit 1
  fi
else
  if ! DEPLOY_OUTPUT="$(npx vercel --prod --yes)"; then
    printf '%s\n' "$DEPLOY_OUTPUT" >&2
    echo "Vercel deployment failed before aliasing custom domains." >&2
    exit 1
  fi
fi
echo "$DEPLOY_OUTPUT"
DEPLOY_URL="$(DEPLOY_OUTPUT="$DEPLOY_OUTPUT" node -e '
const output = process.env.DEPLOY_OUTPUT || "";
const matches = output.match(/https:\/\/[^\s"]+\.vercel\.app/g) || [];
const deploymentUrl = matches.find((url) => !url.includes("vercel.com/"));
if (!deploymentUrl) {
  process.exit(1);
}
console.log(deploymentUrl);
')"
echo "Deployed: $DEPLOY_URL"

# `vercel --prod` creates a new deployment but does NOT move existing custom
# domain aliases onto it — www.varsityhub.app/varsityhub.app stay pinned to
# whatever deployment they were last aliased to until explicitly repointed.
# Without this step, the site silently keeps serving the old build forever.
for domain in "${CUSTOM_DOMAINS[@]}"; do
  echo "Aliasing $domain -> $DEPLOY_URL"
  if [[ ${#VERCEL_ARGS[@]} -gt 0 ]]; then
    npx vercel alias set "$DEPLOY_URL" "$domain" "${VERCEL_ARGS[@]}"
  else
    npx vercel alias set "$DEPLOY_URL" "$domain"
  fi
done
