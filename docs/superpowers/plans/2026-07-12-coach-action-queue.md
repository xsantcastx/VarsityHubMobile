# Coach Hub — Needs-Action Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `team-hub` from a bare redirect into a coach home that renders one server-aggregated "needs my action" queue (pending event approvals + pending game approvals + org join requests across every team/org the coach manages).

**Architecture:** A new thin `GET /me/action-queue` route delegates to `lib/coachActionQueue.ts`, which resolves the caller's managed scope server-side and aggregates the three pending sources into a typed, counted, deep-linkable list. `team-hub.tsx` renders it via react-query with four states. No schema change, no migration, no new route file.

**Tech Stack:** Express + Prisma (server), React Native / Expo Router + react-query + Zod (client), Jest + supertest (tests).

## Global Constraints

- Server tests run via `cd server && npm test` (wraps jest with `node --experimental-vm-modules`). A single suite: `cd server && npm test -- --testPathPattern="<name>" --no-coverage`.
- ALL Prisma `findMany` MUST carry a `take`.
- Routes accessing `req.user` MUST be behind `requireAuth`; error responses use the error envelope / `asyncHandler` (no raw `res.status().json()` for new server errors — but reads that return data are fine).
- Client screens gate spinners on `isPending`, never `isFetching`; one `lib/queryClient` only.
- Text colors MUST use theme (`useColorScheme()`/`Colors[scheme]`) — never hardcode `#000`/`#111`/`black`.
- `TEAM_STAFF_ROLES` (from `server/src/lib/teamAuthorization.ts`) = `['owner','manager','coach','assistant_coach']`.
- `/me/*` requests are proxied to `authRouter` (`server/src/app.ts:354`), so `GET /me/action-queue` is registered on `authRouter` in `server/src/routes/auth.ts`.
- Client change is NOT live until `eas update`; server change deploys on merge to `main` (Railway).

---

## File Structure

- **Create** `server/src/lib/coachActionQueue.ts` — scope resolution + aggregation + `ActionItem`/`ActionQueue` types. Single responsibility: "what needs this user's action."
- **Modify** `server/src/routes/auth.ts` — add the thin `GET /me/action-queue` route near the existing `GET /me`.
- **Create** `server/src/__tests__/coach-action-queue.test.ts` — server behavior tests.
- **Create** `api/schemas/actionQueue.ts` — Zod validator for the response.
- **Modify** `api/entities.ts` — add `User.actionQueue()`.
- **Modify** `app/(tabs)/team-hub.tsx` — render the queue (replaces the redirect).
- **Modify** `app/(tabs)/__tests__/team-hub.test.tsx` — extend for the queue states.

---

## Task 1: Server lib — managed scope + events source + types

**Files:**
- Create: `server/src/lib/coachActionQueue.ts`
- Test: `server/src/__tests__/coach-action-queue.test.ts`

**Interfaces:**
- Produces: `getCoachManagedScope(userId: string): Promise<{ teamIds: string[]; ownedOrgIds: string[] }>`; `buildCoachActionQueue(userId: string): Promise<ActionQueue>`; types `ActionKind`, `ActionItem`, `ActionQueue`.

- [ ] **Step 1: Confirm field names** — run `cd server && grep -nE "approval_status|home_team_id|away_team_id|title|location|created_at" prisma/schema.prisma | grep -iE "model Event|model Game" -A15 | head`. Confirm `Event` has `approval_status`, `team_id`, `title`, `date`, `location`, `created_at`; `Game` has `approval_status`, `home_team_id`, `away_team_id`, `title`, `date`, `location`, `created_at`. (Used by the query below.)

- [ ] **Step 2: Write the failing test**

