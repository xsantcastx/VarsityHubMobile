# Safety Audit — Blocking, Reporting, and Under-18 Protections

**Date:** February 23, 2026  
**Scope:** Blocking system, content reporting (fan perspective), under-18 user protections

---

## 1. Blocking System Audit

### When User A Blocks User B — What Can B Still Do?

| Action                       | Can B Do It? | Server-Side Enforced? | Location                                                               |
| ---------------------------- | ------------ | --------------------- | ---------------------------------------------------------------------- |
| **See A's posts in feed**    | ✅ Yes       | ❌ No                 | `posts.ts` GET `/` — no block filter                                   |
| **Send A messages**          | ❌ No        | ✅ Yes                | `messages.ts` POST `/` — returns 403 MESSAGE_BLOCKED                   |
| **Comment on A's posts**     | ✅ Yes       | ❌ No                 | `posts.ts` POST `/:id/comments` — no block check                       |
| **View A's profile**         | ✅ Yes       | ❌ No                 | No block filter on user/profile endpoints                              |
| **Follow A**                 | ✅ Yes       | ❌ No                 | No block check on follows                                              |
| **See messages list with A** | ✅ Yes       | ❌ No                 | GET `/messages` returns all conversations; no filter for blocked users |

### Blocking Implementation

- **Model:** `BlockedUser` (blocker_id, blocked_id) — bidirectional semantics: if A blocks B, both directions are checked in messaging
- **Endpoints:** `POST /users/:id/block`, `DELETE /users/:id/block`, `GET /users/blocked`
- **Messaging:** Block is enforced on `POST /messages` — if either user has blocked the other, returns `403 MESSAGE_BLOCKED`

### Gaps (Blocking Not Enforced)

1. **Posts feed** — B can still see A's posts. No `where` clause excludes posts from users who have blocked the viewer.
2. **Comments** — B can comment on A's posts. No check that post author has blocked the commenter.
3. **Messages list** — B can still see the conversation thread with A (and old messages). Only sending is blocked.
4. **User profile / follows** — No block filter on profile views or follow actions.

---

## 2. Content Reporting Audit (Fan Perspective)

### How Many Taps to Report a Post?

| Flow                    | Taps | Notes                                                                         |
| ----------------------- | ---- | ----------------------------------------------------------------------------- |
| **From post in feed**   | N/A  | No "Report" option on PostCard. Only author sees ellipsis menu (Edit/Delete). |
| **From post detail**    | N/A  | No Report option on post-detail screen.                                       |
| **From Settings**       | 4+   | Settings → Report Abuse → fill form (subject, details, email) → Submit        |
| **From message thread** | 3+   | Message thread → Safety menu → Report user → Report Abuse form                |

### In-Post Report

- **Does not exist.** There is no "Report this post" from the feed or post detail.
- PostCard shows an actions menu (ellipsis) only to the **author** — Edit and Delete. Non-authors have no menu.
- The structured `POST /reports` API exists (`server/src/routes/reports.ts`) and supports `target_type: 'post'`, but:
  - **The reports router is NOT mounted in `app.ts`** — the endpoint is not exposed.
  - The frontend has no `Report` entity or UI calling it.

### After Reporting — Feedback

- **Report Abuse form** (Support.contact): Shows `Alert.alert('Report sent', 'Thank you for letting us know...')` — ✅ User gets feedback.
- **Structured reports** (if mounted): Would need to verify response and frontend handling.

### Does Reported Content Get Hidden from Reporter?

- **No.** The Report Abuse flow sends a support email; it does not hide any content.
- The structured reports API does not implement "hide from reporter" — it only creates an AbuseReport record.
- No client-side hiding of reported posts.

### Summary (Reporting)

| Question                         | Answer                                         |
| -------------------------------- | ---------------------------------------------- |
| Taps to report a post from feed? | Not possible — no in-post report option        |
| Feedback after report?           | ✅ Yes (Report Abuse form shows success alert) |
| Content hidden from reporter?    | ❌ No                                          |

