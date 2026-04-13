#!/usr/bin/env bash
#
# Set the app version/runtime target in both app.json and package.json.
# This is for OTA targeting when runtimeVersion.policy = appVersion.
#
# Usage:
#   bash scripts/release-checks/set-runtime-version.sh 1.0.1
#   bash scripts/release-checks/set-runtime-version.sh 1.0.2

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

TARGET_VERSION="${1:-}"
if [[ -z "${TARGET_VERSION}" ]]; then
  echo "✗ target version required. Example: bash scripts/release-checks/set-runtime-version.sh 1.0.1" >&2
  exit 1
fi

if [[ ! "${TARGET_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✗ invalid version '${TARGET_VERSION}'. Expected semver like 1.0.1" >&2
  exit 1
fi

node - "${TARGET_VERSION}" <<'NODE'
const fs = require('fs');
const path = require('path');

const targetVersion = process.argv[2];
const repoRoot = process.cwd();
const appJsonPath = path.join(repoRoot, 'app.json');
const packageJsonPath = path.join(repoRoot, 'package.json');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (!appJson.expo) {
  throw new Error('app.json missing expo object');
}

appJson.expo.version = targetVersion;
packageJson.version = targetVersion;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
NODE

echo "✓ Set app runtime target to ${TARGET_VERSION}"
echo "  app.json expo.version  -> ${TARGET_VERSION}"
echo "  package.json version   -> ${TARGET_VERSION}"
echo
echo "Reminder:"
echo "  runtimeVersion policy is appVersion, so EAS Update now targets ${TARGET_VERSION} installs."