```ts
// server/src/__tests__/coach-action-queue.test.ts
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

let prisma: any;
let buildCoachActionQueue: any;
const ts = Date.now();
let coachId = '', otherCoachId = '', orgId = '', teamId = '';

describe('coach action queue', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ buildCoachActionQueue } = await import('../lib/coachActionQueue.js'));

    const mk = (label: string) =>
      prisma.user.create({
        data: {
          email: `caq-${label}-${ts}@example.com`, password_hash: 'x', display_name: label,
          email_verified: true, role: 'coach', onboarding_completed: true, approval_status: 'APPROVED',
          preferences: { role: 'coach' },
        },
      });
    coachId = (await mk('coach')).id;
    otherCoachId = (await mk('other')).id;

    const org = await prisma.organization.create({
      data: { name: `CAQ Org ${ts}`, org_type: 'club', admin_approved: true, updated_at: new Date(), league_owner_id: coachId },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({ data: { organization_id: org.id, user_id: coachId, role: 'owner', status: 'active' } });
    const team = await prisma.team.create({ data: { name: `CAQ Team ${ts}`, organization_id: org.id } });
    teamId = team.id;
    await prisma.teamMembership.create({ data: { team_id: team.id, user_id: coachId, role: 'coach', status: 'active' } });

    // A pending event on the coach's team.
    await prisma.event.create({
      data: { title: `Pending Practice ${ts}`, team_id: team.id, approval_status: 'pending', date: new Date(), created_by: otherCoachId } as any,
    });
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [coachId, otherCoachId] } } }).catch(() => {});
  });

  it('returns the coach\'s pending event as an action item', async () => {
    const q = await buildCoachActionQueue(coachId);
    expect(q.counts.events).toBe(1);
    const ev = q.items.find((i: any) => i.kind === 'event');
    expect(ev).toBeTruthy();
    expect(ev.team_id).toBe(teamId);
    expect(ev.route).toContain('/event-approvals');
    expect(q.total).toBe(q.items.length);
  });

  it('does NOT include another coach\'s items (scope isolation)', async () => {
    const q = await buildCoachActionQueue(otherCoachId);
    expect(q.counts.events).toBe(0);
    expect(q.total).toBe(0);
  });
});
```

- [ ] **Step 3: Run it, verify it fails**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: FAIL — cannot find module `../lib/coachActionQueue.js`.

- [ ] **Step 4: Implement the lib (scope + events source only)**

```ts
// server/src/lib/coachActionQueue.ts
import { prisma } from './prisma.js';
import { TEAM_STAFF_ROLES } from './teamAuthorization.js';

export type ActionKind = 'event' | 'game' | 'request';
export interface ActionItem {
  kind: ActionKind;
  id: string;
  title: string;
  subtitle: string;
  team_id?: string | null;
  org_id?: string | null;
  created_at: string;
  route: string;
}
export interface ActionQueue {
  total: number;
  counts: { events: number; games: number; requests: number };
  items: ActionItem[];
}

const SOURCE_TAKE = 50;

// Teams the user can manage (direct staff role) PLUS every active team inside an
// org they own — resolved server-side, never from client input.
export async function getCoachManagedScope(
  userId: string
): Promise<{ teamIds: string[]; ownedOrgIds: string[] }> {
  const [staff, owned] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { user_id: userId, role: { in: [...TEAM_STAFF_ROLES] }, status: 'active' },
      select: { team_id: true },
      take: 5000,
    }),
    prisma.organizationMembership.findMany({
      where: { user_id: userId, role: 'owner', status: 'active' },
      select: { organization_id: true },
      take: 5000,
    }),
  ]);
  const ownedOrgIds = owned.map(o => o.organization_id);
  const orgTeams = ownedOrgIds.length
    ? await prisma.team.findMany({
        where: { organization_id: { in: ownedOrgIds }, status: 'active' },
        select: { id: true },
        take: 5000,
      })
    : [];
  const teamIds = [...new Set([...staff.map(m => m.team_id), ...orgTeams.map(t => t.id)])];
  return { teamIds, ownedOrgIds };
}

export async function buildCoachActionQueue(userId: string): Promise<ActionQueue> {
  const { teamIds } = await getCoachManagedScope(userId);

  const events = teamIds.length
    ? await prisma.event.findMany({
        where: { approval_status: 'pending', team_id: { in: teamIds } },
        select: { id: true, title: true, date: true, location: true, team_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: SOURCE_TAKE,
      })
    : [];

  const items: ActionItem[] = events.map(e => ({
    kind: 'event' as const,
    id: e.id,
    title: e.title || 'Event',
    subtitle: e.location || (e.date ? new Date(e.date).toLocaleDateString() : 'Pending approval'),
    team_id: e.team_id,
    created_at: (e.created_at ?? new Date()).toISOString(),
    route: `/event-approvals?teamId=${encodeURIComponent(e.team_id ?? '')}`,
  }));

  items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    total: items.length,
    counts: { events: events.length, games: 0, requests: 0 },
    items,
  };
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: PASS (2 tests). Then `npx tsc --noEmit --project tsconfig.json` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/coachActionQueue.ts server/src/__tests__/coach-action-queue.test.ts
git commit -m "feat(coach-queue): lib scope resolution + pending-events source"
```

