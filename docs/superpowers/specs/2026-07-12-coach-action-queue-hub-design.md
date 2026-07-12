# Coach Hub — Needs-Action Queue (design)

**Date:** 2026-07-12
**Status:** Approved (design), pending implementation plan
**Scope:** Turn the coach entry point (`team-hub`) from a bare redirect into a real coach home whose one job is: *show everything across my teams that's waiting on me, and let me act on it.*

---

## 1. Problem

`app/(tabs)/team-hub.tsx` is the coach-only tab entry (gated by `useRequireTeamManagement`), but today it just **redirects**: if the coach has a canonical org it sends them to `/organization?tab=overview`, else to their first managed team's `/team-admin`, else to `/(tabs)`. A new coach lands on a page that immediately bounces them elsewhere — there is no consolidated "what needs me" surface. The three things that block a coach's teammates/opponents (pending event approvals, pending game approvals, org join requests) each live on their own screen; nothing aggregates them.

**Non-goals (YAGNI):** athlete anything (VarsityHub has no athletes); a full analytics dashboard; the tab badge (deferred); refactoring the three existing approval screens.

## 2. Approach

Chosen: **a new server aggregation endpoint** (`GET /me/action-queue`) that the hub renders. Rejected alternatives: client-side fan-out (3 round-trips, merge logic in the screen, no single source for a future badge) and counts-only chips (barely more than `team-admin` already shows).

Rationale: one round-trip; the "what needs my action" logic is server-authoritative and lives in one place (`lib/`), which also kills the drift class the coach/org audit surfaced (parallel implementations diverging); and the `total` count can drive a tab badge later without new work.

## 3. Server

### 3.1 Route — `GET /me/action-queue`
- Thin handler in the appropriate router (co-located with the `me` routes), wrapped in `asyncHandler`, error-envelope compliant.
- Middleware: `requireAuth` + `requireOnboarded`. **Not** coach-gated at the route — it is a "my action queue" for any authenticated onboarded user; a user who manages nothing simply gets an empty queue. Coach-only gating is the *screen's* job (`useRequireTeamManagement` on `team-hub`), not the endpoint's. This keeps the endpoint reusable (e.g. a future org-owner surface) and avoids a 403 for a legitimate-but-empty caller.
- Delegates entirely to `lib/coachActionQueue.ts` — no query logic in the route.

### 3.2 Logic — `lib/coachActionQueue.ts`
`buildCoachActionQueue(userId): Promise<ActionQueue>`

1. **Resolve scope server-side (never from the client):**
   - `manageableTeamIds` — teams the user can manage (`canManageAnyTeam` / the membership + org-admin logic already in `teamAuthorization.ts`).
   - `ownedOrgIds` — orgs where the user is owner (incl. legacy `league_owner_id`).
2. **Aggregate three pending sources**, each reusing the WHERE-logic the existing screens already use (extracted/shared so there is one definition):
   - **events** — pending event approvals for `manageableTeamIds`.
   - **games** — pending game approvals for `manageableTeamIds` (incl. `opponent_approval_status = 'pending'` awaiting this team's consent).
   - **requests** — org/coach join requests for `ownedOrgIds`.
3. Each source is **bounded** (`take` cap per source, e.g. 50) and only counts items awaiting *this* user's action (not items the user themselves submitted — no self-action).
4. Merge → sort by `created_at` ascending (oldest-waiting first) → return.

### 3.3 Response shape
```ts
type ActionKind = 'event' | 'game' | 'request';
interface ActionItem {
  kind: ActionKind;
  id: string;
  title: string;          // e.g. "Eagles vs Hawks" / "Practice — Field 3" / "J. Smith wants to join"
  subtitle: string;       // date/venue, or org/team name
  team_id?: string | null;
  org_id?: string | null;
  created_at: string;     // ISO
  route: string;          // deep-link the client pushes to act
}
interface ActionQueue {
  total: number;
  counts: { events: number; games: number; requests: number };
  items: ActionItem[];
}
```
`route` is built server-side from the existing route contracts (`/event-approvals?...`, `/game/[id]`, `/organization-join-requests?...`) so the client just `router.push(item.route)`.

### 3.4 Client type + schema
`api/entities.ts` gains `Me.actionQueue()`; a Zod schema in `api/schemas/*` validates the response (passthrough, drift-reported like the team schemas).

## 4. Client — `team-hub` becomes the hub

`app/(tabs)/team-hub.tsx`:
- Keep the `useRequireTeamManagement` gate + `CoachAccessRedirecting` fallback for non-coaches (unchanged auth behavior).
- Replace the redirect with the queue UI, driven by react-query `['action-queue', userId]` → `Me.actionQueue()` (single `lib/queryClient`; spinner on `isPending`, not `isFetching`).
- **Four states, all reachable:**
  - *loading* — spinner (existing pattern).
  - *error* — message + retry.
  - *empty* — "You're all caught up ✓" (a new coach with nothing pending lands here — this is the common first-run state, so it must feel intentional, not broken).
  - *success* — the merged list; each row shows title/subtitle + a kind indicator, taps to `router.push(item.route)`.
- A small **"Manage"** footer preserves one-tap access to the org overview and team-admin (what the redirect did today) so no capability is lost — but the *landing* is the queue.
- Theme-aware (light/dark), no hardcoded dark text.

## 5. Testing

**Server (`__tests__/coach-action-queue.test.ts`):**
- A coach managing 2 teams with pending events + games + one org join request → queue returns all of them, correct `counts`, correct `total`, sorted oldest-first.
- Scope isolation — another coach's pending items do NOT appear.
- Self-action excluded — an item the caller submitted is not in their own queue.
- Empty coach → `{ total: 0, items: [] }`.
- Non-manager (fan) → `{ total: 0, items: [] }` (endpoint is not coach-gated; a manager-of-nothing just gets an empty queue) — no leak, no 403.
- Bounded — `take` cap respected.

**Client (`__tests__/team-hub.test.tsx` — extend existing):**
- Loading, error, empty, and success states each render.
- A success row's tap pushes the item's `route`.
- Non-coach still hits `CoachAccessRedirecting`.

## 6. Rollout

- Server change ships on merge (Railway). Client change is **not live until `eas update`**.
- No new native module, no migration, no schema change — OTA-safe.
- No new route file (team-hub already exists in the tab layout) — respects the no-new-screens rule.

## 7. Open questions / deferred

- **Tab badge** on the hub — deferred to a follow-up; `total` already supports it.
- **Refactoring the three existing approval screens** to consume the shared lib — deferred (YAGNI); v1 only adds the aggregation, it does not touch the existing screens.
- **Pagination** — v1 caps each source at `take`; if a coach routinely exceeds it, add cursoring later (log when truncated).
