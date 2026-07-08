# Opponent-Approval Workflow — Design

**Status:** Implemented. **Date:** 2026-07-06

## Problem

A coach can currently create a game against any real VarsityHub team and it is
auto-approved immediately, with zero input from the opponent's side. The
opponent team never knows a game was scheduled against them until it's
already live.

## Model

When a game links a VarsityHub team the creator does **not** manage, the game
only becomes **publicly visible** once that opponent team's staff confirms
it. This is independent of `approval_status`, which remains the platform
**moderation** gate (fan-pitched games await review; coach-created games
auto-approve). A game can be moderation-approved and opponent-pending at the
same time — public visibility requires **both** gates to clear.

## Data model

`Game` gains:

- `opponent_approval_status` (`not_required` | `pending` | `approved` |
  `declined`), default `not_required` — additive, so every existing row is
  grandfathered as `not_required` with zero migration risk.
- `opponent_approval_team_id` — the opposing team whose staff must decide.
- `opponent_approved_by_id`, `opponent_approved_at`, `opponent_declined_reason`.

Three new `NotificationType` values: `GAME_OPPONENT_APPROVAL_REQUESTED`,
`GAME_OPPONENT_APPROVED`, `GAME_OPPONENT_DECLINED`.

## Who decides

The opponent-approval boundary is `canManageTeam()` — the same "authorized
user" tier (team owner/manager/coach/assistant_coach, or org owner/manager)
that already handles roster and event approve/deny. This is deliberately the
**same** boundary as the [role-barrier model](../../../CLAUDE.md) grants
authorized users for events — deciding an incoming game request is a form of
event approve/deny, not a full-administration action.

## Creation logic

`POST /games` and `POST /games/bulk`: if the payload links a real team the
creator cannot manage (and the creator isn't a platform admin, and the
creator doesn't ALSO manage that other team — e.g. intra-org scheduling),
`opponent_approval_status` is set to `pending` and the opponent team's staff
is notified (in-app `Notification` row + push). Free-text opponents
(`away_team_name` only) never trigger this.

## Decision endpoint

`POST /games/:id/opponent-approval` `{ decision: 'approve'|'decline', reason?
}`. Guards, mirroring the existing game-approval race pattern:

- `requireAuth` + `requireVerified` + `requireOnboarded`
- IDOR: the proposing coach can never decide their own request (also
  excluded by construction — `canManageTeam` is checked against the opponent
  team, not the creator's team)
- `canManageTeam(actingUserId, opponent_approval_team_id)` required
- Atomic `updateMany({ where: { id, opponent_approval_status: 'pending' } })`
  — a second decision on an already-decided game is a 409, not a silent
  overwrite
- Notifies the creator either way (approved → "game is live"; declined →
  reason surfaced)

`GET /games/opponent-pending` lists games awaiting a decision from a team the
caller manages (registered before the bare `/:id` route so it isn't
shadowed).

## Visibility

Public visibility = `approval_status: 'approved'` **AND**
`opponent_approval_status IN ('not_required', 'approved')`. Applied
everywhere a game list is served to the general public: `GET /games`
(default/public path only — the `show_pending` "my full schedule" path stays
unfiltered since it's already scoped to the viewer's own managed teams),
`GET /search`, and the team screen-summary/admin-summary upcoming-games
lists. Privileged views (org admin-summary, the opponent-pending list, the
single-game detail endpoints via `canViewGameRecord`) intentionally still
show pending/declined-consent games to the creator, both teams' staff, and
org admins — same precedent as moderation-pending games today.

## Client

- `Game.opponentPending()` / `Game.decideOpponentApproval()` in `api/entities.ts`
- New "Game Requests" section on `app/(tabs)/event-approvals.tsx`, above
  Pitched Events — same Accept/Decline card pattern as the other sections,
  with a decline-reason modal mirroring the existing reject-event modal
- `manage-season.tsx` maps `opponent_approval_status` onto the existing
  `pending`/`cancelled` statuses rather than introducing a new status value
  (avoids a broader sweep of every place that switches on `GameStatus`)
- `utils/notificationPresentation.ts` + `components/NotificationTapHandler.tsx`
  handle the three new notification types

## Deliberately out of scope

- No new `GameStatus` value on the client — reused `pending`/`cancelled`.
- The client-facing `canManageTeam` boolean on team detail responses is
  untouched here (tracked separately as part of the role-barrier client
  re-layer) — irrelevant to this feature since the decision endpoint itself
  is server-enforced regardless of what the UI shows.
