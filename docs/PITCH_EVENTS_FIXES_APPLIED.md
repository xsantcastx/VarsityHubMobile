# Pitch Events (Fan Event Creation) - Fixes Applied

**Date**: December 2024  
**Status**: ✅ **CRITICAL FIXES APPLIED**

---

## Summary

Fixed **critical real-world issues** in the pitch events (fan event creation) system that would have caused problems in production.

---

## ✅ FIXES APPLIED

### 1. ✅ Approval/Rejection Idempotency (CRITICAL)

**Problem**:

- Could approve already-approved events
- Could reject already-rejected events
- No validation of current state

**Real-World Impact**:

- **State confusion** - Events could be approved multiple times
- **No idempotency** - Same action could be repeated
- **Poor UX** - Confusing error messages

**Fix Applied**:

- Added validation to check current `approval_status` before updating
- Returns clear error messages for invalid states
- Prevents duplicate approvals/rejections

**Location**: `server/src/routes/events.ts:367-420`

**Code**:

```typescript
// Validate event is in pending state
if (event.approval_status === 'approved') {
  return res.status(400).json({
    error: 'Event already approved',
    message: 'This event has already been approved.',
  });
}

if (event.approval_status === 'rejected') {
  return res.status(400).json({
    error: 'Event already rejected',
    message: 'Cannot approve/reject an already processed event.',
  });
}

if (event.approval_status !== 'pending') {
  return res.status(400).json({
    error: 'Invalid state',
    message: 'Can only approve/reject pending events.',
  });
}
```

---

### 2. ✅ Fans Can View Their Own Events (HIGH PRIORITY)

**Problem**:

- No endpoint for fans to see their submitted events
- No way to track event status
- Fans don't know if events are pending, approved, or rejected

**Real-World Impact**:

- **User frustration** - Fans submit events and never hear back
- **No transparency** - Can't see status of submissions
- **Duplicate submissions** - Fans recreate events thinking they failed

**Fix Applied**:

- Added `GET /events/my-events` endpoint
- Returns all events created by the user
- Includes approval status, rejection reason, and dates

**Location**: `server/src/routes/events.ts:108-130`

**Code**:

```typescript
// List current user's created events (for fans to track their submissions)
eventsRouter.get('/my-events', requireAuth as any, async (req: AuthedRequest, res) => {
  const events = await prisma.event.findMany({
    where: { creator_id: req.user!.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      event_type: true,
      approval_status: true,
      status: true,
      rejected_reason: true,
      created_at: true,
      approved_at: true,
      description: true,
    },
  });
  return res.json(events);
});
```

---

### 3. ✅ Fans Can Edit Pending Events (HIGH PRIORITY)

**Problem**:

- Fans couldn't edit events after submission
- Must delete and recreate if they made a mistake
- Loses place in approval queue

**Real-World Impact**:

- **User frustration** - Typo in event means starting over
- **Wasted time** - Re-submission delays approval
- **Poor UX** - No way to fix mistakes

**Fix Applied**:

- Added `PATCH /events/:id` endpoint
- Only creator can edit
- Only pending events can be edited
- Validates date is in future if updating date

**Location**: `server/src/routes/events.ts:487-570`

**Code**:

```typescript
eventsRouter.patch('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });

  // Only creator can edit
  if (event.creator_id !== req.user!.id) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'Only the event creator can edit this event.',
    });
  }

  // Only pending events can be edited
  if (event.approval_status !== 'pending') {
    return res.status(400).json({
      error: 'Cannot edit event',
      message: 'Only pending events can be edited.',
    });
  }

  // Update event...
});
```

---

### 4. ✅ Enhanced Event Creation Response (MEDIUM)

**Problem**:

- Response didn't include pending count
- Fans didn't know how many events they had pending
- Unclear limit status

**Real-World Impact**:

- **Confusion** - Fans don't know their limit status
- **Poor UX** - No feedback on remaining capacity

**Fix Applied**:

- Added `pending_count` and `limit` to creation response
- Helps fans understand their limit status

**Location**: `server/src/routes/events.ts:327-340`

**Code**:

```typescript
const pendingCount =
  userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free')
    ? await prisma.event.count({
        where: {
          creator_id: user.id,
          approval_status: 'pending',
        },
      })
    : null;

return res.status(201).json({
  ...serializeEvent(event),
  message: autoApprove
    ? 'Event created and published successfully!'
    : 'Your event has been submitted for approval.',
  pending_count: pendingCount,
  limit:
    userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free') ? 3 : null,
});
```

---

## 📋 Remaining Recommendations

### High Priority (Should Implement)

1. **Team/League Association**
   - Add `team_id` and `organization_id` to Event model
   - Link events to specific teams
   - Filter events by team

2. **Resubmission Flow**
   - Allow fans to edit and resubmit rejected events
   - Or add "Request Changes" workflow

3. **Event Expiration**
   - Auto-reject events with past dates
   - Clean up old pending events

### Medium Priority (Nice to Have)

4. **Bulk Actions**
   - Bulk approve/reject for moderators
   - Faster approval workflow

5. **Better Approval UI**
   - Show full event details in approval queue
   - Preview how event will look

6. **Event History**
   - Track approval/rejection history
   - Show who approved/rejected and when

---

## Testing Scenarios

### Test 1: Fan Views Own Events

```bash
# Fan creates event
POST /events { ... }
# Fan views their events
GET /events/my-events
# Should return: List of fan's events with approval_status
```

### Test 2: Fan Edits Pending Event

```bash
# Fan creates event (pending)
POST /events { title: "Original Title", ... }
# Fan edits event
PATCH /events/{id} { title: "Updated Title" }
# Should succeed and update event
```

### Test 3: Fan Tries to Edit Approved Event

```bash
# Fan creates event → Gets approved
# Fan tries to edit
PATCH /events/{id} { title: "New Title" }
# Should fail: 400 "Only pending events can be edited"
```

### Test 4: Coach Approves Already-Approved Event

```bash
# Coach approves event
PUT /events/{id}/approve {}
# Coach tries to approve again
PUT /events/{id}/approve {}
# Should fail: 400 "Event already approved"
```

### Test 5: Event Creation Response

```bash
# Fan creates event
POST /events { ... }
# Response should include:
# { approval_status: 'pending', pending_count: 1, limit: 3, ... }
```

---

## Files Modified

1. `server/src/routes/events.ts` - All fixes applied
2. `docs/PITCH_EVENTS_AUDIT.md` - Audit report
3. `docs/PITCH_EVENTS_FIXES_APPLIED.md` - This file

---

## Verification

- ✅ All linter checks pass
- ✅ TypeScript compilation succeeds
- ✅ No breaking changes to API contracts
- ✅ Backward compatible

---

**Status**: ✅ **CRITICAL FIXES COMPLETE**  
**Next Steps**: Implement remaining recommendations (team association, resubmission flow, etc.)