---

## 3. Under-18 User Protections Audit

### Messaging Age Policy (Current)

- **Location:** `server/src/routes/messages.ts` (lines 143–167)
- **Rule:** Users under 18 (from `preferences.dob`) may only message accounts they **follow**.
- **Enforcement:** When **sender** is under 18, check if sender follows recipient. If not → `403 AGE_POLICY_BLOCKED`.
- **Gap:** The check runs only when the **sender** is under 18. When an **adult** sends to a **minor**, there is no check. **Adults can message minors freely.**

### Other Age Restrictions

| Area                                 | Protection? | Notes                                        |
| ------------------------------------ | ----------- | -------------------------------------------- |
| **Messaging (minor → non-followed)** | ✅ Yes      | Minor cannot message users they don't follow |
| **Messaging (adult → minor)**        | ❌ No       | No restriction; adults can DM minors         |
| **Posts / feed**                     | ❌ No       | No age-based content filtering               |
| **Comments**                         | ❌ No       | No age restriction on who can comment        |
| **Events / RSVP**                    | ❌ No       | No age checks                                |
| **Group chats**                      | ❌ No       | No age checks (not audited in depth)         |
| **Follows**                          | ❌ No       | No age restriction on who can follow whom    |

### Data Model

- **DOB:** Stored in `User.preferences.dob` (optional string). Used only in messaging.
- **Policy text:** `app/settings/privacy-policy.tsx` states "Users between 13 and 17 must have parental or guardian consent to use the Service" — policy only, not enforced in code.

### Summary (Under-18)

| Question                          | Answer                                       |
| --------------------------------- | -------------------------------------------- |
| Can minors see all content?       | ✅ Yes — no content filtering by age         |
| Can adults message minors freely? | ✅ Yes — no adult→minor restriction          |
| Is age policy enforced?           | Partial — only minor→non-followed is blocked |

---

## 4. Recommendations

### Blocking

1. **Posts feed:** Exclude posts from users who have blocked the viewer. Add a subquery or join to filter `author_id` not in (users who blocked currentUserId).
2. **Comments:** Before creating a comment, check if the post author has blocked the commenter. Return 403 if blocked.
3. **Messages list:** Optionally filter out or collapse conversations with blocked users.
4. **Profile/follows:** Consider hiding or restricting profile views and follow actions when a block exists.

### Reporting

1. **Mount reports router:** Add `app.use('/reports', reportsRouter)` in `app.ts` so `POST /reports` is available.
2. **In-post report:** Add a "Report" option to PostCard (for non-authors) and post-detail, calling `POST /reports` with `target_type: 'post'`, `target_id`, `reason`.
3. **Reduce taps:** Aim for 2–3 taps: tap post menu → Report → (optional) reason → Submit.
4. **Feedback:** Ensure success message after report (already present in Report Abuse).
5. **Hide from reporter:** Consider filtering reported posts from the reporter's feed (client + server) after report submission.

### Under-18

1. **Adult → minor messaging:** Add a check when the **recipient** is under 18: only allow if the recipient follows the sender, or implement a stricter rule (e.g., no DMs from non-followed adults to minors).
2. **Content visibility:** Evaluate whether any content (e.g., certain post types, DMs from strangers) should be restricted for minors.
3. **Enforce parental consent:** If required by policy, add a `parental_consent_at` or similar field and gate features until verified.

---

## 5. Endpoint Summary

| Endpoint                   | Block Check | Age Check                  |
| -------------------------- | ----------- | -------------------------- |
| `GET /posts`               | ❌          | ❌                         |
| `POST /posts/:id/comments` | ❌          | ❌                         |
| `GET /messages`            | ❌          | N/A                        |
| `POST /messages`           | ✅          | Partial (minor→adult only) |
| `GET /users/:id`           | ❌          | N/A                        |
| `POST /users/:id/follow`   | ❌          | N/A                        |
