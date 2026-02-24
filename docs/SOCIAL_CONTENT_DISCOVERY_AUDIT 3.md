# Social — Content & Discovery Audit

**Date:** February 23, 2026  
**Scope:** Discover page, hashtags/mentions, content sharing/deep links, trending algorithm

---

## 1. Discover Page Audit

### Can users find other users, teams, and organizations by searching?

**⚠️ Partial — depends on context**

| Entity | Search location | Status |
|--------|-----------------|--------|
| **Users** | Messages compose modal | ✅ `User.listAll(q)` — search by username/email |
| **Users** | Discover page | ❌ No user search on discover |
| **Teams** | Team Hub | ✅ Search box "Search for teams, players, or events" — filters locally |
| **Teams** | Discover page | ❌ No team search on discover |
| **Organizations** | Onboarding step-4 | ✅ `useOrganizationSearch` — search by zip/name |
| **Organizations** | Discover page | ❌ No org search on discover |

**Discover page** (`app/(tabs)/discover/mobile-community.tsx`):
- Search box: "Search by keyword or Zip Code..." — used only for **zip code suggestions** (games by location)
- No unified search for users, teams, or organizations
- Shows: Quick Actions, Discover/Following tabs (posts), calendar, games by date

### Do search results show follow status?

**✅ Yes** (where follow exists)
- **Discover posts**: `is_following_author` shown; Follow/Following button in post header (lines 817–848)
- **Messages user search**: No follow status (compose flow)
- **Team Hub search**: Local filter only; no explicit follow status in results

### Can they follow directly from search results without navigating to profile?

**✅ Yes** (Discover posts only)
- Discover post cards have inline Follow/Following button; `User.follow(authorId)` / `User.unfollow(authorId)` called on press
- **Messages**: No follow from search (compose only)
- **Team/Org**: No discover search for teams/orgs; follow is on team/org profile pages

**Gap:** Discover has no search for users, teams, or organizations — only zip-based game search and post discovery.

---

## 2. Hashtags and Mentions Audit

### If a user types #basketball or @username in a post, are these clickable?

**❌ No**

- Post content/caption is rendered as plain `<Text>` in:
  - `PostCard.tsx` (lines 265, 266, 290): `{caption}` in `<Text>`
  - `post-detail.tsx`: content shown as plain text
- No parsing of `#` or `@` into clickable segments
- Hashtags and mentions are displayed as plain text, not links

### Do they navigate to tag feed or user profile?

**❌ No** — no clickable behavior.

### Implementation status

- **MentionInput** (`components/ui/MentionInput.tsx`): Used for **composing** posts — `@` triggers `User.searchForMentions` for autocomplete. Not used for **display** of existing content.
- **Backend**: No `GET /posts?hashtag=...` or similar endpoint for tag feeds
- **Post content**: No `LinkifiedText` or similar component for `#tag` or `@user` in post body

**Recommendation:** Add a `LinkifiedText` (or similar) component that:
- Parses `#(\w+)` → tap navigates to `/posts?hashtag=...` or similar tag feed
- Parses `@(\w+)` → tap navigates to `/user-profile?username=...` or user lookup by username

---

## 3. Content Sharing & Deep Links Audit

### When a user taps share on a post, does it generate a deep link?

**✅ Yes** — `useShareLink` + `AppLinks.post(id, caption)`:
- `webUrl`: `https://varsityhub.app/posts/{id}`
- `deepLink`: `{scheme}://post/{id}` (e.g. `varsityhubmobile://post/123`)
- `shareMessage`: caption + webUrl

### What is actually shared?

**Shared content:** `Share.share({ message, url, title })`  
- `url` is `link.webUrl` (web URL), not `link.deepLink`
- Recipients receive the **web URL** (`https://varsityhub.app/posts/123`), not the app scheme URL

### Does the shared link open the app to that specific post?

**⚠️ Depends on configuration**

