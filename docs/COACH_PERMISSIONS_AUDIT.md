# Coach Permissions & Plan Limits Audit

**Date:** February 23, 2026  
**Scope:** Rookie/Veteran/Legend plans, coach-only actions, authorized users, coach-to-athlete permissions

---

## 1. Permission Matrix by Plan

| Action | Rookie | Veteran | Legend | Backend Enforced | Frontend Upgrade Prompt |
|--------|--------|---------|--------|------------------|-------------------------|
| **Create teams** | 2 max | Unlimited | Unlimited | ✅ `teams.ts` | ✅ Alert + "View Plans" / "Upgrade & Continue" |
| **Create 3rd team** | ❌ Blocked | ✅ (billed) | ✅ | ✅ 403 TEAM_LIMIT_EXCEEDED | ✅ Upgrade modal before submit |
| **Extracurricular clubs** | ❌ | ❌ | ✅ | ✅ 403 LEGEND_TIER_REQUIRED | ✅ Disabled + upgrade note |
| **Authorized users per team** | 1 | 5 | Unlimited | ✅ `getAuthorizedUsersPerTeam()` | ⚠️ See Section 4 |
| **Org-level authorized users** | 1 fixed | 5×team_count | Unlimited | ✅ `organizations.ts` | ⚠️ |
| **Pending events (fans only)** | 3 max | Unlimited | Unlimited | ✅ `events.ts` | ⚠️ 403 with message |
| **Approve/reject events** | ✅ (coach) | ✅ | ✅ | ✅ role check | N/A |
| **Create games** | ✅ | ✅ | ✅ | ✅ | N/A |
| **Invite team members** | ✅ | ✅ | ✅ | ✅ owner/manager/coach/assistant_coach | N/A |

**Plan definitions source:** `shared/plan-definitions.json` (consumed by `server/src/lib/planLimits.ts`)

| Plan | max_teams | max_authorized_users_per_team | supports_extracurricular |
|------|-----------|------------------------------|---------------------------|
| Rookie | 2 | 1 | false |
| Veteran | null (unlimited) | 5 | false |
| Legend | null | null (unlimited) | true |

---

## 2. Rookie Plan: Third Team Creation

### What happens when a Rookie coach tries to create a third team?

**Frontend (`app/(tabs)/create-team.tsx`):**
1. Fetches `Team.limits()` → `can_create_more: false`, `upgrade_required: true`
2. **Before submit:** If `!canCreateMore`, shows Alert: "Your Rookie plan has reached its team limit. Upgrade to add more teams." with "View Plans" button
3. **Alternative flow:** If `userPlan === 'rookie' && teamCount >= 2`, shows "Upgrade Required" alert with Veteran pricing and "Upgrade & Continue" → opens Stripe checkout
4. Create button is **not disabled** by default; limits are checked on submit
5. When limit reached, "View plans" link is shown above the form (`limitReached` → upgrade CTA)

**Backend (`server/src/routes/teams.ts`):**
- POST `/teams` and POST `/teams/create` both enforce limits
- Rookie: `ownedTeamsCount >= 2` → throws `TEAM_LIMIT_EXCEEDED`
- Returns 403 with `code: 'TEAM_LIMIT_EXCEEDED'`, `message: "You've reached your free limit (2 teams). Upgrade to add more."`

**Verdict:** ✅ Clear upgrade prompts. Frontend checks limits before submit and shows upgrade modal. Backend enforces. **Not silent failure.**

---

## 3. Coach-to-Athlete Permissions

| Permission | Exists? | Server-Side Enforced? | Notes |
|------------|---------|----------------------|-------|
| **Post on behalf of team** | ❌ No | N/A | Posts have `author_id` (user only). No `team_id` or "post as team" on Post model. |
| **Pin announcements to team page** | ❌ No | N/A | No `pinned` or `is_pinned` on Post. No pinning feature. |
| **Remove fan posts from team page** | ⚠️ Partial | ✅ | **Delete post:** Author only (`post.author_id === userId`). Coach cannot delete fan posts. **Delete comment:** Author OR post owner can delete. So coach can delete comments only on posts they authored. Fan posts on team feed: coach is NOT post owner → cannot delete. |

**Conclusion:** Coach cannot post on behalf of team, cannot pin announcements, and cannot remove fan posts from the team page. Only the post author can delete posts. Comment deletion allows post owner—so coaches can delete comments only on their own posts.

---

## 4. Authorized Users System

### What are "authorized users"?

- **TeamInvite** with roles: `owner`, `manager`, `coach`, `assistant_coach`, `equipment`, `health_wellness`, `player`, `parent`, `member`
- Plan limits apply to **staff** roles: `manager`, `coach`, `assistant_coach`, `equipment`, `health_wellness` (counted in `teams.ts` line 956)
- Invite flow: Coach invites by email → user accepts → becomes TeamMembership with assigned role

### What can authorized users do vs. head coach (owner)?

