#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/varsityhub-web-static.XXXXXX")"
SCOPE="${VERCEL_SCOPE:-${1:-}}"

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
require_cmd cp
require_cmd mkdir

if [[ ! -f "$ROOT_DIR/.vercel/project.json" ]]; then
  echo "Missing .vercel/project.json. Run 'npx vercel link' first." >&2
  exit 1
fi

cd "$ROOT_DIR"

echo "Exporting static web bundle..."
npx expo export --platform web

echo "Preparing static-only Vercel deployment..."
mkdir -p "$DEPLOY_DIR/.vercel"
cp -R "$ROOT_DIR/dist/." "$DEPLOY_DIR/"
cp "$ROOT_DIR/.vercel/project.json" "$DEPLOY_DIR/.vercel/project.json"
if [[ -f "$ROOT_DIR/.vercel/README.txt" ]]; then
  cp "$ROOT_DIR/.vercel/README.txt" "$DEPLOY_DIR/.vercel/README.txt"
fi

cat > "$DEPLOY_DIR/vercel.json" <<'EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" }
      ]
    },
    {
      "source": "/_expo/static/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
EOF

cd "$DEPLOY_DIR"

DEPLOY_CMD=(npx vercel --prod --yes)
if [[ -n "$SCOPE" ]]; then
  DEPLOY_CMD+=(--scope "$SCOPE")
fi

echo "Deploying static bundle to Vercel..."
"${DEPLOY_CMD[@]}"
