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
require_cmd cp
require_cmd mkdir
require_cmd perl

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

cat > "$DEPLOY_DIR/vercel.json" <<'EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "redirects": [
    {
      "source": "/((?!\\.well-known/).*)",
      "has": [{ "type": "host", "value": "varsityhub.app" }],
      "destination": "https://www.varsityhub.app/$1",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/events/:id",
      "has": [
        {
          "type": "header",
          "key": "user-agent",
          "value": ".*(facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|SkypeUriPreview|redditbot|Applebot).*"
        }
      ],
      "destination": "https://api-production-8ac3.up.railway.app/og/events/:id"
    },
    {
      "source": "/games/:id",
      "has": [
        {
          "type": "header",
          "key": "user-agent",
          "value": ".*(facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|SkypeUriPreview|redditbot|Applebot).*"
        }
      ],
      "destination": "https://api-production-8ac3.up.railway.app/og/games/:id"
    }
  ],
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
      "source": "/.well-known/apple-app-site-association",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
    },
    {
      "source": "/.well-known/assetlinks.json",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
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

echo "Deploying static bundle to Vercel..."
DEPLOY_URL="$(npx vercel --prod --yes "${VERCEL_ARGS[@]}")"
echo "Deployed: $DEPLOY_URL"

# `vercel --prod` creates a new deployment but does NOT move existing custom
# domain aliases onto it — www.varsityhub.app/varsityhub.app stay pinned to
# whatever deployment they were last aliased to until explicitly repointed.
# Without this step, the site silently keeps serving the old build forever.
for domain in "${CUSTOM_DOMAINS[@]}"; do
  echo "Aliasing $domain -> $DEPLOY_URL"
  npx vercel alias set "$DEPLOY_URL" "$domain" "${VERCEL_ARGS[@]}"
done
