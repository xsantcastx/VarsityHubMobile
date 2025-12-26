# Event/Game Management - Comprehensive Audit
## Event Creation, Game Scheduling, Team Participation & State Management Analysis
**Date:** December 23, 2025  
**Audit Scope:** Game and Event creation, approval workflows, state transitions, cascade operations, team access control  
**Files Reviewed:** events.ts (551 lines), games.ts (922 lines), gameStories.ts (66 lines), schema (Event/Game models)  

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| **Critical Issues Found** | 2 | ⚠️ Unauthorized deletion, approval workflow bypass |
| **High Issues Found** | 3 | ⚠️ State inconsistency, authorization gaps |
| **Medium Issues Found** | 2 | ⚠️ Event limits, cascade cleanup |
| **Low Issues Found** | 2 | ✅ Inconsistencies, logging |
| **Total Issues** | **9** | **ACTION REQUIRED** |

---

## Critical Issues

### 🔴 ISSUE #1: CRITICAL - Game Deletion Without Authorization Check

**Severity:** CRITICAL | **Type:** Authorization Bypass | **Impact:** Any authenticated user can delete any game

**Location:** `server/src/routes/games.ts:776-785`

**Problem:**
```typescript
// DELETE /games/:id - No authorization check!
gamesRouter.delete('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  
  try {
    // BUG: Only checks if user is authenticated, not if they own/manage the game
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    
    // ANY authenticated user can delete ANY game!
    await prisma.game.delete({ where: { id } });
    
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});
```

**Vulnerabilities:**
1. **No ownership check:** Only verifies authentication, not ownership/management
2. **No team membership validation:** Non-team members can delete games
3. **Cascade deletion:** Deletes all related posts, stories, votes, RSVPs without audit trail
4. **No authorization model:** Contrasts with PUT /:id (has ownership check)

**Impact:**
- User A deletes all games from User B's team
- Malicious users destroy event history for teams
- No recovery mechanism (hard delete, not archived)
- Related content (posts, stories, voting data) also deleted

**Test Case:**
- Coach creates game: GET /teams/{teamId} shows game
- Another Coach requests: DELETE /games/{gameId}
- System allows deletion (should reject)
- Game and all related data permanently deleted
- Original coach's team now has missing game record

**Fix Required:**
- Check if user is team coach/manager (same logic as PUT /:id)
- Check if user is super admin
- Check if user is game creator
- Archive instead of hard delete
- Log deletion with timestamp and reason

---

### 🔴 ISSUE #2: CRITICAL - Event Approval Without Scope Boundary

**Severity:** CRITICAL | **Type:** Privilege Escalation | **Impact:** Any coach can approve any event regardless of team scope

**Location:** `server/src/routes/events.ts:431-480`

**Problem:**
```typescript
eventsRouter.put('/:id/approve', requireVerified as any, async (req: AuthedRequest, res) => {
  // ...authorization check...
  const isAdmin = await getIsAdmin(req as any);
  
  if (!isAdmin && userRole !== 'coach') {
    return res.status(403).json({ error: 'Only coaches and admins can approve events' });
  }
  
  // BUG: No verification that coach is related to the event
  // Coach from Team A can approve events for Team B
  // Coach can approve events with no team affiliation
  
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'approved',
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date(),
    }
  });
});
```

**Vulnerabilities:**
1. **No team scope validation:** Any coach can approve any event
2. **No creator relationship check:** Can't distinguish own vs external events
3. **No event-team association:** Event approval not scoped to linked_league/game_id teams
4. **Asymmetric permission:** Event CREATION is team-scoped, APPROVAL is not

**Impact:**
- Coach A approves events created by Coach B (different teams)
- Coaches approve events outside their organization
- Event approval workflow corrupted (wrong approver recorded)
- No audit trail showing intent

**Test Case:**
- Team A Coach creates event (linked to Team A)
- Team B Coach approves the event (should reject)
- System allows approval (userRole === 'coach' is sufficient)
- Event marked as approved by wrong team's coach
- Event doesn't show who actually approved it

**Fix Required:**
- Verify event's linked team matches user's team membership
- Check event.game_id relates to user's managed teams
- If fan-created event: restrict approval to platform admins or verified coaches
- Log which team/coach performed approval

---

## High Issues

### 🟠 ISSUE #3: HIGH - Event Status Not Enforced on Approval

**Severity:** HIGH | **Type:** State Inconsistency | **Impact:** Events can have mismatched approval states

**Location:** `server/src/routes/events.ts:312-380`

