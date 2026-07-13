# Post-Launch Technical Debt (V1.1)

> Do NOT implement any of these before submission. They are non-blocking and saved for v1.1.

---

## Performance

### 1. Query timeouts on high-traffic endpoints

Add `Promise.race(query, timeout(20000))` to prevent a slow Prisma query from hanging
the entire request with no timeout. Currently the notifications endpoint has this pattern;
apply it to:

- `GET /posts` (posts.ts lines 226 and 347)
- `GET /messages` (messages.ts)
- `GET /highlights` (highlights.ts)
- `GET /games` (games.ts)

Pattern to follow (already used in notifications.ts):

```typescript
const TIMEOUT_MS = 20_000;
const result = await Promise.race([
  prisma.post.findMany(query),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout')), TIMEOUT_MS)
  ),
]);
```

---

### 2. Convert feed.tsx followed posts from `.map()` to FlatList

`app/feed.tsx` lines 204–208 and 320–323 render followed posts and followed-teams posts
using `.map()` inside a ScrollView. For users with many followed accounts this list
grows unbounded. Convert to a virtualized FlatList with pagination.

---

## Data Growth

### 3. Unread notification cleanup

`overnightTasks.ts` currently deletes **read** notifications older than 30 days.
There is no cleanup for **unread** notifications that are very old (a user who never
checks notifications will accumulate them forever). Add a cron that deletes unread
notifications older than 90 days.

```typescript
await prisma.notification.deleteMany({
  where: {
    read_at: null,
    created_at: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  },
});
```

---

## Observability

### 4. Database index audit after real traffic

Once we have 30+ days of real query volume, pull slow query logs from Railway/Postgres
and add indexes for any columns that show up in sequential scans. Run:

```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Testing

### 5. Automated test coverage for auth flow and API layer

Current coverage: ~1% (5 test files for ~487 source files).
Start with the highest-risk flows:

- Auth: register → verify → login → refresh → logout
- Payments: checkout → webhook → plan upgrade
- Team creation with plan limits enforced
- Admin: approve/reject coach flow

---

_Last updated: 2026-03-28_