---

## Task 2: Add pending-games source

**Files:**
- Modify: `server/src/lib/coachActionQueue.ts`
- Test: `server/src/__tests__/coach-action-queue.test.ts`

**Interfaces:**
- Consumes: `getCoachManagedScope`, `buildCoachActionQueue` (Task 1).
- Produces: `buildCoachActionQueue` now also returns `kind:'game'` items and `counts.games`.

- [ ] **Step 1: Add a failing test** — in the existing describe block, seed a pending game and assert it appears:

```ts
  it('includes a pending game on the coach\'s team', async () => {
    const g = await prisma.game.create({
      data: { title: `Pending Game ${ts}`, home_team_id: teamId, approval_status: 'pending', date: new Date() } as any,
    });
    const q = await buildCoachActionQueue(coachId);
    expect(q.counts.games).toBeGreaterThanOrEqual(1);
    const item = q.items.find((i: any) => i.kind === 'game' && i.id === g.id);
    expect(item).toBeTruthy();
    expect(item.route).toBe(`/game/${g.id}`);
    await prisma.game.deleteMany({ where: { id: g.id } });
  });
```
Also add `await prisma.game.deleteMany({ where: { OR: [{ home_team_id: teamId }, { away_team_id: teamId }] } }).catch(() => {});` to `afterAll`.

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: FAIL — no game item found.

- [ ] **Step 3: Implement the games source** — in `buildCoachActionQueue`, after the `events` query add:

```ts
  const games = teamIds.length
    ? await prisma.game.findMany({
        where: {
          approval_status: 'pending',
          OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
        },
        select: { id: true, title: true, date: true, location: true, home_team_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: SOURCE_TAKE,
      })
    : [];
```
Then push game items into `items` before the sort:

