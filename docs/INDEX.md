# VarsityHub Docs Index

This is the live documentation entry point. Keep this page short: if a document is not current operating guidance, move it under `docs/archive/` or link it from a historical section only.

## Current Operating Docs

- [Architecture](./ARCHITECTURE.md) - canonical system architecture and invariants.
- [Audit Claim Verification](./AUDIT_CLAIM_VERIFICATION.md) - current audit-claim reconciliation against source.
- [Consolidated Verified Findings](./CONSOLIDATED_VERIFIED_FINDINGS.md) - current verified findings and policy questions.
- [Security Backlog](./SECURITY_BACKLOG.md) - tracked security follow-ups.
- [Release Workflow](./release/RELEASE_WORKFLOW.md) - canonical release path.
- [Launch Readiness Gate](./release/LAUNCH_READINESS_GATE.md) - current launch sign-off state.
- [Vercel Deployment](./release/VERCEL_DEPLOYMENT.md) - web deployment guide.
- [Project Structure](./02-PROJECT-STRUCTURE.md) - repository layout.
- [Environment](./03-ENVIRONMENT.md) - environment setup and variables.
- [Troubleshooting](./11-TROUBLESHOOTING.md) - active troubleshooting guide.

## Runbooks

- [Production Alerts](./production-alerts.md)
- [Sentry Alerts](./sentry-alerts.md)
- [Pro Schedule Rolling Runbook](./pro-schedule-rolling-runbook.md)
- [P0 Break-Glass: Payments + Webhooks](./runbooks/P0_BREAK_GLASS_PAYMENTS_AND_WEBHOOKS.md)
- [P0 Database Backup + Restore Drill](./runbooks/P0_DATABASE_BACKUP_AND_RESTORE_DRILL.md)

## Testing And Release Checks

- [Manual QA Checklist](./manual-qa-checklist.md)
- [Smoke Checklist](./SMOKE_CHECKLIST.md)
- [App Store Reviewer Notes](./app-store-reviewer-notes.md)
- [P0 Payment Confidence Suite](./testing/P0_PAYMENT_CONFIDENCE_SUITE.md)
- [P0 Load And Concurrency Validation](./testing/P0_LOAD_AND_CONCURRENCY_VALIDATION.md)

## Historical Material

- [Root audit snapshots](./archive/audits/root/) - retired root-level audit and report files.
- [Organization history](./archive/organization/) - retired cleanup and repository reorganization reports.
- [Archived docs](./archive/) - historical implementation notes and superseded runbooks.
- [Moved-from-root docs](./moved-from-root/) - old root docs retained for traceability.
- [Status docs](./status/) - historical status snapshots unless linked above.

## Rule

When adding new docs, prefer updating an existing current doc. Add a new top-level doc only if it will remain useful after the current task is finished.
