# Event Page Logic - Real-World Audit

**Date**: December 2024  
**Status**: 🔴 **CRITICAL ISSUES FOUND**

---

## Executive Summary

The event system has **several critical issues** that will cause problems in real-world usage:

1. 🔴 **Capacity not enforced** - Users can exceed event capacity
2. 🔴 **Race condition** - Multiple simultaneous RSVPs can exceed capacity
3. 🟠 **No date validation** - Users can RSVP to past events
4. 🟠 **Confusing dual capacity fields** - Both `capacity` and `max_attendees` exist
5. 🟡 **Missing notifications** - Event approval/rejection not notified
6. 🟡 **Status confusion** - Both `status` and `approval_status` fields

---

## 🔴 CRITICAL ISSUE #1: Capacity Not Enforced

### Problem

**Location**: `server/src/routes/events.ts:137-169`

The RSVP endpoint checks capacity but **doesn't prevent** RSVPing if capacity is already reached:

```typescript
eventsRouter.post('/:id/rsvp', async (req: AuthedRequest, res) => {
  // ...
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, capacity: true },
  });
  // ❌ NO CHECK IF CAPACITY IS REACHED!

  if (desired && !current) {
    await prisma.eventRsvp.create({ data: { event_id: id, user_id: me.id } });
    // Capacity could be exceeded here!
  }

  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  return res.json({ going: desired, attending: desired, count, capacity: event.capacity ?? null });
});
```

### Real-World Impact

- **Event with capacity 50** can have 60+ RSVPs
- **Venue overbooking** - Real-world venues have fire code limits
- **User frustration** - Users RSVP but can't attend
- **Legal issues** - Fire code violations

### Fix Required

```typescript
if (desired && !current) {
  // Check current count BEFORE creating RSVP
  const currentCount = await prisma.eventRsvp.count({ where: { event_id: id } });
  const capacity = event.capacity ?? event.max_attendees;

  if (capacity && currentCount >= capacity) {
    return res.status(403).json({
      error: 'Event at capacity',
      message: 'This event is full. Please check back later for cancellations.',
      count: currentCount,
      capacity,
    });
  }

  await prisma.eventRsvp.create({ data: { event_id: id, user_id: me.id } });
}
```

---

## 🔴 CRITICAL ISSUE #2: Race Condition

### Problem

**Location**: `server/src/routes/events.ts:158-159`

Multiple users RSVPing simultaneously can all pass the capacity check and exceed capacity:

```
User A: Check count (49) → OK → Create RSVP (50)
User B: Check count (49) → OK → Create RSVP (50)  ← Both see 49!
User C: Check count (49) → OK → Create RSVP (50)
Result: 52 RSVPs for capacity 50
```

### Real-World Impact

- **Concurrent RSVPs** during popular events
- **Capacity exceeded** even with checks
- **Database inconsistency**

### Fix Required

Use **database transaction with row-level locking**:

```typescript
if (desired && !current) {
  // Use transaction to prevent race condition
  await prisma.$transaction(async tx => {
    // Lock the event row
    const event = await tx.event.findUnique({
      where: { id },
      select: { capacity: true, max_attendees: true },
    });

    if (!event) throw new Error('Event not found');

    const currentCount = await tx.eventRsvp.count({ where: { event_id: id } });
    const capacity = event.capacity ?? event.max_attendees;

    if (capacity && currentCount >= capacity) {
      throw new Error('Event at capacity');
    }

    await tx.eventRsvp.create({
      data: { event_id: id, user_id: me.id, user_email: me.email },
    });
  });
}
```

---

## 🟠 ISSUE #3: No Date Validation

### Problem

**Location**: `server/src/routes/events.ts:187-259`

1. **Event creation**: No validation that event date is in the future
2. **RSVP**: No check that event hasn't already happened

### Real-World Impact

- Users create events in the past (typos, timezone issues)
- Users RSVP to events that already happened
- Confusion and wasted notifications

### Fix Required

```typescript
// In event creation
const eventDate = new Date(data.date);
const now = new Date();

if (eventDate < now) {
  return res.status(400).json({
    error: 'Invalid date',
    message: 'Event date must be in the future.',
  });
}

// In RSVP endpoint
const event = await prisma.event.findUnique({
  where: { id },
  select: { id: true, capacity: true, date: true },
});

if (new Date(event.date) < new Date()) {
  return res.status(400).json({
    error: 'Event has passed',
    message: 'You cannot RSVP to events that have already occurred.',
  });
}
```

---

## 🟠 ISSUE #4: Confusing Dual Capacity Fields

### Problem

**Location**: `server/prisma/schema.prisma:196, 206`

Event model has **two capacity fields**:

- `capacity: Int?` (line 196)
- `max_attendees: Int?` (line 206)

**Current usage**:

- RSVP endpoint uses `capacity`
- Event creation accepts `max_attendees`
- No clear logic for which to use

### Real-World Impact

- **Confusion** - Which field is authoritative?
- **Inconsistency** - Different parts of code use different fields
- **Bugs** - Capacity checks might use wrong field

### Fix Required

**Option 1: Consolidate to one field**

