# Performance, Scale, and Image/Video Handling Audit

**Date:** February 23, 2026  
**Scope:** Database queries (feed, map, discover), 1000-user load bottlenecks, image/video handling

---

## 1. Database Query Audit — Feed, Map, Discover

### Main Queries by Page

| Page | Endpoints Called | Key Tables | Filters/Sorts |
|------|------------------|------------|---------------|
| **Feed** | `GET /posts`, `GET /games`, `GET /highlights`, `GET /events`, `Game.votesSummary` (N calls) | Post, Game, Event, PostUpvote, PostBookmark, Follows | `deleted_at: null`, `created_at` desc, `author_id IN (...)`, `game_id`, `team_id` |
| **Map** | `GET /games`, `GET /events` | Game, Event | `approval_status: approved`, `date >= now`, `status != cancelled` |
| **Discover** | `GET /games`, `GET /posts` (trending/list), `GET /search`, `Team.allMembers`, `User.listAll` | Game, Post, User, Team, Organization | `created_at`, `upvotes_count`, zip/location, search `q` |

### Schema Indexes vs. Query Needs

| Table | Indexes (from schema) | Query Filters Used | Gap? |
|-------|------------------------|--------------------|------|
| **Post** | `created_at`, `author_id`, `game_id+created_at`, `game_id+type`, `team_id`, `team_id+is_pinned` | `deleted_at: null`, `author_id IN`, `created_at`, `country_code`, `upvotes_count`, `lat/lng`, `media_url` | ❌ No index on `deleted_at`; no index on `country_code`, `upvotes_count`, `lat`, `lng` |
| **Game** | `date`, `latitude+longitude`, `home_team_id`, `away_team_id` | `approval_status`, `date` range | ✅ Adequate |
| **Event** | `date`, `game_id`, `latitude+longitude`, `creator_id`, `approval_status`, `event_type` | `status != cancelled`, `approval_status`, `date >= now` | ⚠️ No index on `status` |
| **Follows** | `follower_id`, `following_id` | `follower_id`, `following_id IN` | ✅ Adequate |

### Top 3 Most Frequent Queries (by traffic)

1. **`GET /posts`** (feed, discover)  
   - **Query:** `Post.findMany({ where: { deleted_at: null, ... }, orderBy: created_at desc, take: limit+1 })`  
   - **Indexes used:** `created_at` (partial). `deleted_at: null` has no dedicated index — PostgreSQL may scan rows where `deleted_at IS NULL`.  
   - **EXPLAIN ANALYZE:** Run:
     ```sql
     EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Post" WHERE "deleted_at" IS NULL ORDER BY "created_at" DESC LIMIT 11;
     ```
   - **Risk:** Full table scan on `Post` if `deleted_at` is not indexed. Add `@@index([deleted_at])` or composite `@@index([deleted_at, created_at])`.

2. **`GET /games`** (map, feed, discover)  
   - **Query:** `Game.findMany({ where: { approval_status: 'approved', date: { gte, lte } }, orderBy: date, take: 50 })`  
   - **Indexes used:** `date`, possibly `approval_status` (not in schema — would need `@@index([approval_status, date])`).  
   - **EXPLAIN ANALYZE:** Run:
     ```sql
     EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Game" WHERE "approval_status" = 'approved' AND "date" >= $1 AND "date" <= $2 ORDER BY "date" DESC LIMIT 50;
     ```
   - **Risk:** If `approval_status` is not in an index with `date`, may do index scan on `date` then filter — usually acceptable.

3. **`GET /highlights`** (feed)  
   - **Query:** `Post.findMany({ where: { country_code, created_at >= since, media_url != null, deleted_at: null }, orderBy: [upvotes_count desc, created_at desc], take: 10 })`  
   - **Indexes used:** None of `country_code`, `upvotes_count`, `deleted_at` are indexed.  
   - **EXPLAIN ANALYZE:** Run:
     ```sql
     EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Post" WHERE "country_code" = 'US' AND "created_at" >= $1 AND "media_url" IS NOT NULL AND "deleted_at" IS NULL ORDER BY "upvotes_count" DESC, "created_at" DESC LIMIT 10;
     ```
   - **Risk:** **Full table scan** — no index supports this filter/order combination. Add `@@index([country_code, created_at])` or `@@index([country_code, upvotes_count])`.

### Recommended Index Additions

```prisma
// Post model
@@index([deleted_at])                    // For WHERE deleted_at IS NULL
@@index([deleted_at, created_at])        // Composite for feed + soft-delete
@@index([country_code, created_at])      // For highlights national query
@@index([country_code, upvotes_count])   // For highlights ranking
// Or partial: @@index([country_code, upvotes_count], where: "deleted_at IS NULL AND media_url IS NOT NULL")

// Event model
@@index([status])                        // For status != 'cancelled'
@@index([approval_status, status, date]) // Composite for map default query
```

---

## 2. 1000 Concurrent Users — Top 3 Bottlenecks

### Assumptions

- 1000 users active simultaneously
- Each user: feed load (~5–10 API calls), map/discover (~3–5), polling (~1–2/min)
- Rough estimate: ~8,000–15,000 requests in first 30 seconds

### Bottleneck 1: **API Rate Limit (2000 req/15 min per IP)**