```ts
  items.push(
    ...games.map(g => ({
      kind: 'game' as const,
      id: g.id,
      title: g.title || 'Game',
      subtitle: g.location || (g.date ? new Date(g.date).toLocaleDateString() : 'Pending approval'),
      team_id: g.home_team_id,
      created_at: (g.created_at ?? new Date()).toISOString(),
      route: `/game/${g.id}`,
    }))
  );
```
And update the return: `counts: { events: events.length, games: games.length, requests: 0 }`.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: PASS (3 tests). Then `npx tsc --noEmit --project tsconfig.json` → 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/coachActionQueue.ts server/src/__tests__/coach-action-queue.test.ts
git commit -m "feat(coach-queue): add pending-games source"
```

---

## Task 3: Add org join-requests source

**Files:**
- Modify: `server/src/lib/coachActionQueue.ts`
- Test: `server/src/__tests__/coach-action-queue.test.ts`

**Interfaces:**
- Consumes: `getCoachManagedScope` (`ownedOrgIds`).
- Produces: `buildCoachActionQueue` now also returns `kind:'request'` items + `counts.requests`.

- [ ] **Step 1: Confirm the join-request model** — run `cd server && grep -nE "model .*JoinRequest|OrganizationJoinRequest|TeamJoinRequest" prisma/schema.prisma`. Use the ORGANIZATION join-request model (the one written by the org join-request flow). Confirm its fields: `organization_id`, `status`, `user_id`, `created_at`. Also run `grep -n "listOrganizationJoinRequestsForOrganization" server/src/lib/organizationJoinRequests.ts` and read its signature — if it returns pending requests for a single org id, reuse it per org; otherwise query the model directly with the `where` below.

- [ ] **Step 2: Add a failing test** — seed a pending org join request and assert it appears:

```ts
  it('includes a pending org join request for an org the coach owns', async () => {
    const jr = await prisma.organizationJoinRequest.create({
      data: { organization_id: orgId, user_id: otherCoachId, status: 'pending' } as any,
    });
    const q = await buildCoachActionQueue(coachId);
    expect(q.counts.requests).toBeGreaterThanOrEqual(1);
    const item = q.items.find((i: any) => i.kind === 'request' && i.id === jr.id);
    expect(item).toBeTruthy();
    expect(item.org_id).toBe(orgId);
    expect(item.route).toContain('/organization-join-requests');
    await prisma.organizationJoinRequest.deleteMany({ where: { id: jr.id } });
  });
```
(If step 1 shows a different model name, use it here and in the implementation.) Add `await prisma.organizationJoinRequest.deleteMany({ where: { organization_id: orgId } }).catch(() => {});` to `afterAll`.

- [ ] **Step 3: Run it, verify it fails**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: FAIL — no request item found.

- [ ] **Step 4: Implement the requests source** — in `buildCoachActionQueue` add after `games` (use the model name confirmed in step 1):

```ts
  const requests = ownedOrgIds.length
    ? await prisma.organizationJoinRequest.findMany({
        where: { organization_id: { in: ownedOrgIds }, status: 'pending' },
        select: { id: true, organization_id: true, user_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: SOURCE_TAKE,
      })
    : [];
```
Destructure `ownedOrgIds` at the top: `const { teamIds, ownedOrgIds } = await getCoachManagedScope(userId);`. Push request items:

```ts
  items.push(
    ...requests.map(r => ({
      kind: 'request' as const,
      id: r.id,
      title: 'Join request',
      subtitle: 'Someone wants to join your organization',
      org_id: r.organization_id,
      created_at: (r.created_at ?? new Date()).toISOString(),
      route: `/organization-join-requests?id=${encodeURIComponent(r.organization_id)}`,
    }))
  );
```
Update return: `counts: { events: events.length, games: games.length, requests: requests.length }`.

- [ ] **Step 5: Run tests, verify pass**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: PASS (4 tests). Then `npx tsc --noEmit --project tsconfig.json` → 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/coachActionQueue.ts server/src/__tests__/coach-action-queue.test.ts
git commit -m "feat(coach-queue): add org join-requests source"
```

---

## Task 4: The `GET /me/action-queue` route

**Files:**
- Modify: `server/src/routes/auth.ts` (add route near the existing `GET /me`, ~line 2632)
- Test: `server/src/__tests__/coach-action-queue.test.ts`

**Interfaces:**
- Consumes: `buildCoachActionQueue` (Tasks 1–3).
- Produces: HTTP `GET /me/action-queue` → `ActionQueue` JSON.

- [ ] **Step 1: Add a failing supertest** — append to the test file (import `request` + `app`, and `signJwt` for a token):

```ts
import request from 'supertest';
import { app } from '../app.js';
// ...inside describe, after obtaining a token for coachId via signJwt:
  it('GET /me/action-queue returns the queue for the authed coach', async () => {
    const { signJwt } = await import('../lib/jwt.js');
    const token = signJwt({ id: coachId });
    const res = await request(app).get('/me/action-queue').set('Authorization', `Bearer ${token}`).expect(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.counts).toHaveProperty('events');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /me/action-queue returns empty for a manager-of-nothing (no 403)', async () => {
    const { signJwt } = await import('../lib/jwt.js');
    const token = signJwt({ id: otherCoachId });
    const res = await request(app).get('/me/action-queue').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.total).toBe(0);
  });
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Register the route** — in `server/src/routes/auth.ts`, near the existing `GET /me` handler, add (confirm `requireAuth`, `requireOnboarded`, `asyncHandler` are already imported in this file; they are used by other routes here):

```ts
import { buildCoachActionQueue } from '../lib/coachActionQueue.js';
// ...
authRouter.get(
  '/me/action-queue',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const queue = await buildCoachActionQueue(req.user!.id);
    return res.json(queue);
  })
);
```
(Place the import with the other lib imports at the top; place the route with the other `/me` routes.)

- [ ] **Step 4: Run tests, verify pass**

Run: `cd server && npm test -- --testPathPattern="coach-action-queue" --no-coverage`
Expected: PASS (6 tests). Then `npx tsc --noEmit --project tsconfig.json` → 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/src/__tests__/coach-action-queue.test.ts
git commit -m "feat(coach-queue): GET /me/action-queue route"
```

