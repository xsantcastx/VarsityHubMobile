# Coach Settings & Roster Management Audit

**Date:** February 22, 2025

---

## 1. Re-Authentication Audit — Coach Settings

Every action that changes account data (email, password, team info, billing) **should** require re-authentication (password confirmation) before saving.

### Summary Table

| Action | Location | Changes Account Data | Re-Auth Required? | Status |
|--------|----------|----------------------|-------------------|--------|
| **Edit Username** | `settings/edit-username.tsx` | username (identity) | ❌ No | **GAP** — Saves via `User.updateMe({ username })` without password prompt |
| **Reset Password** | `settings/reset-password.tsx` | password | ✅ Yes | **OK** — Requires "Current Password" before `auth.changePassword()` |
| **Manage Subscription** | `settings/manage-subscription.tsx` | plan, billing | ⚠️ N/A | **OK** — Stripe Checkout handles payment auth; no additional re-auth needed |
| **Notifications toggles** | `settings/index.tsx` | preferences | ❌ No | **Low risk** — Notification prefs; typically acceptable without re-auth |
| **Privacy: is_parent** | `settings/index.tsx` | preferences | ❌ No | **Low risk** |
| **ZIP Code** | `settings/zip-code.tsx` | zip_code (preferences) | ❌ No | **Low risk** — Preference only |
| **Delete Account** | `settings/index.tsx` | permanent account deletion | ⚠️ Weak | **GAP** — Asks "Type DELETE" but no password; vulnerable if device is unlocked |
| **Restart Onboarding** | `settings/index.tsx` | onboarding_completed | ❌ No | **Low risk** — Reset flow, not sensitive account data |
| **Edit Team** | `(tabs)/edit-team.tsx` | team name, logo, org | ❌ No | **GAP** — Changes team data; no re-auth before `Team.update()` |
| **Log Out** | `settings/index.tsx` | session | N/A | — |

### Detailed Findings

#### ✅ Reset Password — CORRECT
- **File:** `app/settings/reset-password.tsx`
- **Flow:** User enters "Current Password", "New Password", "Confirm Password"
- **API:** `auth.changePassword(currentPassword, newPassword)` → `POST /auth/password/change` with `current_password`
- **Status:** Re-authentication is implemented via current password

#### ❌ Edit Username — NO RE-AUTH
- **File:** `app/settings/edit-username.tsx`
- **Flow:** User edits username, taps Save → `User.updateMe({ username })` immediately
- **Risk:** Anyone with device access could change the @ handle without proving identity

#### ❌ Delete Account — WEAK RE-AUTH
- **File:** `app/settings/index.tsx` (lines 364–407)
- **Flow:** `Alert.prompt('Type DELETE to confirm')` — no password
- **Risk:** Typing "DELETE" is trivial; stolen/unlocked device could trigger deletion

#### ❌ Edit Team — NO RE-AUTH
- **File:** `app/(tabs)/edit-team.tsx`
- **Flow:** User edits name, description, sport, logo, organization → `Team.update(id, data)` directly
- **Risk:** Team info changes (name, org linkage) without re-auth

---

## 2. Coach Team Roster Management

### Current State

**Roster management in the mobile app is read-only and minimal.**

| Capability | Implemented? | Location |
|------------|--------------|----------|
| **View roster / members** | ✅ Yes (read-only) | `team-page.tsx` — shows `members.length` and loads `Team.members(teamId)` |
| **Add players** | ❌ No | Directed to web dashboard |
| **Remove players** | ❌ No | Not available in mobile |
| **Assign roles** | ❌ No | Not available in mobile |
| **Invite users** | ✅ During onboarding only | `step-6-authorized-users.tsx` — adds authorized users |
| **Manage Users list** | ✅ Read-only | `manage-users.tsx` — shows `TeamApi.allMembers()`, no edit actions |

### Where Roster Management Lives

1. **My Team** (`app/(tabs)/my-team.tsx`)
   - Static screen: *"Manage your team roster and staff from the VarsityHub web dashboard."*
   - No roster UI — directs coaches to web

2. **Team Page** (`app/team-page.tsx`)
   - Displays member count in stats
   - Loads `Team.members(teamId)` for display
   - No add/remove/assign controls

3. **Manage Users** (`app/manage-users.tsx`)
   - Lists users across teams via `TeamApi.allMembers()`
   - Read-only: name, email, role, team, status
   - No add, remove, or role-edit actions

4. **Manage Season** (`app/manage-season.tsx`)
   - Focus: schedule, standings, games
   - Team selector says "Choose which roster you would like to manage" but roster = team selection, not member management

5. **Onboarding Step 6** (`step-6-authorized-users.tsx`)
   - Only place where invites are sent: `POST /teams/:id/invite` or `POST /organizations/:id/invite`
   - Used during onboarding, not for ongoing roster management

6. **Team Invites** (`app/team-invites.tsx`)
   - Accept/decline invites — no add/remove/role

### Real-Time Updates

- `team-page.tsx`: Members loaded in `loadTeam()`, no live updates
- `manage-users.tsx`: Loaded in `useEffect` once, no refresh or live sync
- No WebSocket, polling, or event-based roster updates in the app

### Backend Support

Backend supports full roster management:

- `POST /teams/:id/invite` — invite by email and role
- `PATCH /teams/:id/members/:membershipId` — update role, position
- `DELETE /teams/:id/members/:membershipId` — remove member
- `POST /team-memberships` — add member (with coach permission checks)

**Mobile app does not expose these endpoints for roster management.**

---

## Recommendations

### Re-Authentication
1. **Edit Username** — Add password confirmation modal before save
2. **Delete Account** — Require current password in addition to "Type DELETE"
3. **Edit Team** — Add password confirmation for team name/org changes (or accept lower risk for team metadata)

### Roster Management
1. Implement roster UI in mobile (add, remove, assign roles) using existing backend endpoints
2. Add pull-to-refresh on team-page and manage-users for roster updates
3. Consider WebSocket or polling for live roster updates when multiple coaches manage the same team
