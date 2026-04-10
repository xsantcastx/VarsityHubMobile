# Organization Changelog

## 2026-04-10

- Added `docs/REPO_AUDIT.md` and `docs/EMAIL_AUDIT.md`.
- Moved shared app source into `src/`:
  - `api`
  - `config`
  - `constants`
  - `context`
  - `hooks`
  - `types`
  - `utils`
- Standardized root aliases and test/lint config to resolve shared code from `src/`.
- Added placeholder `src/features/`, `src/services/`, and `src/theme/` structure.
- Centralized remaining email sends behind `EmailService` instead of direct SendGrid calls.
- Added reusable fallback email template renderers under `server/src/services/email/templates/`.
- Added repo-level formatting scripts and lightweight GitHub Actions CI.
- Added environment and email architecture documentation.
- Scoped event approval review to managed teams and organizations instead of exposing all pending events to any coach.
- Fixed ad checkout to route back through `payment-success`, blocked approval of unpaid ads, and aligned the free-promo ad path with the paid `active` state.
- Added `docs/OVERNIGHT_TASKS_2026-04-10.md` to sequence the remaining blockers for this week.
