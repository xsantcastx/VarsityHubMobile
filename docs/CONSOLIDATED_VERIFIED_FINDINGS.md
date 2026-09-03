# Consolidated Verified Findings

**Date:** 2026-08-24
**Method:** Every still-open item across archived root snapshots
`docs/archive/audits/root/MASTER_BUG_REPORT.md` (147 findings) and
`docs/archive/audits/root/AUDIT_V2.md` (Feature-Matrix audit) was re-checked against current `main`. Only findings that **still
reproduce in the current code** are listed as open. Each was verified by reading the actual
source, not by trusting the audit's (now-drifted) line numbers.

This document supersedes the stale root-level audit files for day-to-day triage. See
[Audit reliability](#audit-reliability-why-this-list-is-short) below for why almost everything
in those files is already closed.

---

## Still open (verified reproducing)

### Real bugs

| ID    | Sev      | Finding                                                                                                                                                                                                         | Evidence (current `main`)                                                                             | Fix                                                                   | Status   |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| CVF-1 | Minor    | DM composer capped at 1000 chars while the server accepts 5000 — users silently can't send a message the backend would allow (was MSG-09)                                                                       | `app/message-thread.tsx` `maxLength={1000}` vs `server/src/routes/messages.ts` `z.string().max(5000)` | Raise client `maxLength` to 5000 to match server                      | ✅ FIXED |
| CVF-2 | Degraded | `manage-season` **Standings** and **Playoffs** tabs render hardcoded fake data ("Eagles" 10‑2, "Our Team" 8‑3‑1) with no placeholder label — coaches see fabricated standings for their real season (was EV-08) | `app/manage-season.tsx` `const standingsData: StandingsTeam[] = [ …mock… ]` (+ mock `playoffBracket`) | Label both tabs as sample/preview data until real standings are wired | ✅ FIXED |

### Feature gap (not a regression)

| ID    | Finding                                                                                                 | Evidence                                                                            | Note                                       |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| CVF-3 | No **event** auto-archive job — owner wanted events auto-archived 3 days after their date (was V2 #172) | Ad archival exists in `server/src/cron/overnightTasks.ts`; no equivalent for events | Net-new cron feature, not a bug. Deferred. |

### Policy questions (code is deliberate — confirm intent)

| ID    | Finding                                                                                              | Evidence                                                                                                  | Decision needed                                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| CVF-4 | DM rate limit is **60/min (3600/hr)**; Feature-Matrix target was **100/hr** (was V2 BUG-3 / #177)    | `server/src/middleware/rateLimiters.ts` `messageLimiter … max: 60`                                        | Is 100/hr still the intent? Current is 36× looser (spam headroom).                                                                             |
| CVF-5 | "No ad refunds" policy vs. code that **auto-refunds on SLOT_FULL overbooking** (was V2 BUG-2 / #176) | `server/src/routes/payments.ts` `stripe.refunds.create({ reason: 'requested_by_customer' })` on SLOT_FULL | Dashboard/dispute refund handling is legally required (can't refuse a chargeback) — **only** the overbooking auto-refund is the open question. |

---

## Audit reliability — why this list is short

The root-level audit files are heavily obsolete. Of ~40 distinct findings opened against
current `main` across every severity, only the 5 above still reproduce. Notable closures:

- **All 16 MASTER `BLOCKING` items → none reproduce.**
- **Deleted files:** `app/team-viewer.tsx` (moots TM‑01/02/03/12) and
  `server/src/routes/gameStories.ts` (moots FD‑01) no longer exist — team logic moved to
  `app/team-page.tsx`.
- **Subsystems rewritten:** IAP/ads (closes AD‑01 `Math.round`, AD‑02 no-orphan-PaymentIntent,
  AD‑03 queue-based verification, AD‑05 `admin_note` surfaced, PAY‑05 `verifyInnerJWS`);
  moderation → `STRIKE_LADDER` (makes the #124‑127 threshold reconciliation obsolete);
  admin-guard hardening (ADM‑01 email-verified check, ADM‑04 single ban route).
- **Directly fixed:** coach reapply + 48h cooldown (#58/#59), group-chat add-member (#93),
  `postCreationLimiter` wired to `POST /posts` (#166), highlights `media_url` filter removed
  (#167), feed RSVP batched into one `/events/rsvp-summary` call (FD‑02), push badge support
  added (NF‑04), fan pending-limit enforced on `POST /games` (EV‑01), reset-code re-request
  path (AUTH‑01), payment-cancel routing (PAY‑01), `rejection_reason` field (TM‑04),
  `display_name` null→undefined (PS‑03).
- **Mischaracterizations:** ad plan-gate is intentional-by-design; the multer 25MB vs
  Cloudinary 150MB split is intentional (memory-storage OOM guard vs. direct-to-Cloudinary).

### Reliability ranking of the source audits

1. `docs/AUDIT_CLAIM_VERIFICATION.md` — purpose-built to reconcile stale claims against a
   pinned commit. Most reliable.
2. `docs/archive/audits/root/AUDIT.md` — really a fix-log; its "All Issues Ranked" appendix is honest about
   FIXED vs. ALREADY-GUARDED vs. deferred.
3. `docs/archive/audits/root/PRODUCTION_AUDIT_REPORT.md` — narrow (build/submit config), concrete, self-corrects.
4. `docs/archive/audits/root/AUDIT_V2.md` — specific `file:line` findings, but several "bugs" are now intentional or fixed.
5. 2025 security triplet (`docs/archive/audits/root/FRONTEND_AUDIT_REPORT.md` A+, `docs/archive/audits/root/INTEGRATION_AUDIT_REPORT.md` A-,
   `server/BACKEND_AUDIT_REPORT.md` B) — coherent but 16+ months stale.
6. `docs/archive/audits/root/MASTER_BUG_REPORT.md` — largest (147), no date, no verification, demonstrable false
   positives (e.g. AD‑01). Least reliable.
7. Tiny archived stubs (`docs/archive/audits/root/API_AUDIT.md`, `docs/archive/audits/root/SECURITY_AUDIT.md`, etc.) — closure notes, **not audits**;
   zero current findings.

The authoritative living standard is the **Security & Architecture Audit Standard + PR
Checklist in `CLAUDE.md`**, which points at real wired `npm run verify:*` scripts and invariant
test suites — not any of these snapshot files.

### Coverage note

All 16 MASTER `BLOCKING` items, all 4 `AUDIT_V2` critical bugs, all 7 `AUDIT_V2` P1 and both
checked P2 items, and a cross-section of ~15 `DEGRADED`/`COSMETIC` findings (auth, payments,
feed, profile, messaging, events, admin) were individually verified. The remaining ~35
unchecked `COSMETIC` items are all single-screen client nits; on the observed base rate
(2 of ~40 opened still live) they are very likely stale, but were not each opened.
