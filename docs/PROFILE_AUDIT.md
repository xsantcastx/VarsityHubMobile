# Profile Audit — Athlete Profiles & Privacy Settings

**Date:** February 23, 2026  
**Scope:** Athlete profiles (jersey number, coach badge), profile privacy settings (server-side enforcement)

---

## 1. Athlete Profiles Audit

### Can Athletes Display Their Jersey Number on Their Profile?

| Context | Status | Details |
|---------|--------|---------|
| **Own profile** | ❌ No | `profile.tsx` computes `_jerseyNumber` and `_isAthlete` from preferences but **never renders** `JerseyBadge`. The component is imported only for the `Sport` type. |
| **Others' profile** | ❌ No | Same as above; additionally, `GET /users/:id` does not return `preferences`, so `jersey_number` would be unavailable. |

**Implementation:**
- `JerseyBadge` exists (`components/JerseyBadge.tsx`) and supports jersey numbers with color variants.
- Edit profile (`edit-profile.tsx`) allows setting `jersey_number` and saves to `preferences.jersey_number`.
- Profile display does not use `JerseyBadge`; `_isAthlete` and `_jerseyNumber` are computed but unused (underscore prefix suggests intentionally unused).

**Location:** `app/profile.tsx` lines 614–617, 753–761 (role badge only; no jersey).

---

### Does the Coach Badge Show on Coach Profiles?

| Context | Status | Details |
|---------|--------|---------|
| **Own profile** | ✅ Yes | `User.me()` returns full user including `preferences`. `roleRaw === 'coach'` shows "COACH" badge. |
| **Others' profile** | ❌ No | `GET /users/:id` returns `id`, `username`, `display_name`, `avatar_url`, `bio`, `created_at`, `posts_count`, `followers_count`, `following_count`, `is_following`, `is_parent`. It does **not** return `preferences` or `role`. So `preferences?.role` is undefined when viewing others, and the coach badge does not render. |

**Server:** `server/src/routes/users.ts` lines 533–579 — `preferences` is read for `is_parent` but not included in the response.

---

### Do These Display Correctly on Own vs. Others' Profile?

| Element | Own Profile | Others' Profile |
|---------|-------------|-----------------|
| Jersey number | ❌ Not displayed | ❌ Not displayed |
| Coach badge | ✅ Shown | ❌ Not shown (no role in API response) |
| Role (Fan/Coach) | ✅ Shown | ❌ Not shown |
| Follower/following counts | ✅ From `_count` | ⚠️ API returns `followers_count`/`following_count` but profile uses `me?._count?.followers` — may show 0 |

---

## 2. Profile Privacy Settings Audit

### Does a "Private Profile" Setting Exist?

- **Client:** `api/settings.ts` defines `PRIVATE_ACCOUNT: 'private_account'` as a local SecureStore key.
- **Server:** No `profile_private`, `private_account`, or equivalent field exists in the User model or preferences schema.
- **Conclusion:** Profile privacy is **not implemented**. The key exists only as a client-side placeholder; there is no server logic or database field for it.

---

### When Profile Is Private — Expected Behavior vs. Actual

| Question | Expected (if implemented) | Actual |
|----------|---------------------------|--------|
| Can non-followers see posts? | No | ✅ Yes — `GET /users/:id/posts` returns all posts with no follow check. |
| Can non-followers see follower count? | No | ✅ Yes — `GET /users/:id` returns `followers_count`, `following_count` with no privacy check. |
| Can they be found in search? | Debatable | ✅ Yes — `GET /search` returns all non-banned users; no privacy filter. |
| Is privacy enforced server-side? | Yes | ❌ No — no privacy logic exists on the server. |

---

### Server-Side Verification

| Endpoint | Privacy Check | Result |
|----------|---------------|--------|
| `GET /users/:id` | None | Returns full profile (bio, counts) to anyone. |
| `GET /users/:id/posts` | None | Returns all posts to anyone. |
| `GET /users/:id/followers` | `requireAuth` only | Returns followers to any authenticated user. |
| `GET /users/:id/interactions` | None | Returns likes/comments/saves to anyone. |
| `GET /search` | None | Returns users matching query; no privacy filter. |

**Conclusion:** Privacy is **not** enforced server-side. All profile and post data is exposed to unauthenticated and non-following users.

---

## 3. Recommendations

### Athlete Profiles

1. **Jersey badge:** Render `JerseyBadge` on the profile when `preferences?.jersey_number` or `preferences?.position` is set. Use the existing `_isAthlete` / `_jerseyNumber` logic.
2. **Public profile API:** Include `preferences` (or at least `role`, `jersey_number`, `position`) in `GET /users/:id` so coach badge and jersey display when viewing others. Consider a minimal subset (e.g. `role`, `jersey_number`, `position`, `primary_sport`) to avoid exposing sensitive preferences.
3. **Count normalization:** Ensure profile uses `me?.followers_count ?? me?._count?.followers ?? 0` (and similarly for `posts_count`, `following_count`) so counts display correctly when viewing others.

### Profile Privacy

1. **Schema:** Add `profile_private: boolean` to user preferences (or a dedicated column).
2. **Server enforcement:** For users with `profile_private === true`:
   - `GET /users/:id`: If viewer is not the user and not a follower, return limited data (e.g. username, avatar; hide bio, counts).
   - `GET /users/:id/posts`: If not self and not follower, return 403 or empty list.
   - `GET /users/:id/followers`: If not self and not follower, hide or restrict.
   - `GET /search`: Optionally exclude private users, or return minimal info (username, avatar) until follow is established.
3. **UI:** Add a "Private account" toggle in settings that persists to `preferences.profile_private` via `PATCH /me/preferences`.
