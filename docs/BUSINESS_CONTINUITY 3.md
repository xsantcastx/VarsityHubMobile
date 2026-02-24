# Business Continuity & Disaster Recovery

> Status: draft. This document consolidates current state and open decisions.

## 1) Backup & Recovery

### Current State
- Database backups: Railway automatic daily backups (see `docs/PRODUCTION_HARDENING.md`).
- Media redundancy: none (single Cloudinary storage).
- Log retention: none (no persistent log storage).

### Recovery Objectives (TBD)
- RTO (max acceptable downtime): TBD.
- RPO (max acceptable data loss): TBD.

### Backup Verification (Recommended)
- Weekly backup verification (see `docs/PRODUCTION_HARDENING.md`).
- Document restore steps and test cadence.

### Recovery Steps (Draft)
- Database restore: restore from Railway backup to a new database instance.
- App/API rollback: redeploy last known good build.
- Media restore: if implemented, restore from S3 backups.

## 2) Disaster Recovery

### Current State
- No formal DR environment or failover documented.
- No documented restore runbook.

### Action Items
- Define primary/secondary regions and failover process.
- Implement media backup redundancy (S3 or equivalent).
- Add log aggregation and retention.
- Establish documented restore runbook.

## 3) Monitoring, Alerts, and Response

### Current State
- Sentry runtime monitoring is configured (see `docs/MONITORING_SETUP.md`).
- No documented on-call rotation or alert routing.

### Notification & Response Targets (TBD)
- Who gets notified: TBD.
- Response time SLA: TBD.
- Escalation path: TBD.

## 4) Documentation & Runbooks

### Existing Runbooks
- Troubleshooting guide: `docs/11-TROUBLESHOOTING.md`.
- Security incident response (secrets rotation): `docs/SECURITY_INCIDENT_RESPONSE.md`.

### Needed Runbooks
- Backup restore runbook.
- DR failover runbook.
- Incident notification/communication plan.

## 5) Compliance Notes

- GDPR/CCPA checklists exist but are not fully completed (see `docs/09-LEGAL.md`).
- Account deletion/anonymization behavior documented in `docs/PROFILE_SETTINGS_FIXES_APPLIED.md`.
- Public legal docs are in `docs/legal/`.

