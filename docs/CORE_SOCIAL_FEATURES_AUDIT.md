# Core Social Features Audit

**Date:** February 23, 2026  
**Scope:** Follow system, Feed, Comments, Upvotes

---

## 1. Follow System

### User → User ✅

- **Follow/Unfollow:** `POST /users/:id/follow`, `DELETE /users/:id/follow` (server: `users.ts`)
- **Followers/Following lists:** `GET /users/:id/followers`, `GET /users/:id/following`
- **Profile counts:** `followers_count`, `following_count` returned in `GET /users/:id`
- **is_following_author:** Returned on posts so UI can show "Follow" vs "Following"
- **Notification:** `notifyNewFollower()` when someone follows you

### User → Team ❌

- **Not implemented.** `Follows` model only has `follower_id` and `following_id` (both User IDs).
- `GET /follows/teams` returns **team memberships** (teams you're a member of), not "followed teams."
- `team-page.tsx` line 638: `// TODO: Implement team follow/unfollow API`

### User → Organization ❌

- **Not implemented.** No schema or API for following organizations.

### Follower Count Real-Time

- Counts are fetched on profile load. No WebSocket or push. User must refresh or navigate away and back to see updated counts.

### Feed from Followed Accounts

- **GET /posts** does **not** filter by followed accounts. It returns all posts (with optional `game_id`, `type`, `user_id`).
- Discover (`mobile-community.tsx`) fetches all posts and filters client-side: `followingOnly = items.filter(p => p.is_following_author)`. The API still returns everything.

---

## 2. Feed

### Main Feed (app/feed.tsx)

- **This is a GAMES feed**, not a social posts feed. It shows:
  - Upcoming and past games/events
  - Sponsored ads
  - Highlights reel
- No social posts (user-created posts) are shown on the main feed tab.

### Social Posts Feed

- **Where posts appear:**
  - **Discover** (`mobile-community.tsx`): Uses `Post.trendingPage()` or `Post.list()` — shows all posts, client-side split into "From people you follow" vs "Discover."
  - **Game detail** (`GameDetailsScreen`, `GameVerticalFeedScreen`): `Game.posts(gameId)` — posts for a specific game.
  - **Profile:** `User.postsForProfile(id)` — posts by a specific user.
  - **Organization:** `Post.list()` — all posts (no org filter).

### Post Creation → Feed Visibility

- When a user creates a post, it is stored with `author_id`. Followers would see it only if:
  1. They open Discover (which fetches all posts; posts from followed authors are in `followingPosts`).
  2. They open the game the post is attached to.
  3. They visit the author's profile.
- **No dedicated "feed from followed accounts" endpoint.** The API does not support `?followed_only=true` or similar.

### Sorting

- **GET /posts:** `sort=trending` → `upvotes_count desc, created_at desc`; default → `created_at desc`.
- **Discover:** Uses trending or recent; client separates by `is_following_author`.

---

## 3. Comments

### Create Comment ✅

- `POST /posts/:id/comments` with `{ content }` (1–1000 chars).
- Notification sent to post author (if not self).
- **Immediate appearance:** Frontend adds returned comment to state: `setComments([created, ...arr])` — comment appears right away.

### Display Comments ✅

- `GET /posts/:id/comments` — paginated, ordered by `created_at desc`.
- Other users see comments when they load the post.

### Delete Comment ⚠️

- `DELETE /posts/:postId/comments/:commentId` — **only the comment author** can delete.
- **Post owner cannot delete comments on their post.** The audit requirement was: "Can the post owner delete a comment on their post?" — **No.**

---

## 4. Upvotes

### Upvote ✅

- `POST /posts/:id/upvote` — toggle (add if not present, remove if present).
- Returns `{ has_upvoted, upvotes_count, count }`.

### Count Update ✅

- Server updates `post.upvotes_count` in a transaction.
- PostCard: `setUpvotesCount(r.count)` — instant UI update.
- Post-detail: optimistic update + server reconciliation.

### Remove Upvote ✅

- Same toggle — if already upvoted, removes it.

### Double Voting ✅

- `PostUpvote` has unique `(post_id, user_id)`. Server checks `findUnique` before create; if exists, deletes instead.

---

## Summary: Gaps and Recommendations

| Feature                   | Status | Gap                                          |
| ------------------------- | ------ | -------------------------------------------- |
| Follow user               | ✅     | —                                            |
| Follow team               | ❌     | No team follow; only membership              |
| Follow organization       | ❌     | No org follow                                |
| Follower count real-time  | ⚠️     | No push; refresh required                    |
| Feed from followed        | ❌     | No API filter; client-side only in Discover  |
| Main feed = posts         | ❌     | Main feed is games, not posts                |
| Post in followers' feed   | ⚠️     | Only if they use Discover; no dedicated feed |
| Comment create/display    | ✅     | —                                            |
| Post owner delete comment | ❌     | Only comment author can delete               |
| Upvote/remove/double-vote | ✅     | —                                            |

### Recommended Fixes

1. **Post owner delete comment:** Extend `DELETE /posts/:postId/comments/:commentId` to allow post owner (`post.author_id === userId`) in addition to comment author.
2. **Feed from followed:** Add `?followed_only=true` to `GET /posts` to filter `author_id IN (SELECT following_id FROM Follows WHERE follower_id = currentUserId)`.
3. **Team/org follow:** Add `TeamFollow` and `OrganizationFollow` models and APIs if product requires it.
4. **Main feed:** Consider adding a "Posts" tab or section that shows posts from followed accounts (using the new `followed_only` filter).
