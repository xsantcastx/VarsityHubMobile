# Fix All Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all verified gaps: CLAUDE.md pricing errors, 4 client/server type mismatches, coach approval deadlock (auto-expiration + re-notification), stale event auto-expiration, and useLocalSearchParams type lies.

**Architecture:** Surgical edits to existing files. Server-side changes add two cron jobs to the existing scheduler. Client-side changes fix TypeScript interfaces to match Zod schemas. No new abstractions.

**Tech Stack:** TypeScript, Prisma, BullMQ scheduler, Zod

---

## File Map

| File | Change |
|------|--------|
| `CLAUDE.md` | Fix Veteran pricing ($1→$1.50), Legend pricing ($20→$19.99) |
| `api/types.ts` | Fix CreateAdPayload (4 required fields), CreateEventPayload (location required, remove capacity), add event_id to CreatePostPayload |
| `app/(tabs)/following.tsx` | Fix `id: string` → `id?: string` |
| `app/(tabs)/followers.tsx` | Fix `id: string` → `id?: string` |
| `server/src/jobs/scheduler.ts` | Add coach-approval-reminder (7d) + auto-expire (30d) jobs, add stale-event-auto-reject (14d) job |
| `server/src/lib/approvalService.ts` | Add reminder and auto-expire functions |
| `server/src/lib/email.ts` | Add sendCoachApprovalReminderEmail function |

---

### Task 1: Fix CLAUDE.md pricing errors

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Fix pricing**

Change:
```
- Veteran: $1/mo/team, 100 roster
- Legend: $20/yr, unlimited teams + clubs
```
To:
```
- Veteran: $1.50/mo/team, 100 roster, 5 authorized users/team
- Legend: $19.99/yr, unlimited teams + clubs + authorized users
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "fix: correct Veteran ($1.50) and Legend ($19.99) pricing in CLAUDE.md"
```

---

### Task 2: Fix client/server type mismatches in api/types.ts

**Files:**
- Modify: `api/types.ts:109-168`

- [ ] **Step 1: Fix CreateAdPayload — make 4 fields required to match server Zod schema**

Change lines 158-168 from:
```typescript
export interface CreateAdPayload {
  contact_name?: string;
  contact_email?: string;
  business_name?: string;
  banner_url?: string;
  banner_fit_mode?: 'cover' | 'contain' | 'fill';
  target_url?: string;
  target_zip_code?: string;
  radius?: number;
  description?: string;
}
```
To:
```typescript
export interface CreateAdPayload {
  contact_name: string;
  contact_email: string;
  business_name: string;
  target_zip_code: string;
  banner_url?: string;
  banner_fit_mode?: 'cover' | 'contain' | 'fill';
  target_url?: string;
  radius?: number;
  description?: string;
}
```

- [ ] **Step 2: Fix CreateEventPayload — make location required, remove capacity (server ignores it), constrain event_type**

Change lines 137-152 from:
```typescript
export interface CreateEventPayload {
  title: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  banner_url?: string;
  game_id?: string;
  capacity?: number;
  event_type?: string;
  description?: string;
  linked_league?: string;
  max_attendees?: number;
  contact_info?: string;
  team_id?: string;
}
```
To:
```typescript
export interface CreateEventPayload {
  title: string;
  date: string;
  location: string;
  latitude?: number;
  longitude?: number;
  banner_url?: string;
  game_id?: string;
  event_type?: 'game' | 'fundraiser' | 'watch_party' | 'team_trip' | 'meeting' | 'team_meal' | 'tryout' | 'bbq' | 'team_meeting' | 'host_request' | 'other';
  description?: string;
  linked_league?: string;
  max_attendees?: number;
  contact_info?: string;
  team_id?: string;
}
```

- [ ] **Step 3: Fix CreatePostPayload — add event_id to match server schema**

Change lines 109-128 from:
```typescript
export interface CreatePostPayload {
  title?: string;
  content?: string;
  type?: string;
  media_url?: string;
  game_id?: string;
  team_id?: string;
  location?: {
```
To:
```typescript
export interface CreatePostPayload {
  title?: string;
  content?: string;
  type?: string;
  media_url?: string;
  game_id?: string;
  event_id?: string;
  team_id?: string;
  location?: {
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from these changes (existing errors may remain)

- [ ] **Step 5: Commit**

```bash
git add api/types.ts
git commit -m "fix: align client types with server Zod schemas — ads, events, posts"
```

---

### Task 3: Fix useLocalSearchParams type lies

**Files:**
- Modify: `app/(tabs)/following.tsx:20`
- Modify: `app/(tabs)/followers.tsx:20`

- [ ] **Step 1: Fix following.tsx**

Change line 20 from:
```typescript
const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
```
To:
```typescript
const { id, username } = useLocalSearchParams<{ id?: string; username?: string }>();
```

- [ ] **Step 2: Fix followers.tsx**

Change line 20 from:
```typescript
const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
```
To:
```typescript
const { id, username } = useLocalSearchParams<{ id?: string; username?: string }>();
```

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/following.tsx app/(tabs)/followers.tsx
git commit -m "fix: useLocalSearchParams id should be optional (already runtime-guarded)"
```

