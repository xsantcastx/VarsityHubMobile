# Coach Event Management Audit

**Date:** February 23, 2026  
**Scope:** Event editing, cancellation, approval flow, follower notifications, map visibility

---

## 1. Event Editing Permissions

### Can coaches edit time, location, and opponent after creation?

| Field | Editable? | Notes |
|-------|-----------|-------|
| **Title** | ⚠️ Only if pending | `updateEventSchema` includes title |
| **Date** | ⚠️ Only if pending | Must be in future |
| **Location** | ⚠️ Only if pending | latitude, longitude supported |
| **Description** | ⚠️ Only if pending | |
| **Event type** | ⚠️ Only if pending | game, watch_party, fundraiser, etc. |
| **Opponent** | ❌ No | Opponent lives on **Game**, not Event. Event has `game_id`; PATCH does not accept `game_id`. |

### Critical gap: Coaches cannot edit approved events

**Backend:** `server/src/routes/events.ts` PATCH `/:id` (lines 646–651)

```typescript
// Only pending events can be edited
if (event.approval_status !== 'pending') {
  return res.status(400).json({ 
    error: 'Cannot edit event',
    message: 'Only pending events can be edited. Once approved or rejected, events cannot be modified.',
  });
}
```

**Flow:** Coaches get **auto-approval** on creation (`approval_status: 'approved'` immediately). So coach-created events are never `pending` → **coaches cannot edit their events after creation**.

**Verdict:** ❌ **Broken.** Coach events are auto-approved, so they can never be edited.

### Do followers get notified when an event is edited?

**No.** PATCH `/:id` updates the event and returns success. It does **not**:
- Queue `events.updated` email jobs
- Send push notifications to RSVPed users
- Notify team followers

`sendEventUpdatedEmail` and the `events.updated` email worker exist but are **never called** from the events routes.

### Does the event update on the map immediately?

**Yes.** GET `/events` reads from the database. After PATCH, the next fetch returns the updated event. The map uses this API, so it will show updates on refresh. No real-time push; clients must refetch.

---

## 2. Event Cancellation

### Can coaches cancel an event?

**No.** There is no PATCH to set `status: 'cancelled'` and no DELETE endpoint for events. The schema supports `status: 'cancelled'`, but no route implements cancellation.

### Do RSVPed users get notified when an event is cancelled?

**N/A.** Cancellation is not implemented, so no notification flow exists. `sendEventCanceledEmail` and the `events.canceled` worker exist but are never triggered.

### Does a cancelled event disappear from the map?

**Partially.** GET `/events` does **not** filter out `status: 'cancelled'`. It filters by `approval_status: 'approved'` only. So if cancellation were implemented, cancelled events would still appear on the map unless the API is updated to exclude them.

### Does it stay visible on the event page with a cancelled status?

**N/A.** Cancellation is not implemented. If it were, GET `/:id` returns the full event including `status`, so the detail page could show a "Cancelled" badge. The API does not currently exclude cancelled events from the single-event fetch.

---

## 3. Event Approval Flow

### When a coach submits an event, does it go through admin approval?

**No.** Coaches (and organizers) get **auto-approval**:

```typescript
// server/src/routes/events.ts lines 358-383
const autoApprove = userRole === 'coach' || userRole === 'organizer';
// ...
approval_status: autoApprove ? 'approved' : 'pending',
status: autoApprove ? 'approved' : 'draft',
approved_at: autoApprove ? new Date() : null,
```

**Fans** creating community events get `approval_status: 'pending'` and must wait for admin approval.

### How long does approval take?

**For coaches:** Instant (auto-approved).  
**For fans:** Manual. An admin or coach must call:
- GET `/events/pending` to list pending events
- POST `/events/:id/approve` or POST `/events/:id/reject`

No SLA or automation; it depends on when an admin reviews.

### What happens to the event while it's pending?

| Visibility | Behavior |
|------------|----------|
| **Default GET /events** | Hidden. Default filter is `approval_status: 'approved'`. Pending events are excluded. |
| **GET /events?approval_status=pending** | Visible only with explicit filter. |
| **GET /events/:id** | Visible. Single-event fetch does not filter by approval_status. |
| **Map** | Hidden. Map uses GET /events (default), so pending events do not appear. |
| **Creator's "My Events"** | Visible. GET `/events/my-events` returns all events for the creator, including pending. |

**Verdict:** Pending events are hidden from public lists and the map but can be accessed by direct ID. Creators see them in "My Events."

---

## 4. Summary of Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| Coach cannot edit approved events | 🔴 Critical | Coaches are auto-approved, so they can never edit. Need to allow editing of approved events by creator. |
| No follower/RSVP notifications on edit | 🟡 Medium | Add `events.updated` job + push to RSVPed users when event is updated. |
| No event cancellation | 🔴 Critical | Add PATCH to set `status: 'cancelled'`, notify RSVPed users, exclude from map. |
| Cancelled events would still show on map | 🟡 Medium | GET /events should exclude `status: 'cancelled'` when not explicitly requested. |
| Opponent not editable via event | 🟢 Low | Opponent is on Game; would need game update or separate flow. |

---

## 5. Recommendations

1. **Allow coaches to edit approved events**  
   - Relax PATCH `/:id` to allow creator to edit when `approval_status === 'approved'`.  
   - Keep the "pending only" rule for fan-created events if desired.

2. **Notify on event update**  
   - After PATCH, queue `events.updated` jobs for RSVPed users.  
   - Optionally send push notifications.

3. **Implement event cancellation**  
   - Add PATCH `/:id` support for `status: 'cancelled'` (creator only).  
   - Queue `events.canceled` for RSVPed users.  
   - Cancel scheduled game reminders for the event.

4. **Exclude cancelled events from map/list**  
   - In GET `/events`, add `status: { not: 'cancelled' }` (or equivalent) unless `status=cancelled` is explicitly requested.