- **Location:** `server/src/app.ts` — `apiLimiter: 2000 req / 15 min` (default key = IP; no custom keyGenerator)
- **Effect:** Limit is **per IP**. 1000 users on unique IPs = 2000 req/15min each (OK). Users behind shared NAT (school, office) share one IP → **2000 req/15min for entire group**.
- **Detail:** A feed load ≈ 10 requests. 2000/15min ≈ 133 req/min per IP. ~13 full feed loads per 15 min per IP. For 100 users behind one NAT, 2000/100 = 20 req each in 15 min — **throttling within 1–2 feed loads**.
- **Conclusion:** **Shared IPs will hit 429 quickly.** Consider per-user keying for authenticated routes, or higher limit for read-heavy endpoints.

### Bottleneck 2: **Database Connection Pool**

- **Location:** Prisma default pool (typically `connection_limit: 10` or similar)
- **Effect:** 1000 concurrent users → many concurrent DB queries. Each request may hold a connection for 50–200ms. With 10 connections, only ~10 requests can query at once; rest queue. **Connection pool exhaustion** → requests queued, timeouts.
- **Mitigation:** Increase `datasource` connection_limit in Prisma (e.g. 50–100 for Railway). Use PgBouncer if needed.

### Bottleneck 3: **N+1 and Heavy Queries**

- **Feed:** `Game.votesSummary` is called **per game** in a loop (`Promise.allSettled(limited.map(entry => Game.votesSummary(entry.id)))`). 30 games = 30 extra HTTP requests. With 1000 users loading feed, that could be 30,000 `votesSummary` calls.
- **Discover:** `Post.trendingPage` fetches **500 posts** (`TRENDING_POOL_SIZE`) then sorts in memory. With 1000 users, 1000 × 500 = 500k rows read.
- **Followed feed:** `Follows.findMany` + `Post.findMany` with `author_id IN (followingIds)` — if a user follows 500 people, `IN` clause is large; index may help but query is still heavy.

### Endpoints Most Likely to Fail Under Load

| Endpoint | Why |
|----------|-----|
| 1. **`GET /posts`** (feed) | Highest volume; trending fetches 500 rows; rate limit + DB load |
| 2. **`GET /games`** + **`Game.votesSummary`** | Feed calls both; votesSummary is N separate requests |
| 3. **`GET /highlights`** | Potential full table scan; no supporting index |

### Recommendations

1. **Relax apiLimiter** — e.g. 5000–10000 req/15min per user for read-heavy app.
2. **Increase DB connection pool** — set `connection_limit` in Prisma schema.
3. **Batch votesSummary** — add `GET /games/votes-summary?ids=id1,id2,...` to fetch multiple games in one request.
4. **Cache /highlights** — Redis or in-memory cache with 1–5 min TTL.

---

## 3. Image and Video Handling Audit

### Compression Before Storage

| Location | Compression? | Notes |
|----------|--------------|-------|
| **Server** (`uploads.ts`, `cloudinary.ts`) | ❌ **No** | Raw buffer sent to Cloudinary. No `sharp`, `jimp`, or `ffmpeg` before upload. |
| **Cloudinary** | Cloudinary may apply transforms | Upload uses default settings; no `quality`, `fetch_format`, or `transformation` in upload params. |
| **Client** | `expo-image-picker` quality: 0.8 | Images only; videos use original quality. |

### Client-Side Upload

- `ImagePicker` with `quality: 0.8` for images — reduces size.
- Videos: no quality/resolution option; typically uploaded as-is.

### Server-Side Limits

| Limit | Value | Location |
|-------|-------|----------|
| **Max file size** | **100 MB** | `uploads.ts` line 56: `limits: { fileSize: 100 * 1024 * 1024 }` |
| **Enforced** | ✅ Yes | Multer rejects with `LIMIT_FILE_SIZE` → 413 response |
| **General files** | 100 MB | Same for `/files` endpoint |

### 4K Video Upload

| Scenario | Result |
|----------|--------|
| **4K video** (~500 MB–2 GB) | ❌ Rejected — 413 "File too large. Maximum size is 100MB." |
| **4K video** (~50–80 MB) | ✅ Accepted — uploads to Cloudinary |
| **Processing** | No transcoding; Cloudinary stores as uploaded. Playback may be slow on mobile. |
| **Memory** | With `memoryStorage()`, entire file is buffered in RAM before upload. 80 MB × 10 concurrent = 800 MB RAM. |

### Gaps

1. **No image compression** — Large photos (e.g. 12 MP) stored at full resolution.
2. **No video transcoding** — 4K/1080p stored as-is; no adaptive streaming or mobile-friendly variants.
3. **100 MB limit** — 4K videos often exceed this; users get 413 with no guidance.
4. **Memory pressure** — `memoryStorage` buffers full file in RAM; many concurrent uploads can cause OOM.

### Recommendations

1. **Add server-side image compression** — Use `sharp` to resize/compress before Cloudinary (e.g. max 1920px, quality 80).
2. **Lower video limit** — e.g. 50 MB with clear error; or add video upload flow with transcoding.
3. **Stream to Cloudinary** — Use upload streams instead of full buffer to reduce memory use.
4. **Cloudinary transformations** — Use `e_auto:quality` or similar in delivery URLs for automatic optimization.
