# PR body for fix/audit-drift-2026-07 → main

Open at: https://github.com/xsantcastx/VarsityHubMobile/compare/main...fix/audit-drift-2026-07

---

## What this ships

**Server security (each pinned by a new contract test):**

- `POST /teams/:id/invite` now enforces the roster cap and rejects role changes on pending invites — parity with `POST /team-invites`, which in turn gains the already-member guard. The two invite endpoints are now behaviorally identical (`team-invite-endpoint-parity.test.ts`).
- Admin privilege always requires a verified email: new `isVerifiedAdminUser()` helper; all bare admin-email checks in `games.ts` (record/summary/pending-list **plus** game delete, score edit, cover edit, result flag — found in review) and `organizations.ts` members route are closed (`admin-check-verification-parity.test.ts`).
- `PATCH /events/:id` gets the org-admin fallback its cancel sibling already had — league owners can edit their own league's events (`event-edit-permissions.test.ts`).
- Scheduler fallback (no-Redis mode) now derives from the single `SCHEDULED_JOBS` list via node-cron — was silently dropping 5 jobs incl. Stripe/Apple reconciliation; also fixes a pre-existing double-registration (`scheduler-fallback-parity.test.ts`).
- `renderAppHandoffPage` escapes title/description internally (`public-handoff-escaping.test.ts`).

**Client consistency (pinned by `__tests__/validation-consistency.test.ts`):**

- change-password uses canonical `validatePassword` (letter+number rule)
- create-team plan badge uses canonical `normalizePlan` (legacy premium/pro aliases)
- message-thread labels use canonical `formatUserLabel` (display-name-first)
- username rule consolidated onto `formUtils` (`USERNAME_REGEX`)

**Infra/hygiene:**

- Web deploy bakes the Sentry DSN into the bundle at export time — the live site currently ships the SDK with **no DSN bound** (verified in-browser 2026-07-13); first deploy after merge fixes web error tracking
- Dockerfile: `apt-get upgrade` + latest npm in both stages (clears 23 base-image container CVEs; first Railway build post-merge is the real verification)
- Server CVE overrides (brace-expansion 5.0.7, js-yaml 4.3.0), `.snyk` ignores for verified false positives (image-size, escapeHtml-indirection XSS), rate-limit checker regex fix (verify:p0:foundation green), all 19 pre-existing lint warnings cleared, stale audit docs corrected

## Verification

- Final whole-branch review (opus): **ready to merge** — every admin rewire strictly tightens; the one intended widening is the events-edit org-admin grant
- Both typechecks 0 errors · `test:regressions` 175/175 · `verify:p0:foundation` exit 0 (payments confidence 26/26) · 5 new server contract suites + client validation suite all green · lint 0 problems
- `git merge-tree` vs current main: conflict-free (the 1.0.5/buildNumber-56 bumps exist identically on both sides)

## Merge notes

- Merging auto-deploys: server (Railway), web (Vercel — now with Sentry), and an OTA publish targeting runtime **1.0.5** (no users yet; current binary is 1.0.4). Client fixes reach users with the 1.0.5 binary.
- No schema changes, no new env vars, BullMQ path untouched.
- Snyk PR checks may show red from the org's exhausted monthly test quota (200/200) — that's billing, not this diff.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
