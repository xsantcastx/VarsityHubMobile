# Audit Scorecard

Use this for scheduled audits, incident follow-ups, and pre-release
architecture/security reviews. Fill it out with evidence, not opinions.

## Metadata

- Date:
- Auditor:
- Branch / commit:
- Scope:
- Trigger:

## Scoring

| Category                                   | Status                | Evidence | Findings |
| ------------------------------------------ | --------------------- | -------- | -------- |
| System mapping complete                    | pass / partial / fail |          |          |
| Source-of-truth table accurate             | pass / partial / fail |          |          |
| Trust boundaries explicit                  | pass / partial / fail |          |          |
| Auth + role + plan + ownership enforcement | pass / partial / fail |          |          |
| Validation drift checked                   | pass / partial / fail |          |          |
| Idempotency / replay safety                | pass / partial / fail |          |          |
| Admin audit logging coverage               | pass / partial / fail |          |          |
| Deep-link safety                           | pass / partial / fail |          |          |
| Route architecture matches standard        | pass / partial / fail |          |          |
| Loading / error / empty / success states   | pass / partial / fail |          |          |
| Typecheck / guardrails / regressions       | pass / partial / fail |          |          |
| Device-only/manual release gates           | pass / partial / fail |          |          |

## Trust Boundaries

| Boundary                 | Revalidation point | Evidence |
| ------------------------ | ------------------ | -------- |
| Unauthenticated client   |                    |          |
| Authenticated client     |                    |          |
| Admin client             |                    |          |
| Deep links / email links |                    |          |
| Webhooks / third parties |                    |          |
| Background jobs / cron   |                    |          |
| Storage / uploads        |                    |          |

## Findings

| Severity                       | Title | Exploitability | Blast radius | Recoverability | Evidence |
| ------------------------------ | ----- | -------------- | ------------ | -------------- | -------- |
| CRITICAL / HIGH / MEDIUM / LOW |       |                |              |                |          |

## Verification

- `npx tsc --noEmit --project server/tsconfig.json`:
- `npx tsc --noEmit`:
- `npm run test:regressions`:
- `npm run verify:guardrails`:
- Targeted proofs / curls / manual checks:

## Release Decision

- Ship:
- Blockers:
- Manual follow-ups:
