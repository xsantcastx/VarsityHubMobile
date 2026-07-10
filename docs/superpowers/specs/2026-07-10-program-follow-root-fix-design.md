# Program Follow — Root Fix (ProgramFollow intent ledger)

**Date:** 2026-07-10
**Status:** Approved; folds into the Phase 3 follow model (PR #155) so it ships correct.
**Supersedes:** the spun-off "reconciliation" task and the union-read/fan-out-write known-issues in #155.

## The root cause

Phase 3 shipped follow as **union-read / fan-out-write**: following a program writes a `TeamFollow` row per level team, and `is_following`/`followers_count` are computed as a union over those teams. `TeamFollow` has no provenance column, so "I followed the program" is byte-identical to "I followed this one team." Every documented known-issue is a symptom of that single gap:

1. Partial unfollow reads as followed (unfollow one level team → program still "Following").
2. A team added to a program later doesn't reach existing followers' feeds (no row is written for it).
3. `is_following: true` never actually meant "you receive all program posts."

## The fix: record intent, keep the feed on TeamFollow

Add `ProgramFollow` as an **intent ledger alongside** the fan-out — it does not replace `TeamFollow` and **the feed clauses are untouched** (they still read `TeamFollow` rows). Add `TeamFollow.via_program_id` so a program-driven follow is distinguishable from a direct one, making unfollow lossless.

- **`ProgramFollow`** `@@id([user_id, program_id])` — the record of "I follow this program."
- **`TeamFollow.via_program_id`** (nullable FK → `SportProgram`, `onDelete: SetNull`) — stamped on fan-out rows, null on direct follows.

### Semantics

| Surface               | Old (union)                              | New (intent)                                                                                   |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `is_following`        | follows any level team                   | a `ProgramFollow` row exists                                                                   |
| `followers_count`     | DISTINCT users over level teams          | `ProgramFollow` count                                                                          |
| `POST /follow`        | fan out TeamFollow rows                  | write `ProgramFollow` **and** fan out TeamFollow stamped `via_program_id`                      |
| `DELETE /follow`      | delete all the program's TeamFollow rows | delete the `ProgramFollow` row **and** only TeamFollow rows stamped with this `via_program_id` |
| team added to program | nothing (gap)                            | fan out stamped TeamFollow to all current `ProgramFollow` users — exact, no heuristic          |

### Why `followers_count` moves to intent too (amendment over the first design)

The program-page Follow button optimistically does `count + 1`. Under a union count, a viewer who already followed one level team taps Follow, the count ticks up, then the refetch returns the same number (the union already counted them) — it snaps back, an asymmetric flicker. Intent count makes the number the button moves the number displayed. There is no existing count to "regress" (greenfield). A true reach figure, if wanted, is a separate coach stat.

### Why lossless DELETE (`via_program_id`)

A JV-only follower who taps Follow on the program gains a `ProgramFollow` row + a stamped varsity `TeamFollow`, and keeps their pre-existing **unstamped** (null `via_program_id`) JV row. Unfollowing the program deletes only the stamped rows and the `ProgramFollow` row — the JV follow they had for a year survives. Greenfield, so no ambiguous legacy rows exist.

### Client is already correct

`is_following` and `followers_count` keep the same field names and types. The program-page optimistic counter (`+1`/`-1`) becomes exactly right under intent semantics with **no client code change** — the client was always right; the server semantics were wrong. The only client-side churn is a test whose fixture asserted the old union behavior.

## What this fixes / accepts

- Fixes known-issues #1, #2, #3 from #155 — that section is deleted from the PR, not appended to.
- Accepted, documented: attaching a **private** team to a program still fans it out to existing program followers (a coach action affecting N users). Behavior is intentional and consistent with follow-time; a coach-facing disclosure note is a deferred UX follow-up, not a correctness bug.

## Integration cost (from the spawned session's investigation)

A new model must register in: `dbBackupTables.ts` `TABLES_IN_ORDER` (schema-parity test `db-backup-table-order.test.ts`), `wipeProduction.ts`, `dataExport/builder.ts` (GDPR completeness). `TeamFollow.via_program_id` needs no deferred-FK entry — `SportProgram` sorts before `TeamFollow`, so it fills in the main insert pass.

## Placement & migration ordering

Lands on `feat/sport-programs-phase-3`. Migration timestamp `20260710090000_program_follow` sorts **before** program-per-sport's `20260710120000` so the sequence is clean after `feat/program-per-sport` (#156) rebases on top. Then #156 rebases; its `programs.ts`/schema hunks conflict-resolve against this.