**Problem:**
```typescript
// Event creation allows both status and approval_status fields
const event = await prisma.event.create({
  data: {
    // ...
    approval_status: autoApprove ? 'approved' : 'pending',
    status: autoApprove ? 'approved' : 'draft', // ← Two separate fields!
    approved_at: autoApprove ? new Date() : null,
  },
});

// Later approval doesn't sync both fields
await prisma.event.update({
  where: { id: eventId },
  data: {
    approval_status: 'approved',
    status: 'approved', // Must update both manually
    approved_by: user.id,
    approved_at: new Date(),
  },
});
```

**Vulnerabilities:**
1. **Dual state fields:** `status` and `approval_status` can diverge
2. **No enforcement:** Code doesn't guarantee they stay in sync
3. **Query ambiguity:** Unclear which field to query for approved events
4. **Cascade risk:** Rejection updates may miss one field

**Impact:**
- Event listed as 'approved' but status='draft'
- Queries return inconsistent results
- Frontend shows conflicting information
- Data validation fails silently

**Test Case:**
- Create event as fan (approval_status='pending', status='draft')
- Coach approves event
- Query: WHERE approval_status='approved' returns event
- Query: WHERE status='approved' returns event
- But: approval_status='approved' AND status='draft' possible if code misses sync

**Fix Required:**
- Use single source of truth (recommend: `approval_status`)
- Remove `status` field or sync via database constraint
- Add validation to ensure both fields always match
- Update all endpoints to modify only one field

---

### 🟠 ISSUE #4: HIGH - Game Creator Bypass on Approval Requirements

**Severity:** HIGH | **Type:** Privilege Escalation | **Impact:** Users bypass approval workflow by creating games

**Location:** `server/src/routes/games.ts:307-340`

**Problem:**
```typescript
// Game creation auto-approves based on role
const isAdmin = isEmailAdmin(currentUser?.email);

if (parsed.data.home_team_id && !isAdmin) {
  const membership = await prisma.teamMembership.findFirst({
    where: {
      team_id: parsed.data.home_team_id,
      user_id: req.user.id,
      role: { in: managementRoles }
    }
  });
  isCoach = !!membership;
} else if (isAdmin) {
  isCoach = true;
}

// BUG: If user is not coach/admin, still creates game but with pending status
gameData.approval_status = (isCoach || isAdmin) ? 'approved' : 'pending';

// But later: who can UPDATE a pending game?
// PUT /:id allows creator to edit (line 477):
if (!canEdit && existingGame.created_by_id === req.user.id) {
  canEdit = true; // ← Creator can edit/update pending games!
}
```

**Vulnerabilities:**
1. **Creator can modify pending content:** Fan creates game, updates it freely while pending
2. **Approval bypass:** Fan-created game stays pending but can be modified indefinitely
3. **No approval enforcement:** No endpoint to transition pending→approved for non-coaches
4. **Data staleness:** Pending games can have outdated info with no approval path

**Impact:**
- Fan creates game (pending status)
- Fan modifies game repeatedly
- Game may never be approved (no coach intervention)
- Game data becomes stale and unreliable

**Test Case:**
- Fan creates game (pending approval)
- Fan updates game details multiple times
- Game remains pending indefinitely
- Coach can approve but doesn't (no notification)
- Stale game data remains visible to users

**Fix Required:**
- Don't allow fans to create games (require coach role)
- Or: restrict creator's edit capability while pending
- Or: auto-expire pending games after 7 days
- Add approval workflow monitoring/escalation

---

### 🟠 ISSUE #5: HIGH - No Cascade Cleanup When Game is Deleted

**Severity:** HIGH | **Type:** Data Integrity | **Impact:** Orphaned related records after game deletion

**Location:** `server/src/routes/games.ts:776-790`

**Problem:**
```typescript
gamesRouter.delete('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  // Delete game (should cascade)
  await prisma.game.delete({ where: { id } });
  
  // BUG: Game deletion cascades to:
  // - events (linked via game_id) ← cascade delete
  // - posts (game_id) ← cascade delete  
  // - stories (game_id) ← cascade delete
  // - votes (game_id) ← cascade delete
  // - eventRsvp (event_id) ← indirect cascade
  
  // But NO:
  // - Audit logging
  // - Notification to users who RSVPed
  // - Deletion reason recorded
  // - User permission verification BEFORE attempting delete
});
```

**Vulnerabilities:**
1. **Hard delete (no archive):** Game permanently removed, no recovery
2. **No audit trail:** Who deleted it, when, why?
3. **User notifications missing:** Users who RSVPed not informed
4. **Cascade side effects:** Related content deleted without context

