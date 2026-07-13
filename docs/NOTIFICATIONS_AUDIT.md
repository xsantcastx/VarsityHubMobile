# Social — Notifications Audit

**Date:** February 23, 2026  
**Scope:** Notification triggers, push vs in-app, notification preferences, backend respect

---

## 1. Notification Triggers Audit

### Triggers That Exist (Implemented)

| Trigger                                  | In-App Notification                       | Push Notification                     | Location                                          |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| **User A follows User B**                | ✅ `notification.create` type FOLLOW      | ✅ `notifyNewFollower`                | `users.ts` POST /:id/follow                       |
| **User A comments on User B's post**     | ✅ `notification.create` type COMMENT     | ✅ `notifyPostInteraction('comment')` | `posts.ts` POST /:id/comments                     |
| **User A upvotes User B's post**         | ✅ `notification.create` type UPVOTE      | ✅ `notifyPostInteraction('like')`    | `posts.ts` POST /:id/upvote                       |
| **User A sends DM to User B**            | ✅ `notification.create` type MESSAGE     | ✅ `notifyNewMessage`                 | `messages.ts` POST /                              |
| **User A invites User B to team**        | ✅ `notification.create` type TEAM_INVITE | ❌ **No push**                        | `teams.ts` POST /:id/invite                       |
| **Game/event reminder (12h, 1h before)** | ❌ **No in-app**                          | ✅ `notifyUpcomingGames` (cron)       | `lib/notifications.ts` + `cron/game-reminders.ts` |

### Triggers That Are Missing

| Trigger                                 | Status                   | Notes                                                                                                                                              |
| --------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User A mentions User B in a post**    | ❌ **Not implemented**   | No mention parsing on post create; no notification to mentioned users                                                                              |
| **User A mentions User B in a comment** | ❌ **Not implemented**   | No mention parsing on comment create                                                                                                               |
| **User A shares User B's post**         | ❌ **Not implemented**   | `notifyPostInteraction` supports `'share'` type but it is **never called**. Share action opens native share sheet only; no server-side share event |
| **User A replies to User B's comment**  | ❌ **Not implemented**   | Comments only notify post author, not the comment author being replied to                                                                          |
| **Organization invite**                 | ❌ **No in-app or push** | Org invites send email only; no `notification.create` or push                                                                                      |
| **Poll vote on user's post**            | ❌ **Not implemented**   | No notification when someone votes on your poll                                                                                                    |

---

## 2. Push vs In-App Summary

| Trigger          | In-App | Push |
| ---------------- | ------ | ---- |
| Follow           | ✅     | ✅   |
| Comment          | ✅     | ✅   |
| Upvote           | ✅     | ✅   |
| DM               | ✅     | ✅   |
| Team invite      | ✅     | ❌   |
| Game reminder    | ❌     | ✅   |
| Mention          | ❌     | ❌   |
| Share            | ❌     | ❌   |
| Reply to comment | ❌     | ❌   |

---

## 3. Notification Preferences Audit

### Preferences Schema (Backend)

From `auth.ts` PATCH /me/preferences and GET /me:

```typescript
notifications: {
  game_event_reminders: boolean; // Game/event reminders (12h, 1h before)
  team_updates: boolean; // Team-related updates
  comments_upvotes: boolean; // Comments and upvotes on posts
}
notifications_enabled: boolean; // Global kill switch
```

### Settings UI (app/settings/index.tsx)

Users can toggle:

- **Game event reminders** → `notifications.game_event_reminders`
- **Team updates** → `notifications.team_updates`
- **Comments & upvotes** → `notifications.comments_upvotes`

**Missing toggles:**

- Follow notifications (new followers)
- Message notifications (DMs)
- Team invite notifications
- Mention notifications (when implemented)

### Does the Backend Respect Preferences?

| Preference                           | Respected?           | Where                                                                  |
| ------------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| `notifications_enabled`              | ✅                   | `sendPushNotification` — skips if `false`                              |
| `notifications.comments_upvotes`     | ✅                   | `notifyPostInteraction` — skips like/comment push if `false`           |
| `notifications.game_event_reminders` | ✅                   | `notifyUpcomingGames` — skips if `false`                               |
| `notifications.team_updates`         | ⚠️ **Not used**      | No push for team invites; if added, should check this                  |
| Follow notifications                 | ❌ **No preference** | No `notifications.new_followers` — always sent                         |
| Message notifications                | ❌ **No preference** | No `notifications.messages` — always sent (if `notifications_enabled`) |
| Team invite                          | ❌ **No push**       | In-app only; no preference check needed for push                       |

---

## 4. Detailed Findings

### 4.1 Follow

- **In-app:** ✅ Created in `users.ts` (type FOLLOW)
- **Push:** ✅ `notifyNewFollower` called
- **Preference:** ❌ No per-type toggle. Only `notifications_enabled` applies.

### 4.2 Comment

- **In-app:** ✅ Created in `posts.ts` (type COMMENT, post_id, comment_id)
- **Push:** ✅ `notifyPostInteraction('comment')` — checks `comments_upvotes`
- **Preference:** ✅ Respected via `prefs?.notifications?.comments_upvotes === false`

### 4.3 Upvote

- **In-app:** ✅ Created in `posts.ts` (type UPVOTE, post_id)
- **Push:** ✅ `notifyPostInteraction('like')` — checks `comments_upvotes`
- **Preference:** ✅ Respected via `prefs?.notifications?.comments_upvotes === false`

### 4.4 Direct Message

- **In-app:** ✅ Created in `messages.ts` (type MESSAGE, meta with conversation_id, message_id)
- **Push:** ✅ `notifyNewMessage` — no type-specific preference check
- **Preference:** ❌ No `notifications.messages` — cannot turn off DMs separately

### 4.5 Team Invite

- **In-app:** ✅ Created in `teams.ts` (type TEAM_INVITE, meta with team_id, team_name, invite_id)
- **Push:** ❌ **No push notification** — only in-app
- **Preference:** N/A (no push)

### 4.6 Game Reminder

- **In-app:** ❌ No in-app notification record
- **Push:** ✅ `notifyUpcomingGames` (cron) — checks `game_event_reminders`
- **Preference:** ✅ Respected via `prefs?.notifications?.game_event_reminders === false`

### 4.7 Mention

- **In-app:** ❌ Not implemented
- **Push:** ❌ Not implemented
- **Preference:** N/A

### 4.8 Share

- **In-app:** ❌ Not implemented (share is client-only)
- **Push:** ❌ `notifyPostInteraction('share')` exists but is never called
- **Preference:** N/A

---

## 5. Recommendations

1. **Add push for team invites** — Call `sendPushNotification` when creating TEAM_INVITE notification; respect `notifications.team_updates`.
2. **Add mention notifications** — Parse `@username` on post/comment create; create in-app + push for each mentioned user; add `notifications.mentions` preference.
3. **Add follow preference** — `notifications.new_followers`; check in `notifyNewFollower`.
4. **Add message preference** — `notifications.messages`; check in `notifyNewMessage`.
5. **Add in-app for game reminders** — Create notification record when sending game reminder push for consistency.
6. **Share notifications** — If “share” becomes a server-tracked action, wire `notifyPostInteraction('share')` and add preference.
7. **Reply-to-comment notifications** — Notify comment author when someone replies to their comment; add preference if desired.