---

## Task 5: Client contract — schema + entities method

**Files:**
- Create: `api/schemas/actionQueue.ts`
- Modify: `api/entities.ts` (add `User.actionQueue()`)

**Interfaces:**
- Produces: `User.actionQueue(): Promise<ActionQueueResponse>`; type `ActionQueueResponse`.

- [ ] **Step 1: Write the schema**

```ts
// api/schemas/actionQueue.ts
import { z } from 'zod';
import { captureException } from '@/utils/sentry';

const actionItemSchema = z
  .object({
    kind: z.enum(['event', 'game', 'request']),
    id: z.string(),
    title: z.string(),
    subtitle: z.string(),
    team_id: z.string().nullable().optional(),
    org_id: z.string().nullable().optional(),
    created_at: z.string(),
    route: z.string(),
  })
  .passthrough();

const actionQueueSchema = z
  .object({
    total: z.number(),
    counts: z.object({ events: z.number(), games: z.number(), requests: z.number() }).passthrough(),
    items: z.array(actionItemSchema),
  })
  .passthrough();

export type ActionQueueResponse = z.infer<typeof actionQueueSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;

export function validateActionQueue(endpoint: string, payload: unknown): ActionQueueResponse {
  const result = actionQueueSchema.safeParse(payload);
  if (result.success) return result.data;
  captureException(new Error(`Action queue schema drift at ${endpoint}`), {
    tags: { context: 'response_shape_drift', entity: 'action_queue', endpoint },
  });
  return payload as ActionQueueResponse;
}
```

- [ ] **Step 2: Add the entities method** — in `api/entities.ts`, inside the `User` object (starts ~line 47), add:

```ts
  actionQueue: () =>
    httpGet('/me/action-queue').then(data => validateActionQueue('user.actionQueue', data)),
```
Add the import at the top: `import { validateActionQueue } from './schemas/actionQueue';` (match the existing schema-import style in this file).

- [ ] **Step 3: Typecheck**

Run (repo root): `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add api/schemas/actionQueue.ts api/entities.ts
git commit -m "feat(coach-queue): client schema + User.actionQueue()"
```

---

## Task 6: `team-hub` renders the queue

**Files:**
- Modify: `app/(tabs)/team-hub.tsx`
- Test: `app/(tabs)/__tests__/team-hub.test.tsx`

**Interfaces:**
- Consumes: `User.actionQueue()` (Task 5), `useRequireTeamManagement` (existing).

