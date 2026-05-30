#!/bin/bash
#
# Compatibility wrapper.
# The canonical ordered flow now lives in scripts/release-workflow.sh.
#

set -euo pipefail

echo "validate-pre-launch.sh now forwards to the canonical release workflow."
echo "Run npm run release:verify:local directly if you want the new entrypoint."
exec bash scripts/release-workflow.sh local
