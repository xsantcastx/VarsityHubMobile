# npm Audit Automation

Continuous security monitoring for dependencies using a hybrid approach.

## Components

### 1. Pre-Commit Hook (`.husky/pre-commit`)

Runs **before every commit** to prevent accidental dependency vulnerabilities from reaching main.

**Behavior:**

- Audits root and server with `--audit-level=moderate` (ignores low-severity)
- Regenerates audit snapshots (`server/npm-audit-root.json`, `server/npm-audit-server.json`)
- Blocks commit if moderate or higher vulnerabilities found
- Minimal friction—only takes ~2 seconds on clean audits

**When it matters:**

- Direct `package.json` edits or `npm install` before commit
- Catch accidental vulnerable dependency pulls
- Dev-only, doesn't slow CI

### 2. GitHub Actions Workflow (`.github/workflows/npm-audit.yml`)

Scheduled and event-driven audits with reporting.

**Triggers:**

- **Nightly**: 2 AM UTC (10 PM EST) - catches new vulnerabilities in existing deps
- **On PR**: When `package*.json` changes - verify PR dependencies
- **On push to main**: Verify merged changes pass full audit

**Behavior:**

- Runs full `npm audit` (includes all severity levels)
- Parses results and comments on PRs with summary
- Uploads audit JSON artifacts for historical tracking
- **Fails the workflow** if any vulnerabilities found
- Makes it impossible to merge breaking changes without acknowledging them

**Alert flow:**

1. New vuln discovered → workflow fails
2. Error visible in PR checks
3. Artifact available for investigation
4. PR author must resolve or explicitly override with `.snyk` policy

## Usage

### For developers

```bash
# Pre-commit runs automatically
git add <files>
git commit -m "..."  # ← Audit runs here, blocks if issues found

# To manually check before commit
npm audit --audit-level=moderate  # Root
cd server && npm audit --audit-level=moderate  # Server
```

### For ops

```bash
# View recent audit runs
gh run list -w npm-audit.yml -L 10

# Download latest artifacts
gh run download -n npm-audit-reports <run-id>

# Manually trigger
gh workflow run npm-audit.yml
```

## Thresholds

| Level    | Pre-Commit | CI/CD             |
| -------- | ---------- | ----------------- |
| Critical | ❌ Blocks  | ❌ Fails          |
| High     | ❌ Blocks  | ❌ Fails          |
| Moderate | ❌ Blocks  | ❌ Fails          |
| Low      | ✅ Allows  | ❌ Fails (logged) |

**Rationale:** Pre-commit is lenient (moderate+) to avoid blocking dev flow for low-severity issues already managed in `.snyk`. CI/CD is strict (all levels) to enforce policy in main branch.

## Exceptions

If you need to accept a vulnerability temporarily:

1. Add to `.snyk` policy file with expiration date:

   ```bash
   snyk ignore --id=SNYK-JS-PACKAGE-000000 --expiry=2025-12-25 --reason="Waiting for upstream fix"
   ```

2. Commit the updated `.snyk` file
3. Pre-commit hook will respect the ignore
4. CI/CD will pass (policy-aware)

## Monitoring

**Audit artifacts** are stored in GitHub Actions for 90 days:

- `audit-root.json` - Full root audit output (machine-readable)
- `audit-server.json` - Full server audit output (machine-readable)

Access via:

1. GitHub web UI → Actions → npm Audit & Dependency Check → Latest run → Artifacts
2. CLI: `gh run download <run-id> -n npm-audit-reports`

## Next Steps

- First run will happen at scheduled time or on next PR with `package.json` changes
- Check workflow status in `.github/workflows/npm-audit.yml` after first commit
- Consider adding Slack/email notifications if you want immediate alerts (optional enhancement)
