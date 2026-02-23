# Overnight Artifacts Summary (Removed)

This repo previously contained raw logs and overnight artifacts in the root (e.g. `.logs/`, `logs/`, `overnight-*`, and `overnight-results/`). The raw dumps have been removed and replaced with this concise summary so the root stays clean.

## Key notes preserved
- **Overnight pipeline (Dec 5, 2025):** lint cleanup fixed 25 files and failed 1; backend was not running; typecheck reported 13 errors; docs generation cataloged 145 screens.
- **Health checks (Dec 5, 2025):** `/health` curl requests failed against the production Railway URL during overnight runs.
- **Log archive (Dec 10, 2025):** captured build, lint, Metro, and deployment readiness outputs; raw files removed to keep the repo clean.
- **Overnight JSON results (Jan 20, 2026):** generated reports for lint/unused imports, type safety, bundle size, DB performance/indexes, API response time, and permissions tests.

If you need to regenerate any of these artifacts, run the relevant `scripts/overnight-*.sh` task and keep the outputs local (ignored) or summarize findings in `docs/status/`.