| Action | Owner | Manager | Coach | Assistant Coach | Enforced On |
|--------|-------|---------|-------|-----------------|-------------|
| Update team info | ✅ | ❌ | ❌ | ❌ | `teams.ts` PATCH `/:id` |
| Delete team | ✅ | ❌ | ❌ | ❌ | `teams.ts` DELETE `/:id` |
| Invite members | ✅ | ✅ | ✅ | ✅ | `teams.ts` POST `/:id/invite` |
| Add/update/remove memberships | ✅ | ✅ | ✅ | ✅ | `team-memberships.ts` |
| Create/approve games | ✅ | ✅ | ✅ | ✅ | `games.ts` |
| Create events | ✅ | ✅ | ✅ | ✅ | `events.ts` |
| View pending events | ✅ | ✅ | ✅ | ✅ | `events.ts` GET `/pending` |
| Approve/reject events | ✅ | ✅ | ✅ | ✅ | `events.ts` |
| Create group chat (team) | ✅ | ✅ | ✅ | ❌ | `group-chats.ts` (coach, manager, admin, owner only—assistant_coach excluded) |

**Note:** `games.ts` has inconsistent role checks: update game allows owner/manager/coach only (assistant_coach excluded); approve/delete games include assistant_coach.

### Plan limits on authorized users

- **Rookie:** 1 staff per team (owner + 0 additional, or 1 invite)
- **Veteran:** 5 staff per team
- **Legend:** Unlimited

**Enforcement:** `server/src/routes/teams.ts` POST `/:id/invite` — counts `inviteCount + memberCount` (roles in manager/coach/assistant_coach/equipment/health_wellness), throws `USER_LIMIT_REACHED` if over limit.

### Gaps

1. ~~**Frontend upgrade prompt for USER_LIMIT_REACHED**~~ **FIXED:** Step 6 now detects `USER_LIMIT_REACHED` and shows upgrade prompt with next plan name, its limit, and "View Plans" button (matches TEAM_LIMIT_EXCEEDED pattern).
2. ~~**step-6 Veteran plan mismatch**~~ **FIXED:** Step 6 now reads limits from `constants/plans.ts` (plan-definitions.json), showing 5 per team for Veteran.
3. **Organization-level authorized users:** `organizations.ts` enforces `getAuthorizedUsersOrgLimit(plan, teamCount)` — Rookie: 1, Veteran: 5×teams, Legend: unlimited.
4. ~~**CRITICAL: POST /team-invites has no permission check**~~ **FIXED:** `server/src/routes/team-invites.ts` now enforces membership check (owner/manager/coach/assistant_coach) and plan limit (`getAuthorizedUsersPerTeam`), matching `POST /teams/:id/invite`.

### Endpoint-by-endpoint verification (authorized users)

| Endpoint | Roles allowed | Enforced? |
|---------|---------------|-----------|
| PATCH `/teams/:id` | owner only | ✅ |
| DELETE `/teams/:id` | owner only | ✅ |
| POST `/teams/:id/invite` | owner, manager, coach, assistant_coach | ✅ + plan limit |
| POST `/team-invites` | owner, manager, coach, assistant_coach | ✅ + plan limit (fixed) |
| POST `/team-memberships` | owner, manager, coach, assistant_coach | ✅ |
| PATCH `/team-memberships/:id` | owner, manager, coach, assistant_coach | ✅ |
| DELETE `/team-memberships/:id` | owner, manager, coach, assistant_coach | ✅ |
| Games: create/approve | owner, manager, coach, assistant_coach | ✅ |
| Games: update | owner, manager, coach only | ⚠️ assistant_coach excluded |
| Games: delete | owner, manager, coach, assistant_coach | ✅ |
| POST `/group-chats` (team) | owner, manager, coach, admin | ⚠️ assistant_coach excluded |
| Events: create/approve/reject | coach/organizer (user prefs) | ✅ (not team-role based) |

---

## 5. Backend Enforcement Summary

| Endpoint | Limit Check | Error Code |
|----------|-------------|------------|
| POST `/teams` | Rookie 2 teams, Legend for extracurricular | TEAM_LIMIT_EXCEEDED, LEGEND_TIER_REQUIRED |
| POST `/teams/create` | Same | Same |
| POST `/teams/:id/invite` | `getAuthorizedUsersPerTeam(plan)` | USER_LIMIT_REACHED |
| POST `/organizations/:id/invite` | `getAuthorizedUsersOrgLimit(plan, teamCount)` | USER_LIMIT_REACHED |
| POST `/events` | Fans: 3 pending events (Rookie) | EVENT_LIMIT_EXCEEDED |
| PATCH `/teams/:id` | owner only | 403 |
| DELETE `/teams/:id` | owner only | 403 |
| DELETE `/posts/:id` | author only | 403 |
| DELETE `/posts/:postId/comments/:commentId` | author or post owner | 403 |

---

## 6. Recommendations

1. **Rookie 3rd team:** ✅ Working. Clear upgrade flow.
2. ~~**USER_LIMIT_REACHED frontend**~~ **DONE:** Upgrade prompt with "View Plans" added.
3. **Coach-to-athlete:** Consider adding:
   - Post on behalf of team (e.g. `team_id` + `author_id` with coach as author)
   - Pin announcements (e.g. `pinned_at` on Post)
   - Coach can remove fan posts from team feed (e.g. allow delete if user is coach of team associated with post's game)
4. **Authorized user permission docs:** Document which roles can do what in a single reference for future development.
5. ~~**CRITICAL: Fix POST /team-invites**~~ **DONE:** Membership check and plan limit added.
6. ~~**step-6 Veteran plan**~~ **DONE:** UI reads from plan-definitions via constants/plans.ts.