- [ ] **Step 1: Read the current screen + its test** — `app/(tabs)/team-hub.tsx` (redirect logic) and `app/(tabs)/__tests__/team-hub.test.tsx`. Preserve: the `useRequireTeamManagement` gate and the `CoachAccessRedirecting` non-coach fallback.

- [ ] **Step 2: Rewrite the render** — replace the redirect body with the queue. Keep `loading` (from `useRequireTeamManagement`) and the non-coach branch. Add:

```tsx
import { useQuery } from '@tanstack/react-query';
import { User } from '@/api/entities';
import { FlatList, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
// inside the component, AFTER the coach gate passes:
const router = useRouter();
const { data, isPending, isError, refetch } = useQuery({
  queryKey: ['action-queue', user?.id],
  queryFn: () => User.actionQueue(),
  enabled: canManage && !loading,
});
```
Render, in order (all theme-aware — use `theme.text`/`theme.mutedText`/`theme.background`):
- `if (loading)` → existing spinner.
- `if (!canManage)` → existing `CoachAccessRedirecting`.
- `if (isPending)` → `<ActivityIndicator size="large" color={theme.tint} />`.
- `if (isError)` → a message `Couldn't load your queue` + a `Pressable` calling `refetch()` labeled "Try again".
- `if (!data || data.total === 0)` → empty state: a title "You're all caught up" + subtitle "Nothing needs your approval right now." + the **Manage footer** below.
- else → header "Needs your attention" + `FlatList` of `data.items`, each row a `Pressable onPress={() => router.push(item.route as any)}` showing `item.title` (bold, `theme.text`) and `item.subtitle` (`theme.mutedText`), plus the Manage footer.

**Manage footer** (shown in empty + success states) — preserves what the redirect did:

```tsx
function ManageFooter({ user, theme, router }: any) {
  const orgId = getCanonicalOrganizationId(user);
  return (
    <View style={{ marginTop: 16 }}>
      {orgId ? (
        <Pressable onPress={() => router.push(`/organization?id=${orgId}&tab=overview` as any)}>
          <Text style={{ color: theme.tint }}>Manage league</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/manage-teams' as any)}>
        <Text style={{ color: theme.tint }}>Manage teams</Text>
      </Pressable>
    </View>
  );
}
```
(Import `getCanonicalOrganizationId` from `@/utils/authState` — already imported in this file.)

- [ ] **Step 3: Update the screen test** — in `app/(tabs)/__tests__/team-hub.test.tsx`, mock `User.actionQueue` and assert: (a) non-coach still renders `CoachAccessRedirecting`; (b) with `total:0` the "You're all caught up" copy renders; (c) with one item, its `title` renders. Follow the existing mocking style in that test file (it already mocks `useRequireTeamManagement`).

- [ ] **Step 4: Run the client test + typecheck**

Run: `npx jest app/\(tabs\)/__tests__/team-hub.test.tsx` (or the repo's client jest command) then `npx tsc --noEmit`.
Expected: PASS; 0 tsc errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/team-hub.tsx" "app/(tabs)/__tests__/team-hub.test.tsx"
git commit -m "feat(coach-queue): team-hub renders the needs-action queue"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** endpoint (Tasks 1–4) ✓, three sources (Tasks 1–3) ✓, server-side scope (Task 1) ✓, response shape + `route` deep-links (Tasks 1–3) ✓, client schema/entities (Task 5) ✓, team-hub 4 states + Manage footer (Task 6) ✓, tests server+client ✓. Deferred items (badge, screen refactor, pagination) intentionally excluded per spec §7.
- **Placeholder scan:** no TBD/TODO; the two "confirm the model/field names" steps (Task 1 §1, Task 3 §1) are real grounding steps with exact grep commands, not deferrals — the implementer confirms then uses the shown code.
- **Type consistency:** `ActionItem`/`ActionQueue`/`buildCoachActionQueue`/`getCoachManagedScope` names match across tasks; client `validateActionQueue`/`User.actionQueue` consistent; `counts` keys `{events,games,requests}` identical server + client.
