# July 4th Punch-List Leftovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining code gaps from the July 4th punch list — the "vs TBD" root cause (opponent suggestions never send `away_team_id`) and the TikTok-style one-line caption preview — and hand the user a device checklist for the five items already fixed in code.

**Architecture:** Two surgical client changes. (1) `create-fan-event.tsx` gains `opponentTeamId` state so picking an opponent from the suggestions dropdown links the real team (`away_team_id`) while free-typing stays a display-only placeholder — the server contract for both already exists and is verified (`server/scripts/july4-notes-verification.ts` items A/B). (2) The fullscreen viewer's caption drops from a 3-line to a 1-line collapsed preview; `ExpandableText` already supports tap-to-expand-and-collapse, and the other five call sites keep their current `maxLines`.

**Tech Stack:** React Native / Expo, Jest.

**Triage verdicts this plan is built on** (2026-07-05 investigation, three Explore agents):
| Punch item | Verdict | Evidence |
|---|---|---|
| 1. Pitch-event team selector stuck low | ✅ Fixed (`d5a2d20b`, pageSheet modal + search) | no task |
| 2. Add-Game opponent / "vs TBD" | ⚠️ One client gap remains | **Task 1** |
| 3. "Home Venue" → "Venue" | ✅ Fixed (zero string matches) | no task |
| 4. Upload/crop aspect mismatches | ✅ Fixed (`4ea9ef94`, bg 3:2→2:1; all others matched) | no task |
| 5. Manage Org route | ✅ Working end-to-end incl. legacy owners | no task |
| 6. Chat bubble alignment | ✅ Code correct (mine=right, theirs=left) | device check only |
| 7. TikTok caption preview | ⚠️ Feature change | **Task 2** |

**Branch strategy:** These changes touch `GameVerticalFeedScreen.tsx`'s caption overlay — the same block PR #111 modified (EventChip). To avoid a guaranteed merge conflict, implement on a new branch **cut from `fix/event-screen-dedupe`** if #111 is still open, or from `main` after #111 merges. Branch name: `fix/july4-leftovers`.