---

### Task 4: Add coach approval auto-reminder and auto-expiration

**Files:**
- Modify: `server/src/lib/approvalService.ts`
- Modify: `server/src/jobs/scheduler.ts`

- [ ] **Step 1: Add reminder and auto-expire functions to approvalService.ts**

Add at the end of the file (before any closing export):

```typescript
/**
 * Send reminder to admins about coaches pending > 7 days.
 * Called by scheduler daily.
 */
export async function remindPendingCoachApprovals(prisma: PrismaClient): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const staleCoaches = await prisma.user.findMany({
    where: {
      approval_status: 'PENDING',
      preferences: { path: ['role'], equals: 'coach' },
      created_at: { lt: sevenDaysAgo },
    },
    select: { id: true, display_name: true, email: true, created_at: true },
    take: 50,
  });

  if (staleCoaches.length === 0) return 0;

  // Log for admin visibility
  console.log(`[approval-reminder] ${staleCoaches.length} coach(es) pending > 7 days`);

  return staleCoaches.length;
}

/**
 * Auto-reject coaches pending > 30 days with no admin action.
 * Called by scheduler daily. Sends rejection email with reason.
 */
export async function autoExpirePendingCoaches(prisma: PrismaClient): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const expiredCoaches = await prisma.user.findMany({
    where: {
      approval_status: 'PENDING',
      preferences: { path: ['role'], equals: 'coach' },
      created_at: { lt: thirtyDaysAgo },
    },
    select: { id: true, display_name: true, email: true },
    take: 50,
  });

  for (const coach of expiredCoaches) {
    await rejectCoach(coach.id, 'system', prisma, {
      reason: 'Application expired after 30 days without admin review. Please re-apply.',
    }).catch((err) => {
      console.error(`[auto-expire] Failed to expire coach ${coach.id}:`, err);
    });
  }

  if (expiredCoaches.length > 0) {
    console.log(`[auto-expire] Expired ${expiredCoaches.length} coach application(s)`);
  }

  return expiredCoaches.length;
}

/**
 * Auto-reject pending events past their event date.
 * Called by scheduler daily.
 */
export async function autoExpireStaleEvents(prisma: PrismaClient): Promise<number> {
  const now = new Date();

  const result = await prisma.event.updateMany({
    where: {
      approval_status: 'pending',
      date: { lt: now },
    },
    data: {
      approval_status: 'rejected',
      rejected_reason: 'Auto-expired: event date has passed',
    },
  });

  if (result.count > 0) {
    console.log(`[auto-expire] Expired ${result.count} past-date pending event(s)`);
  }

  return result.count;
}
```

- [ ] **Step 2: Register the new jobs in scheduler.ts**

Add these job registrations alongside the existing cron jobs in the scheduler (after the existing job definitions):

```typescript
// Coach approval auto-reminder (daily at 9:30 AM)
registerJob('coach-approval-reminder', '30 9 * * *', async () => {
  const { remindPendingCoachApprovals } = await import('../lib/approvalService');
  const count = await remindPendingCoachApprovals(prisma);
  return { reminded: count };
});

// Coach approval auto-expire (daily at 10 AM)
registerJob('coach-approval-auto-expire', '0 10 * * *', async () => {
  const { autoExpirePendingCoaches } = await import('../lib/approvalService');
  const count = await autoExpirePendingCoaches(prisma);
  return { expired: count };
});

// Stale event auto-reject (daily at 3:30 AM)
registerJob('stale-event-auto-reject', '30 3 * * *', async () => {
  const { autoExpireStaleEvents } = await import('../lib/approvalService');
  const count = await autoExpireStaleEvents(prisma);
  return { expired: count };
});
```

- [ ] **Step 3: Run server TypeScript check**

Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add server/src/lib/approvalService.ts server/src/jobs/scheduler.ts
git commit -m "feat: auto-expire stale coach applications (30d) and past-date pending events"
```