1. **Web URL** (`https://varsityhub.app/posts/123`):
   - Opens in browser unless configured as a **universal link**
   - Requires `apple-app-site-association` (iOS) and `assetlinks.json` (Android) for the domain
   - `deepLinks.ts` supports `https://varsityhub.com/share?type=post&id=123` and path-based links, but **domain is `varsityhub.com`** while `links.ts` uses `varsityhub.app` — potential mismatch

2. **Scheme mismatch (bug)** in `deepLinks.ts`:
   - `APP_SCHEME = 'varsityhub'` (hardcoded in `utils/deepLinks.ts` line 21)
   - `app.json` and `config/env.ts` use `varsityhubmobile`
   - Incoming links use `varsityhubmobile://post/123` (actual app scheme)
   - `parseSchemeLink` checks `parsed.scheme === APP_SCHEME` → `'varsityhubmobile' !== 'varsityhub'` → **app scheme links are rejected**
   - Fix: Use `getConfig().appScheme` in `deepLinks.ts` instead of hardcoded `'varsityhub'`

3. **Domain mismatch** in `deepLinks.ts`:
   - `WEB_DOMAINS = ['varsityhub.com', 'www.varsityhub.com']`
   - Shared URLs use `https://varsityhub.app/posts/{id}` (from `links.ts` / `config/env.ts`)
   - Universal links to `varsityhub.app` are **not** recognized by the handler

4. **Path format mismatch**:
   - Shared web URL: `https://varsityhub.app/posts/123` (path: `/posts/123`)
   - `parsePathLink` expects path like `/post/123` → `ROUTE_MAP['post']` exists
   - Path `/posts/123` yields `type='posts'` → `ROUTE_MAP['posts']` is undefined → **path-based parsing fails**
   - Fix: Add `posts` to `ROUTE_MAP` or change `links.ts` to use `/post/{id}`

5. **Route mapping** in `deepLinks.ts`:
   - `post` → `/post-detail` (params: `{ id }`)
   - `profile` → `/public-profile` (params: `{ id }`)
   - App routes use `post-detail?id=...` and `user-profile?id=...` — confirm `id` vs `username` for profile

6. **Deep link listener setup**:
   - `setupDeepLinkListener` and `handleInitialDeepLink` exist in `utils/deepLinks.ts`
   - Must be wired in `_layout.tsx` or root for cold start and in-app links

### Test on real device

- Verify universal links for `https://varsityhub.app/posts/{id}` if that is the shared URL
- Verify scheme is consistent: `varsityhubmobile://post/123` should open the app when the scheme is registered
- Ensure deep link handler is invoked on app launch and when the app is opened via a link

---

## 4. Trending Algorithm Audit

### What makes a post trending?

**Server** (`server/src/routes/posts.ts` lines 47–49):

```typescript
const orderBy = sort === 'trending'
  ? [{ upvotes_count: 'desc' as const }, { created_at: 'desc' as const }]
  : [{ created_at: 'desc' as const }];
```

### Exact behavior

- **Primary sort:** `upvotes_count` descending
- **Secondary sort:** `created_at` descending (tie-breaker only)
- **No time decay** — no weighting by recency or age

### Does it surface relevant recent content?

**❌ No**

- Old posts with many upvotes stay at the top
- New posts with low upvotes are buried
- No time decay (e.g. Wilson score, Reddit-style hot, or exponential decay by age)

### Recommendation

Introduce time decay, e.g.:

1. **Hot score:** `upvotes / (1 + age_in_hours)` or similar
2. **Wilson score** with time decay
3. **Time window:** `WHERE created_at > now() - interval '7 days'` then sort by upvotes
4. **Hybrid:** `0.7 * normalized_upvotes + 0.3 * recency_score` (or similar)

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Discover: user/team/org search | ❌ | No unified search on discover |
| Discover: follow status | ✅ | Shown on post cards |
| Discover: follow from results | ✅ | Inline follow on post cards |
| Hashtags clickable | ❌ | Plain text only |
| Mentions clickable | ❌ | Plain text only |
| Share generates link | ✅ | Web URL + deep link |
| Deep link opens app | ⚠️ | Depends on universal links + scheme consistency |
| Trending algorithm | ❌ | Upvotes only, no time decay |