**Impact:**
- User RSVPed to game, game deleted, no notification
- User's post in game discussion deleted silently
- Game statistics/history lost
- Audit trail missing

**Fix Required:**
- Archive games instead of hard delete (add deleted_at field)
- Log deletion with user ID, timestamp, reason
- Notify affected users (those with RSVPs)
- Add soft-delete support or marked-for-deletion status

---

## Medium Issues

### 🟡 ISSUE #6: MEDIUM - Event Plan Limits Not Enforced Consistently

**Severity:** MEDIUM | **Type:** Resource Abuse | **Impact:** Users can exceed event creation limits

**Location:** `server/src/routes/events.ts:326-340`

**Problem:**
```typescript
// Event creation limit check
if (userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free')) {
  const pendingCount = await prisma.event.count({
    where: {
      creator_id: user.id,
      approval_status: 'pending', // ← Only counts pending!
    },
  });
  
  // BUG: Only blocks creation of NEW events, not updates
  // Fan creates 3 pending events (hits limit)
  // Coach approves one: approval_status changes to 'approved'
  // Now pendingCount = 2, fan can create more events!
  
  if (pendingCount >= 3) {
    return res.status(403).json({ error: 'Event limit reached' });
  }
}

// BUG: No update endpoint - but if there were, approvals would reset counter
```

**Vulnerabilities:**
1. **Approval resets limit:** When event is approved, pendingCount decreases
2. **Temporary bypass:** Fan can create events up to limit, get approvals, create more
3. **No total event check:** Doesn't count approved events
4. **Inconsistent limits:** Different logic for fans vs coaches

**Impact:**
- Fan creates 3 pending events
- Coach approves all 3 (counts as 0 pending now)
- Fan creates 3 more, gets approval
- Fan effectively bypasses limit by cycling through approvals

**Test Case:**
- Fan user (rookie plan) creates event #1 (pending)
- Creates event #2 (pending)
- Creates event #3 (pending)
- Requests event #4 → BLOCKED (limit reached)
- Coach approves event #1, #2, #3
- Requests event #4 → ALLOWED (all are approved now, pending count = 0)

**Fix Required:**
- Count total events (approved + pending)
- Or count only events created in last 30 days
- Track lifetime event creation by plan
- Cache limits to prevent repeated counting

---

### 🟡 ISSUE #7: MEDIUM - Event Rejection Without Cascade Effects

**Severity:** MEDIUM | **Type:** State Inconsistency | **Impact:** Rejected events still have associated data

**Location:** `server/src/routes/events.ts:492-540`

**Problem:**
```typescript
eventsRouter.put('/:id/reject', requireVerified as any, async (req: AuthedRequest, res) => {
  // Reject event
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'rejected',
      status: 'rejected',
      rejected_reason: reason,
      approved_by: null,
      approved_at: null,
    },
  });
  
  // BUG: Rejection doesn't clean up:
  // - EventRsvp records (users still marked as attending)
  // - EventPostAccess records (access still granted)
  // - Posts attached to event
  // - User notifications/reminders scheduled
  // - Push notifications sent for rejection not received by users
});
```

**Vulnerabilities:**
1. **RSVPs not cancelled:** Users still counted as attendees
2. **Access not revoked:** Post access tokens still valid
3. **No user notifications:** Users don't know event was rejected
4. **Orphaned data:** Posts still reference rejected event

**Impact:**
- Event rejected
- User A still has RSVP (appears to attend non-existent event)
- Event notifications scheduled but event canceled
- Posts visible under rejected event

**Test Case:**
- User RSVPs to event (approval_status=pending)
- Coach rejects event
- Event shows as rejected
- User's RSVP record still exists
- User's notification for rejection not sent
- Event posts still visible under event record

**Fix Required:**
- When rejecting: delete all EventRsvp records
- Revoke EventPostAccess tokens
- Send notifications to all RSVPed users
- Update posts to have event_id=null or marked as orphaned

---

## Low Issues

### 🟢 ISSUE #8: LOW - Inconsistent Authorization Check Implementation

**Severity:** LOW | **Type:** Inconsistency | **Impact:** Authorization patterns vary across endpoints

**Location:** `server/src/routes/events.ts:446` vs `games.ts:913`

**Problem:**
```typescript
// Events: Use getIsAdmin(req)
const isAdmin = await getIsAdmin(req as any);

// Games: Use emailAdmin check
const isAdmin = isEmailAdmin(userRecord?.email);

// Inconsistent patterns make code harder to review
// Different admin checks could have different implementations
```

