# Pitch Events (Fan Event Creation) - Real-World Audit

**Date**: December 2024  
**Status**: 🟡 **ISSUES FOUND**

---

## Executive Summary

The pitch events system (fan event creation) is **mostly implemented** but has **several real-world issues** that need fixing:

1. 🟠 **Fans can't view their own pending events** - No way to track submissions
2. 🟠 **No way to edit pending events** - Fans must delete and recreate
3. 🟠 **3-event limit doesn't account for approved/rejected events** - Only counts pending
4. 🟡 **No team/league association** - Events aren't linked to specific teams
5. 🟡 **Approval workflow gaps** - Missing some edge cases

---

## Current Implementation

### What Works ✅

1. **Fan Event Creation**
   - Fans can create events via `POST /events`
   - Events go to `approval_status: 'pending'`
   - Date validation works
   - 3-event limit enforced

2. **Approval System**
   - Coaches/admins can view pending events via `GET /events/pending`
   - Coaches/admins can approve/reject via `PUT /events/:id/approve` and `PUT /events/:id/reject`
   - Notifications sent on approval/rejection

3. **Auto-Approval**
   - Coaches/organizers get auto-approval
   - Fans need approval

---

## 🔴 CRITICAL ISSUES

### Issue #1: Fans Can't View Their Own Pending Events

**Problem**: 
- No endpoint for fans to see their submitted events
- No UI for fans to track their event submissions
- Fans don't know if their events are still pending or were rejected

**Location**: No endpoint exists

**Real-World Impact**:
- **User frustration** - Fans submit events and never hear back
- **No transparency** - Can't see status of submissions
- **Duplicate submissions** - Fans recreate events thinking they failed

**Fix Required**:
```typescript
// Add endpoint: GET /events/my-events
eventsRouter.get('/my-events', requireAuth as any, async (req: AuthedRequest, res) => {
  const events = await prisma.event.findMany({
    where: { creator_id: req.user!.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      title: true,
      date: true,
      approval_status: true,
      status: true,
      rejected_reason: true,
      created_at: true,
    },
  });
  return res.json(events);
});
```

---

### Issue #2: No Way to Edit Pending Events

**Problem**:
- Fans can't edit events after submission
- Must delete and recreate if they made a mistake
- Loses their place in approval queue

**Location**: No edit endpoint for pending events

**Real-World Impact**:
- **User frustration** - Typo in event means starting over
- **Wasted time** - Re-submission delays approval
- **Poor UX** - No way to fix mistakes

**Fix Required**:
```typescript
// Add endpoint: PATCH /events/:id (for creators only, if pending)
eventsRouter.patch('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: 'Not found' });
  
  // Only creator can edit, and only if pending
  if (event.creator_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only the creator can edit this event' });
  }
  
  if (event.approval_status !== 'pending') {
    return res.status(400).json({ 
      error: 'Can only edit pending events',
      message: 'Once approved or rejected, events cannot be edited.',
    });
  }
  
  // Update event...
});
```

---

### Issue #3: 3-Event Limit Logic Issue

**Problem**:
- Limit only counts `approval_status: 'pending'` events
- Doesn't count approved or rejected events
- Fan could have 10 approved events + 3 pending = 13 total

**Location**: `server/src/routes/events.ts:279-295`

**Current Code**:
```typescript
const pendingCount = await prisma.event.count({
  where: {
    creator_id: user.id,
    approval_status: 'pending',  // Only counts pending!
  },
});
```

**Real-World Impact**:
- **Unclear limit** - Is it 3 pending or 3 total?
- **Confusion** - Fans might think limit is total events
- **Potential abuse** - Fans could create many events if they get approved quickly

**Fix Required**:
**Option 1**: Count only pending (current behavior - document it clearly)
**Option 2**: Count total events (more restrictive)
**Option 3**: Count events created in last 30 days (time-based limit)

**Recommendation**: Keep current behavior but **document clearly** and consider adding total event count to response.

---

## 🟠 HIGH PRIORITY ISSUES

### Issue #4: No Team/League Association

**Problem**:
- Events have `linked_league` field but it's just a string
- No actual relationship to Team or Organization models
- Can't filter events by team
- Can't notify team members about new events

**Location**: `server/prisma/schema.prisma:205`

**Current**:
```prisma
linked_league String? // League/school name or ID
```

**Real-World Impact**:
- **No team integration** - Events don't appear on team pages
- **No notifications** - Team members don't know about events
- **Poor discovery** - Can't find events for specific teams

**Fix Required**:
```prisma
model Event {
  // ... existing fields
  team_id String?
  team Team? @relation(fields: [team_id], references: [id])
  organization_id String?
  organization Organization? @relation(fields: [organization_id], references: [id])
}
```

---

### Issue #5: Approval Workflow Edge Cases

**Problem**:
1. **Can approve already-approved events** - No check
2. **Can reject already-rejected events** - No check
3. **No validation that event is actually pending**
4. **No audit trail** - Who approved/rejected and when

**Location**: `server/src/routes/events.ts:367-420`

**Current Code**:
```typescript
eventsRouter.put('/:id/approve', requireVerified as any, async (req: AuthedRequest, res) => {
  // ❌ No check if event is already approved/rejected
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'approved',
      // ...
    },
  });
});
```

