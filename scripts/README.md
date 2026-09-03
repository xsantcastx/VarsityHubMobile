# VarsityHub Scripts

This folder is for repository-level commands used by `package.json`, CI, release checks, and local developer workflows.

## Live Entry Points

Prefer package scripts over calling files directly:

- `npm run dev`
- `npm run release:verify:local`
- `npm run release:verify:build`
- `npm run release:verify:runtime`
- `npm run verify:guardrails`
- `npm run verify:error-envelope`
- `npm run audit:navigation`
- `npm run audit:structural-duplicates`
- `npm run check:conflicts`
- `npm run format:check`

## Organization Rule

- `verify:*` and `audit:*` scripts should be wired through `package.json`.
- One-off operational scripts should include the date and reason in the filename or live under a scoped folder.
- Historical scripts belong under `scripts/moved-from-root/` or a future `scripts/archive/` folder.
- Server/database scripts belong under `server/scripts/`, not here.

Before adding a new script, check whether an existing `npm run verify:*`, `npm run audit:*`, or `npm run release:*` command already covers the workflow.