```prisma
model Event {
  // Remove max_attendees, use only capacity
  capacity Int? // Maximum number of attendees
}
```

**Option 2: Use both with clear purpose**

```prisma
model Event {
  capacity Int?      // Venue capacity (hard limit)
  max_attendees Int? // Soft limit (can exceed for waitlist)
}
```

**Recommendation**: Use **Option 1** - simpler and clearer.

---

## 🟡 ISSUE #5: Missing Notifications

### Problem

**Location**: `server/src/routes/events.ts:327, 379`

TODO comments show notifications aren't sent:

```typescript
// TODO: Send notification to event creator
// await createNotification(updated.creator_id, 'EVENT_APPROVED', { event_id: eventId })
```

### Real-World Impact

- **Users don't know** their event was approved/rejected
- **Poor UX** - Users have to check manually
- **Missed opportunities** - Users don't promote approved events

### Fix Required

```typescript
// After approving event
await createNotification(updated.creator_id, {
  type: 'EVENT_APPROVED',
  title: 'Event Approved',
  body: `Your event "${updated.title}" has been approved!`,
  data: { event_id: eventId },
});

// After rejecting event
await createNotification(updated.creator_id, {
  type: 'EVENT_REJECTED',
  title: 'Event Not Approved',
  body: `Your event "${updated.title}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
  data: { event_id: eventId, reason },
});
```

---

## 🟡 ISSUE #6: Status Confusion

### Problem

**Location**: `server/prisma/schema.prisma:195, 202`

Event has **two status fields**:

- `status: String` - "draft", "approved", "rejected", "cancelled"
- `approval_status: String` - "pending", "approved", "rejected"

**Current usage**:

- Both are set during creation
- Both are updated during approval
- Unclear which is authoritative

### Real-World Impact

- **Confusion** - Which status should be checked?
- **Inconsistency** - Statuses can get out of sync
- **Bugs** - Code might check wrong status

### Fix Required

**Consolidate to one status field**:

```prisma
model Event {
  status String @default("pending") // pending, approved, rejected, cancelled, draft
  // Remove approval_status
}
```

Or use clear separation:

- `status` - Event lifecycle (draft, active, cancelled)
- `approval_status` - Moderation status (pending, approved, rejected)

---

## 🟡 ISSUE #7: No Cleanup of Old Events

### Problem

**Location**: No cleanup logic exists

Old events and RSVPs accumulate in database:

- Events from years ago
- RSVPs to past events
- No archival or cleanup

### Real-World Impact

- **Database bloat** - Unnecessary data storage
- **Performance** - Slower queries with old data
- **Cost** - More storage costs

### Fix Required

Add cleanup job:

```typescript
// Cron job to archive old events
async function cleanupOldEvents() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Archive events older than 1 year
  await prisma.event.updateMany({
    where: {
      date: { lt: oneYearAgo },
      status: { not: 'archived' },
    },
    data: { status: 'archived' },
  });
}
```

---

## 🟡 ISSUE #8: Frontend Capacity Display

### Problem

**Location**: `app/event-detail.tsx:241`

Frontend shows capacity but doesn't indicate if event is full:

```typescript
<Text style={styles.meta}>
  Attending: {attendeeCount}{typeof event.capacity === 'number' ? ` / ${event.capacity}` : ''}
</Text>
```

### Real-World Impact

- **No visual indicator** when event is full
- **Users try to RSVP** to full events
- **Poor UX**

### Fix Required

```typescript
const isFull = event.capacity && attendeesCount >= event.capacity;
const capacityText = typeof event.capacity === 'number'
  ? ` / ${event.capacity}${isFull ? ' (FULL)' : ''}`
  : '';

<Text style={[styles.meta, isFull && styles.fullText]}>
  Attending: {attendeeCount}{capacityText}
</Text>
```

---

## Summary of Required Fixes

### Critical (Must Fix)

1. ✅ **Enforce capacity** - Check before allowing RSVP
2. ✅ **Fix race condition** - Use database transactions
3. ✅ **Validate dates** - Prevent past events/RSVPs

### High Priority (Should Fix)

4. ✅ **Consolidate capacity fields** - Use one field
5. ✅ **Add notifications** - Notify on approval/rejection
6. ✅ **Clarify status fields** - Document or consolidate

### Medium Priority (Nice to Have)

7. ✅ **Add cleanup job** - Archive old events
8. ✅ **Improve frontend** - Show full status

---

## Testing Scenarios

After fixes, test these scenarios:

1. **Capacity enforcement**:
   - Create event with capacity 5
   - RSVP 5 users → Should succeed
   - 6th user tries to RSVP → Should fail with "Event at capacity"

2. **Race condition**:
   - Create event with capacity 10
   - Have 15 users RSVP simultaneously
   - Should only allow 10 RSVPs

3. **Date validation**:
   - Try to create event with past date → Should fail
   - Try to RSVP to past event → Should fail

4. **Notifications**:
   - Fan creates event → Should be pending
   - Admin approves → Creator should get notification
   - Admin rejects → Creator should get notification with reason

---

**Status**: 🔴 **REQUIRES IMMEDIATE FIXES**  
**Priority**: **CRITICAL** - These issues will cause real-world problems