**Real-World Impact**:
- **State confusion** - Events can be approved multiple times
- **No idempotency** - Same action can be repeated
- **No audit trail** - Can't track who did what

**Fix Required**:
```typescript
eventsRouter.put('/:id/approve', requireVerified as any, async (req: AuthedRequest, res) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  
  // Check if already approved
  if (event.approval_status === 'approved') {
    return res.status(400).json({ 
      error: 'Event already approved',
      message: 'This event has already been approved.',
    });
  }
  
  // Check if already rejected
  if (event.approval_status === 'rejected') {
    return res.status(400).json({ 
      error: 'Event already rejected',
      message: 'This event has already been rejected. Cannot approve a rejected event.',
    });
  }
  
  // Only approve if pending
  if (event.approval_status !== 'pending') {
    return res.status(400).json({ 
      error: 'Invalid state',
      message: 'Can only approve pending events.',
    });
  }
  
  // Update with audit trail
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'approved',
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date(),
    },
  });
});
```

---

### Issue #6: Rejection Doesn't Allow Resubmission

**Problem**:
- When event is rejected, fan can't easily resubmit
- Must create new event from scratch
- Loses original submission data

**Real-World Impact**:
- **User frustration** - Can't fix and resubmit
- **Lost data** - Original event details gone
- **Poor UX** - No way to address rejection feedback

**Fix Required**:
**Option 1**: Allow editing rejected events to resubmit
**Option 2**: Add "Resubmit" action that creates new event from rejected one
**Option 3**: Allow coaches to "Request Changes" instead of reject

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue #7: No Bulk Actions

**Problem**:
- Coaches must approve/reject events one by one
- No bulk approve/reject functionality
- Time-consuming for large approval queues

**Real-World Impact**:
- **Inefficiency** - Slow approval process
- **Poor UX** - Tedious for moderators

**Fix Required**: Add bulk actions endpoint:
```typescript
POST /events/bulk-approve { event_ids: string[] }
POST /events/bulk-reject { event_ids: string[], reason?: string }
```

---

### Issue #8: No Event Expiration

**Problem**:
- Pending events never expire
- Old pending events clutter approval queue
- No automatic cleanup

**Real-World Impact**:
- **Approval queue bloat** - Old events never reviewed
- **Confusion** - Events for past dates still pending

**Fix Required**: Auto-reject events with past dates:
```typescript
// Cron job or middleware check
if (event.date < new Date() && event.approval_status === 'pending') {
  await prisma.event.update({
    where: { id: event.id },
    data: {
      approval_status: 'rejected',
      rejected_reason: 'Event date has passed',
    },
  });
}
```

---

### Issue #9: No Event Preview for Approvers

**Problem**:
- Approvers see basic event info
- No preview of how event will look when published
- Can't see event details without navigating

**Real-World Impact**:
- **Slower approval** - Must navigate to see full details
- **Poor UX** - Incomplete information in approval queue

**Fix Required**: Include full event details in pending events response.

---

## 📊 Testing Scenarios

### Test 1: Fan Creates Event
```bash
# Fan creates event
POST /events { title: "Test Event", date: "2025-12-25", ... }
# Should return: { approval_status: 'pending', message: 'Your event has been submitted for approval.' }
```

### Test 2: Fan Hits 3-Event Limit
```bash
# Fan creates 3 events (all pending)
# Try to create 4th event
POST /events { ... }
# Should return: 403 { error: 'Event limit reached', limit: 3, current: 3 }
```

### Test 3: Fan Views Own Events
```bash
# Currently: No endpoint exists ❌
# Should add: GET /events/my-events
# Should return: List of fan's events with approval status
```

### Test 4: Coach Approves Event
```bash
# Coach approves pending event
PUT /events/{id}/approve {}
# Should: Update approval_status to 'approved'
# Should: Send notification to creator
# Should: Event appears in public listings
```

### Test 5: Coach Approves Already-Approved Event
```bash
# Coach tries to approve already-approved event
PUT /events/{id}/approve {}
# Currently: Succeeds (no check) ❌
# Should: Return 400 "Event already approved"
```

---

## Summary of Required Fixes

### Critical (Must Fix)
1. ✅ **Add endpoint for fans to view their events** - `GET /events/my-events`
2. ✅ **Add edit endpoint for pending events** - `PATCH /events/:id` (creator only, pending only)
3. ✅ **Fix approval/rejection idempotency** - Check current status before updating

### High Priority (Should Fix)
4. ✅ **Add team/league relationships** - Link events to teams/organizations
5. ✅ **Document 3-event limit clearly** - Explain it's pending events only
6. ✅ **Add resubmission flow** - Allow fans to fix and resubmit rejected events

### Medium Priority (Nice to Have)
7. ✅ **Add bulk actions** - Bulk approve/reject
8. ✅ **Add event expiration** - Auto-reject past events
9. ✅ **Improve approval UI** - Show full event details in queue

---

## Files to Modify

1. `server/src/routes/events.ts` - Add new endpoints and fix approval logic
2. `server/prisma/schema.prisma` - Add team/organization relationships (migration needed)
3. `app/create-fan-event.tsx` - Add link to view submitted events
4. `app/event-approvals.tsx` - Improve approval UI

---

**Status**: 🟡 **REQUIRES FIXES**  
**Priority**: **HIGH** - These issues affect user experience and system reliability
