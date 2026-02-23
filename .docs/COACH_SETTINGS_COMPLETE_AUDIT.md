# Coach Settings Complete Audit

**Date:** February 22, 2025

## Scope

Every setting a coach (or any user) can change from the app, where it saves, and whether sensitive changes require re-authentication.

---

## 1. Settings Matrix

| Setting | Location | API / Save Path | DB Field | Re-Auth? | Status |
|---------|----------|-----------------|----------|----------|--------|
| **Edit Username** | `settings/edit-username.tsx` | `User.updateMe({ username })` → `PUT /auth/me` | `users.username` | ❌ No | **GAP** |
| **Reset Password** | `settings/reset-password.tsx` | `auth.changePassword(current, new)` → `POST /auth/password/change` | `users.password_hash` | ✅ Yes (current password) | **OK** |
| **Change Email** | — | — | — | N/A | **Not implemented** – no UI to change email |
| **Notifications** | `settings/index.tsx` | `User.updatePreferences({ notifications })` → `PATCH /me/preferences` | `users.preferences` (JSON) | ❌ No | Low risk |
| **Privacy: is_parent** | `settings/index.tsx` | `User.updatePreferences({ is_parent })` → `PATCH /me/preferences` | `users.preferences` (JSON) | ❌ No | Low risk |
| **ZIP Code** | `settings/zip-code.tsx` | `User.updatePreferences({ zip_code })` → `PATCH /me/preferences` | `users.preferences.zip_code` | ❌ No | Low risk |
| **Delete Account** | `settings/index.tsx` | `httpDelete('/users/me')` | Cascade delete | ⚠️ Type "DELETE" only | **GAP** |
| **Restart Onboarding** | `settings/index.tsx` | `User.updatePreferences({ onboarding_completed: false })` | `users.preferences` | ❌ No | Low risk |
| **Manage Subscription** | `settings/manage-subscription.tsx` | Stripe Checkout (external) + `Subscriptions.finalizeSession` | `users.subscription_*` | ✅ Stripe auth | **OK** |
| **Edit Profile** | `(tabs)/edit-profile.tsx` | `User.updateMe()` + `User.updatePreferences()` | `users.display_name`, `users.bio`, `users.avatar_url`, `users.preferences.*` | ❌ No | Low risk |
| **Edit Team** | `(tabs)/edit-team.tsx` | `Team.update(id, data)` → `PATCH /teams/:id` | `teams.name`, `description`, `sport`, `season`, `logo_url`, `organization_id` | ❌ No | **GAP** (team metadata) |
| **Manage Blocked Users** | `settings/blocked-users.tsx` | Block/unblock APIs | `blocked_users` | ❌ No | Low risk |
| **Billing (coaches)** | Settings → Manage Subscription | Same as Manage Subscription | — | — | **OK** |

---

## 2. Sensitive Actions Requiring Re-Auth

| Action | Current behavior | Recommendation |
|--------|------------------|----------------|
| **Username** | Save immediately, no password | Add password confirmation modal before save |
| **Password** | Requires current password | ✅ Already correct |
| **Delete account** | Type "DELETE" only | Require current password in addition |
| **Edit team (name, org)** | Save immediately | Consider password for org linkage; team metadata lower risk |

---

## 3. Save Paths Verified

### PUT /auth/me

- Used by: Edit Username, Edit Profile
- Server: `server/src/routes/auth.ts`
- Writes: `display_name`, `username`, `bio`, `avatar_url`, `header_image_url`, plus preferences merge

### PATCH /me/preferences

- Used by: Notifications, is_parent, ZIP, Restart Onboarding, Edit Profile (prefs)
- Server: Handled via auth router / users routes
- Writes: `users.preferences` (JSON column, merged patch)

### POST /auth/password/change

- Requires `current_password`, `new_password`
- Updates `users.password_hash`, sends confirmation email

### DELETE /users/me

- Deletes user and cascades
- No password check; only "Type DELETE" confirmation

### PATCH /teams/:id

- Used by Edit Team
- Requires team membership (owner/manager/coach)
- Writes: team name, description, sport, season, logo_url, organization_id

---

## 4. Coach-Specific Sections

- **Billing** (`role === 'coach'`): Manage Subscription only
- **Pending Host Requests** (coaches): Fetched via `Event.filter({ event_type: 'host_request', approval_status: 'pending' })`
- All other settings apply to both coaches and fans.

---

## 5. Recommendations

1. **Edit Username** – Add password confirmation before `User.updateMe({ username })`
2. **Delete Account** – Require current password in addition to typing "DELETE"
3. **Edit Team** – Accept as-is for metadata, or add password for org linkage changes
