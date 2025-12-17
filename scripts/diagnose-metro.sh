#!/usr/bin/env bash
set -euo pipefail

echo "Diagnosing Metro config…"
echo "Node: $(node -v || echo 'missing')"
echo "npm:  $(npm -v || echo 'missing')"

if [[ ! -d node_modules ]]; then
  echo "❌ node_modules is missing or incomplete. Run 'npm install' or 'npm ci' with network access."
  exit 1
fi

if [[ ! -f metro.config.js ]]; then
  echo "❌ metro.config.js not found at project root."
  exit 1
fi

node -e "require('./metro.config.js'); console.log('✅ Metro config loads: ok')"
echo "Done."