**Working-tree caution:** `app/onboarding/fan-permissions.tsx` + `__tests__/fan-permissions.test.tsx` (another session's uncommitted work) and `eas.json`/`package.json` (OTA-session edits) are in the tree. Stage ONLY the files named in each task.

---

## File Structure

| File                                              | Change                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/create-fan-event.tsx`                        | `opponentTeamId` state; set on suggestion pick, clear on free-text edit; include `away_team_id` in the game payload; export pure `buildOpponentFields` helper |
| `app/__tests__/create-fan-event.opponent.test.ts` | NEW — unit tests for the helper (linked vs placeholder)                                                                                                       |
| `app/game-details/GameVerticalFeedScreen.tsx`     | Caption overlay `maxLines` 3 → 1                                                                                                                              |

---

### Task 1: Opponent suggestions must link the real team (`away_team_id`)

**Files:**

- Modify: `app/create-fan-event.tsx` (state ~line 225, suggestion onPress ~line 1007-1010, free-text onChange ~line 983-985, game payload ~lines 587-606)
- Create: `app/__tests__/create-fan-event.opponent.test.ts`

Root cause (triage-verified): the form stores only the opponent _name_. Picking "Manchester United" from the dropdown calls `setOpponent(t.name)` and discards `t.id`, so the payload never contains `away_team_id` and the server treats every opponent as a free-text placeholder. The server already accepts and correctly stores both forms (verified live by `july4-notes-verification.ts` items A/B).

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/create-fan-event.opponent.test.ts`:

```ts
/**
 * "vs TBD" root cause guard: an opponent picked from the suggestions
 * dropdown must produce a LINKED payload (away_team_id + away_team),
 * while free-typed text stays a display-only placeholder (away_team only).
 * Server contract verified in server/scripts/july4-notes-verification.ts A/B.
 */
import { buildOpponentFields } from '../create-fan-event';

describe('buildOpponentFields', () => {
  it('links the team when a suggestion was selected', () => {
    expect(buildOpponentFields('Manchester United', 'team-123')).toEqual({
      away_team: 'Manchester United',
      away_team_id: 'team-123',
    });
  });

  it('sends a display-only placeholder for free-typed opponents', () => {
    expect(buildOpponentFields('Some HS Eagles', '')).toEqual({
      away_team: 'Some HS Eagles',
    });
  });

  it('omits both fields when the opponent is blank', () => {
    expect(buildOpponentFields('', '')).toEqual({});
    expect(buildOpponentFields('   ', 'team-123')).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest app/__tests__/create-fan-event.opponent.test.ts --no-coverage 2>&1 | tail -5`
Expected: FAIL — `buildOpponentFields` is not exported.

- [ ] **Step 3: Implement**

In `app/create-fan-event.tsx`:

(a) Add the exported pure helper near the top of the file (after imports, before the component):

```ts
// "vs TBD" root cause: suggestions must link the real team. Exported for tests.
export const buildOpponentFields = (
  opponentName: string,
  opponentTeamId: string
): { away_team?: string; away_team_id?: string } => {
  const name = opponentName.trim();
  if (!name) return {};
  return opponentTeamId ? { away_team: name, away_team_id: opponentTeamId } : { away_team: name };
};
```

(b) Add state next to the existing `opponent` state (~line 225):

```ts
// Set only when the user picks a suggestion — links the real Team row.
// Cleared when they keep typing (free text = display-only placeholder).
const [opponentTeamId, setOpponentTeamId] = useState('');
```

(c) In the suggestion `onPress` (~line 1007-1010), alongside `setOpponent(t.name)` add:

```ts
setOpponentTeamId(String(t.id));
```

(d) In the opponent `TextInput` `onChangeText` (~line 983-985), alongside `setOpponent(...)` add:

```ts
setOpponentTeamId('');
```

(e) In the game-creation payload build (~lines 587-606), replace the current `away_team: opponent...` line(s) with a spread of the helper (match the exact existing key: read the payload object first — the triage found the name-only field at line 599):

```ts
        ...buildOpponentFields(opponent, opponentTeamId),
```

Keep everything else in the payload identical.

- [ ] **Step 4: Verify**

Run: `npx jest app/__tests__/create-fan-event.opponent.test.ts --no-coverage 2>&1 | tail -4` → 3 PASS.
Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors.
Run: `npx prettier --check app/create-fan-event.tsx app/__tests__/create-fan-event.opponent.test.ts` → clean (run `--write` on ONLY these files if not).

- [ ] **Step 5: Commit**

```bash
git add app/create-fan-event.tsx app/__tests__/create-fan-event.opponent.test.ts
git commit -m "fix(games): opponent suggestions link away_team_id (vs TBD root cause)"
```

---

### Task 2: TikTok-style one-line caption preview in the fullscreen viewer

**Files:**

- Modify: `app/game-details/GameVerticalFeedScreen.tsx` (caption overlay `ExpandableText`, currently `maxLines={3}` directly below the EventChip row)

Triage confirmed `ExpandableText` fully supports expand AND collapse; this is a one-prop change scoped to the caption overlay only. The 5 other call sites (PostCard ×2, MasonryPostCard, post-detail, the viewer's own text-only card at `maxLines={4}`) MUST stay unchanged.

- [ ] **Step 1: Make the change**

In the caption overlay block (the one containing `styles.captionText`, NOT the text-only card):

```tsx
<ExpandableText
  text={post.caption}
  maxLines={1}
  style={styles.captionText}
  expandStyle={styles.captionToggle}
/>
```

(Only `maxLines={3}` → `maxLines={1}`; everything else identical.)

- [ ] **Step 2: Verify the other call sites are untouched**

Run: `rg -n "maxLines=\{" app/game-details/GameVerticalFeedScreen.tsx components/PostCard.tsx components/MasonryPostCard.tsx app/post-detail.tsx`
Expected: the caption-overlay hit shows `1`; the text-only card still shows `4`; PostCard shows `2` and `3`; MasonryPostCard `3`; post-detail `6`.

- [ ] **Step 3: Run the viewer suites**

Run: `npx jest app/game-details/__tests__ --no-coverage 2>&1 | tail -4`
Expected: PASS (caption-chain + nav + mapper-consistency suites).

- [ ] **Step 4: Commit**

```bash
git add app/game-details/GameVerticalFeedScreen.tsx
git commit -m "feat(viewer): one-line TikTok-style caption preview with tap to expand"
```

---

### Task 3: Gates + ship + device checklist (no code)

- [ ] **Step 1: Full gates**

Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors.
Run: `npx jest app/__tests__ app/game-details/__tests__ utils/__tests__ --no-coverage 2>&1 | tail -4` → all pass.
Run: `npm run check:conflicts` → clean.
Run: `npm run audit:navigation:fail` → 0 REVIEW items (no new replaces added, should be untouched).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin fix/july4-leftovers
```

```bash
gh pr create --title "fix(july4): opponent linkage root cause + one-line caption preview" --body "Closes the two remaining July 4th punch-list code gaps; triage doc in docs/superpowers/plans/2026-07-05-july4-leftovers.md. Items 1/3/4/5/6 verified already fixed in code."
```

- [ ] **Step 3: Remind the user (client-only changes)**

Both changes are client-side: after merge, they reach users only via `npm run update:production` (+ two cold starts). No server deploy needed.

- [ ] **Step 4: Device checklist for the already-fixed items** (user, post-OTA)

1. Pitch an event → team picker opens as a full-height sheet with search (not stuck low).
2. Add a game → pick an opponent from suggestions → team page shows the real opponent name from BOTH teams' pages (no "vs TBD").
3. Create/edit profile background, team/org logos → crop frame matches how the image displays.
4. Discover → Manage Org → lands on the organization screen (including legacy owner accounts).
5. Open any chat → your messages right-aligned blue, theirs left-aligned. If still wrong on device, screenshot it — code review found the styles correct, so a live repro would point somewhere new.

---

## Explicitly out of scope

- Items 1/3/4/5/6 — already fixed in code (see triage table); only device confirmation remains.
- The fan-permissions onboarding fix — separate session's work, its own branch.
- Video compression — separate session; needs a new store binary.

## Self-Review (completed)

- **Spec coverage:** both STILL-BROKEN triage verdicts map to Tasks 1–2; all FIXED verdicts map to the device checklist. ✓
- **Placeholder scan:** none — full code in every step. ✓
- **Type consistency:** `buildOpponentFields(name: string, id: string)` used identically in test (Task 1 Step 1) and implementation (Step 3a/3e). ✓
