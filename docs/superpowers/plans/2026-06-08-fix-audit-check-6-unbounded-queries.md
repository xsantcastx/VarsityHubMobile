# Fix Audit Check #6 — Unbounded Queries False Positive

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken single-line `findMany` grep in `CLAUDE.md`'s audit checklist with a command that delegates to the existing Jest regression test, eliminating ~200 false-positive hits per audit run.

**Architecture:** The current grep `grep -rn "findMany" ... | grep -v "take"` fails because Prisma query objects always put `take:` on a separate line from `findMany(`. The codebase already has a correct context-window test (`server/src/__tests__/unbounded-queries.test.ts`) that scans 50-line windows and passes clean. The audit check should invoke that test directly, not re-implement a weaker version.

**Tech Stack:** bash grep, Jest (already installed), CLAUDE.md markdown.

---

## Investigation Summary (already done — do not redo)

**What we confirmed before writing this plan:**

| File | Lines flagged | Reality |
|---|---|---|
| `src/lib/privacyUtils.ts` | 37, 54, 75, 88, 93, 99, 190 | All have `take:` 1–4 lines below. `take: 50000` with Redis cache in front. |
| `src/lib/mentionNotifications.ts` | 34, 50, 97, 106, 112 | All bounded by input array length (`take: usernames.length`, `take: recipientIds.length`). |
| `src/lib/billingLifecycle.ts` | 421 | `take: limit` two lines below — `limit` param defaults to 100. |
| `src/lib/accountDeletion.ts` | 60, 106 | `take: maxPerRun` and `take: 100` immediately below. |
| `src/lib/accountDeletion.ts` | 173, 178 | Carry `// audit-allow unbounded` comments — legitimate full enumeration for account deletion cleanup. |
| `server/src/__tests__/unbounded-queries.test.ts` | — | **Passes clean. 0 violations.** This is the authoritative check. |

**Root cause of false positives:** The grep matches the line containing `.findMany(` and filters out lines that also contain the word `take` on that same line. Since Prisma's multi-line query syntax always puts `take:` on its own line inside the object literal, no `findMany(` line ever contains `take` — so every query is flagged regardless of whether it's bounded.

---

## Files to Modify

| File | Change |
|---|---|
| `CLAUDE.md` | Replace check #6 grep with `cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 \| tail -5` |
| `CLAUDE.md` | Update the "Audit Checklist" section's unbounded-queries check to match |

No new files. No server changes. No client changes.

---

## Task 1: Verify the Jest test is the right replacement

**Files:**
- Read: `server/src/__tests__/unbounded-queries.test.ts`
- Read: `CLAUDE.md` (lines containing "findMany" and "Unbounded")

- [ ] **Step 1: Confirm the Jest test passes and prints a clear signal**

```bash
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -5
```

Expected output (exact):
```
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.4 s
Ran all test suites matching /unbounded-queries/i.
```

If it prints `FAIL` instead of `PASS`, stop — do not proceed with this plan. Investigate what the test catches before changing the audit check.

- [ ] **Step 2: Confirm the broken grep produces false positives**

```bash
grep -rn "findMany" server/src/ --include="*.ts" | grep -v "take" | wc -l
```

Expected: a number **greater than 50** (currently ~200). This confirms the grep is noisy.

```bash
grep -rn "findMany" server/src/lib/privacyUtils.ts | grep -v "take"
```

Expected: multiple lines. Then verify each is actually bounded:

```bash
grep -n "findMany\|take" server/src/lib/privacyUtils.ts | head -20
```

Expected: every `findMany` line is followed within 1–5 lines by a `take:` line. This confirms false-positive nature.

---

## Task 2: Update the Quick Checks section in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — the `## Quick Checks` section

- [ ] **Step 1: Find the current unbounded-queries check**

Open `CLAUDE.md` and locate this block inside `## Quick Checks`:

```bash
# Unbounded queries
grep -rn "findMany" server/src/ --include="*.ts" | grep -v "take"
```

- [ ] **Step 2: Replace with the Jest test invocation**

Replace that block with:

```bash
# Unbounded queries — delegates to the context-window regression test
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -3
```

The `tail -3` shows `Tests: N passed` or `FAIL` clearly without watchman noise.

- [ ] **Step 3: Verify the edit looks right**

```bash
grep -A2 "Unbounded queries" CLAUDE.md
```

Expected output:
```
# Unbounded queries — delegates to the context-window regression test
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -3
```

---

## Task 3: Update the Audit Checklist section in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — the `## Audit Checklist (Run Before Each PR)` section

- [ ] **Step 1: Find the current unbounded-queries check in the Audit Checklist**

Open `CLAUDE.md` and locate this line inside `## Audit Checklist (Run Before Each PR)`:

```bash
# Unbounded queries
grep -rn "findMany" server/src/ --include="*.ts" | grep -v "take"
```

- [ ] **Step 2: Replace with the Jest test**

Replace that line with:

```bash
# Unbounded queries
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -3
```

- [ ] **Step 3: Verify both audit sections now use the Jest check**

```bash
grep -n "findMany\|unbounded-queries" CLAUDE.md
```

Expected: zero lines containing the old `grep -rn "findMany" server/src/` pattern, and two lines containing `npx jest --testPathPattern="unbounded-queries"` (one in Quick Checks, one in Audit Checklist).

---

## Task 4: Smoke-test the updated audit flow end-to-end

- [ ] **Step 1: Run the full audit check #6 as it will appear in future audits**

```bash
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -3
```

Expected:
```
Tests:       1 passed, 1 total
Time:        0.4 s
Ran all test suites matching /unbounded-queries/i.
```

Status: ✅ PASS — no false positives, clean signal.

- [ ] **Step 2: Confirm the old grep is gone from CLAUDE.md**

```bash
grep "findMany.*server/src\|server/src.*findMany" CLAUDE.md
```

Expected: no output (empty). If any lines appear, the old grep was not fully replaced.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "fix(audit): replace false-positive findMany grep with Jest unbounded-queries test

The single-line grep flagged ~200 false positives every audit because
Prisma puts take: on a separate line from findMany(). The codebase
already has a correct context-window regression test that passes clean.
Delegates audit check #6 to that test directly."
```

---

## Self-Review

**Spec coverage:**
- ✅ Root cause identified and documented
- ✅ CLAUDE.md Quick Checks updated
- ✅ CLAUDE.md Audit Checklist updated
- ✅ Smoke test verifies the new check works
- ✅ Commit message explains the why

**Placeholder scan:** None found.

**Type consistency:** N/A — no code changes, only bash commands and markdown.

**Gaps:** None. The scope is intentionally narrow — fix the audit check, nothing else. The queries themselves are all correctly bounded; no query changes are needed.