**Vulnerabilities:**
1. **Dual admin mechanisms:** Two different ways to check admin
2. **Potential divergence:** If one is updated, other isn't
3. **Code review difficulty:** Hard to spot authorization issues

**Impact:**
- Admin checks use different logic in different files
- One method might be more permissive/restrictive
- Harder to maintain consistency

**Fix Required:**
- Create shared utility function: `isAdminUser(req)`
- Use consistently across all routes
- Document admin criteria in one place

---

### 🟢 ISSUE #9: LOW - Missing Event Deletion Endpoint

**Severity:** LOW | **Type:** Missing Feature | **Impact:** Event creators can't remove their events

**Location:** `server/src/routes/events.ts` (no DELETE endpoint)

**Problem:**
```typescript
// Games have: DELETE /games/:id
// Events do NOT have: DELETE /events/:id

// Users who create events can't delete them
// Only way to remove is approval rejection (if admin approves rejection)
// No self-service removal for creators
```

**Vulnerabilities:**
1. **No self-service:** Event creators can't remove events
2. **Asymmetric operations:** Create but not delete
3. **Admin burden:** Admins must handle removal requests

**Impact:**
- User creates event, regrets it
- Can't delete (has to ask admin or wait for rejection)
- Event remains visible indefinitely

**Test Case:**
- Fan creates event
- Fan wants to delete it
- No endpoint available
- Fan must contact support

**Fix Required:**
- Add DELETE /events/:id endpoint
- Allow creator to delete own events
- Allow admins to delete any event
- Archive instead of hard delete
- Notify RSVPed users on deletion

---

## Summary Table

| Issue | Severity | Type | Location | Fix Complexity |
|-------|----------|------|----------|-----------------|
| #1: Game Delete No Auth | CRITICAL | Bypass | games.ts:776 | High |
| #2: Event Approval No Scope | CRITICAL | Escalation | events.ts:431 | High |
| #3: Event Status Mismatch | HIGH | Inconsistency | events.ts:312 | Medium |
| #4: Creator Bypass | HIGH | Escalation | games.ts:307 | High |
| #5: Game Delete Cascade | HIGH | Integrity | games.ts:776 | High |
| #6: Limit Not Enforced | MEDIUM | Abuse | events.ts:326 | Low |
| #7: Rejection Cascade | MEDIUM | Inconsistency | events.ts:492 | Medium |
| #8: Admin Check Inconsistency | LOW | Inconsistency | Multiple | Low |
| #9: Missing Delete | LOW | Feature Gap | events.ts | Medium |

---

## Recommended Fix Priority

### Phase 1 (Critical Path - Blocks other fixes):
1. **Issue #1:** Add authorization check to game delete (2-3 hours)
2. **Issue #2:** Add scope validation to event approval (2-3 hours)

### Phase 2 (High Severity):
3. **Issue #4:** Fix game creator edit bypass (2-3 hours)
4. **Issue #5:** Add cascade cleanup for game deletion (3-4 hours)
5. **Issue #3:** Consolidate status fields (1-2 hours)

### Phase 3 (Medium Severity):
6. **Issue #7:** Add rejection cleanup (2-3 hours)
7. **Issue #6:** Fix event limit enforcement (1-2 hours)

### Phase 4 (Low Priority):
8. **Issue #9:** Add event deletion endpoint (2-3 hours)
9. **Issue #8:** Standardize admin checks (1-2 hours)

---

## Deployment Impact

- **Breaking Changes:** None (fixes restrict/block access)
- **Database Changes:** Potentially add deleted_at field for soft deletes
- **Dependencies:** None
- **Testing:** Medium (need to test authorization boundaries)
- **Risk Level:** Low (fixes prevent attacks, don't introduce new features)

---

## Deployment Checklist

- [ ] Apply all critical fixes (Issues #1, #2)
- [ ] Apply high-severity fixes (Issues #3, #4, #5)
- [ ] Run Snyk security scan
- [ ] Test authorization boundaries
- [ ] Update API documentation
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production

---

## Next Steps

1. ✅ Audit complete - 9 issues identified
2. ⏳ Implement critical fixes (Issues #1, #2)
3. ⏳ Implement high-severity fixes (Issues #3, #4, #5)
4. ⏳ Run Snyk security scan
5. ⏳ Create comprehensive fix summary

---

**Status: READY FOR IMPLEMENTATION**
