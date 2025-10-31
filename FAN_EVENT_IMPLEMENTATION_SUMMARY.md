# Fan Event Creation & Approval System - Implementation Summary

## ✅ What's Complete

### Database Schema
- **Event Model Enhanced** with fan event approval fields:
  - `creator_id`, `creator_role` - Track who created the event
  - `approval_status` - 'pending', 'approved', 'rejected' (default: 'pending')
  - `event_type` - 'game', 'watch_party', 'fundraiser', 'tryout', 'bbq', 'other'
  - `description` - Full event description
  - `linked_league` - Optional school/league association
  - `max_attendees` - Optional capacity limit
  - `contact_info` - Optional RSVP contact
  - `approved_by`, `approved_at` - Audit trail
  - `rejected_reason` - Feedback for rejected events
- **User.createdEvents** relation added

### Backend API (server/src/routes/events.ts)
All routes fully implemented:

#### POST /events (Create Event)
```typescript
{
  title: string,
  description?: string,
  event_type: 'game' | 'watch_party' | 'fundraiser' | 'tryout' | 'bbq' | 'other',
  location: string,
  date: string (ISO),
  linked_league?: string,
  max_attendees?: number,
  contact_info?: string
}
```
**Features:**
- Auto-approval for coaches/organizers (sets `approval_status: 'approved'`)
- Pending approval for fans (sets `approval_status: 'pending'`)
- Event limit enforcement: Rookie fans max 3 pending events
- Returns `EVENT_LIMIT_EXCEEDED` error code with limit details

#### GET /events (Public Event List)
- Default filter: `approval_status=approved` (only show published events)
- Optional filters: `event_type`, `approval_status`
- Returns creator info when `includeCreator` option used

#### GET /events/pending (Moderator Queue)
- **Permission:** Coach, Organizer, or Admin only
- Returns all pending events with full creator details
- Returns `PERMISSION_DENIED` error for unauthorized users

#### PUT /events/:id/approve (Approve Event)
- **Permission:** Coach, Organizer, or Admin only
- Updates: `approval_status='approved'`, `status='approved'`
- Records `approved_by` (user ID) and `approved_at` (timestamp)
- TODO: Send notification to creator

#### PUT /events/:id/reject (Reject Event)
```typescript
{ reason: string }
```
- **Permission:** Coach, Organizer, or Admin only
- Updates: `approval_status='rejected'`, `status='rejected'`
- Stores rejection reason for creator feedback
- TODO: Send notification to creator

### Frontend - Event Creation Screen (app/create-fan-event.tsx)
**Full-featured event creation form:**

#### Form Fields
- Event Type selector (6 types with icons):
  - 🏈 Game/Match
  - 📺 Watch Party
  - 💰 Fundraiser
  - 🏃 Tryout/Practice
  - 🍔 BBQ/Social
  - 📌 Other
- Title (required)
- Description (optional, multiline)
- Date picker (required, min: today)
- Time picker (required)
- Location (required)
- League/School (optional)
- Max Attendees (optional, numeric)
- Contact Info (optional)

#### Features
- Full validation with error messages
- Date/time pickers (iOS/Android compatible)
- Loading states during submission
- Success messages differentiated by role:
  - Fans: "Submitted for approval"
  - Coaches: "Published successfully"
- Error handling:
  - `EVENT_LIMIT_EXCEEDED` → Upgrade prompt
  - Generic errors → Retry messaging
- Info box explaining approval process
- Auto-navigation back on success

#### UI/UX
- Grid layout for event types (2 columns)
- Icon-based type selection
- Real-time validation
- Disabled state while submitting
- Safe area insets for iOS
- Dark mode support

### Frontend - Event Approvals Dashboard (app/event-approvals.tsx)
**Moderator interface for reviewing pending events:**

#### Features
- Pull-to-refresh event list
- Permission check on load (coach/admin only)
- Empty state ("All Caught Up!")
- Per-event approve/reject actions

#### Event Card Display
- Event type badge (with emoji)
- Title and description (truncated)
- Date and time
- Location
- League/school (if linked)
- Max attendees (if set)
- Creator name with icon
- Approve/Reject buttons

#### Approve Action
- Single-tap approval
- Instant feedback
- Removes from pending list
- Shows success alert

#### Reject Action
- Prompts for rejection reason (required)
- Validates reason input
- Sends feedback to creator
- Removes from pending list
- Shows success alert

#### UI/UX
- Card-based layout
- Loading states (shimmer during process)
- Disabled buttons during operations
- Color-coded actions:
  - Green checkmark for approve
  - Red X for reject
- Dark mode support
- Safe area insets

### Integration Points
- **Create Menu:** "Create Fan Event" already added to `app/create.tsx`
- **Email Verification:** Enforced before event creation
- **API Integration:** Using existing `httpPost`, `httpPut`, `httpGet` wrappers
- **Theme System:** Full Colors support for light/dark modes

---

## ⚠️ CRITICAL NEXT STEP

### Database Migration Required
The schema changes are defined but **NOT YET APPLIED** to the database.

**Run this immediately:**
```bash
cd server
npx prisma migrate dev --name add_event_approvals
npx prisma generate
npm run dev  # Restart server
```

**What this does:**
1. Creates migration SQL from schema changes
2. Applies migration to database (adds columns, indexes, relations)
3. Regenerates Prisma client with new types
4. Fixes TypeScript compilation errors in backend

**Without this step:**
- Backend will throw errors accessing new Event fields
- Event creation will fail
- Approval routes won't work

---

## 🔧 What's Remaining

### 1. Navigation to Approvals Dashboard
**Where:** Needs to be added to navigation for coaches/admins

**Options:**
- Add to coach/admin settings menu
- Add badge to profile tab (pending count)
- Add to create menu for coaches
- Add dedicated tab for coaches (conditional)

**Implementation:**
```tsx
// Example: Add to create.tsx for coaches
{me?.preferences?.role === 'coach' && (
  <Pressable style={styles.item} onPress={() => router.push('/event-approvals')}>
    <Text style={styles.itemText}>Event Approvals</Text>
  </Pressable>
)}
```

### 2. League Page (Optional)
**File:** `app/league/[id].tsx`

**Purpose:** Central hub for league-specific content

**Features:**
- Three tabs: Teams, Events, Highlights
- Teams tab: All teams in this league
- Events tab: Approved events linked to this league
- Highlights: Posts tagged with this league
- Geolocation: Auto-show nearby leagues

**Complexity:** Medium (3-4 hours)

### 3. Notification System Integration
**What:** Notify creators when events are approved/rejected

**Current State:** TODO comments in approve/reject endpoints

**Implementation:**
```typescript
// In approve endpoint (events.ts line ~240)
await createNotification({
  user_id: event.creator_id,
  type: 'event_approved',
  title: 'Event Approved!',
  message: `Your event "${event.title}" has been published.`,
  data: { event_id: event.id },
});

// In reject endpoint (events.ts line ~275)
await createNotification({
  user_id: event.creator_id,
  type: 'event_rejected',
  title: 'Event Needs Revision',
  message: `Your event "${event.title}" was rejected: ${reason}`,
  data: { event_id: event.id },
});
```

**Dependencies:** Check if notification system exists (`/notifications` routes)

**Complexity:** Low (1 hour if system exists)

### 4. Event Detail View
**File:** `app/event-detail.tsx` (might already exist)

**Enhancements Needed:**
- Show `approval_status` badge for creators
- Show rejection reason if rejected
- Edit button for rejected events
- "Resubmit for Approval" action

### 5. My Events Screen
**File:** New - `app/my-events.tsx`

**Purpose:** Let users see their submitted events with status

**Features:**
- List user's created events
- Filter by approval status (pending, approved, rejected)
- Status badges (🟡 Pending, ✅ Approved, ❌ Rejected)
- Tap to view/edit
- Delete draft events

**Complexity:** Low-Medium (2-3 hours)

---

## 🧪 Testing Checklist

### As a Fan (Rookie Plan)
- [ ] Create 1st event → Status should be "pending"
- [ ] Create 2nd event → Status should be "pending"
- [ ] Create 3rd event → Status should be "pending"
- [ ] Try to create 4th event → Should show limit error with upgrade prompt
- [ ] Verify all 3 pending events show in coach's approval queue
- [ ] After coach approves one → Try creating 4th event → Should succeed (only 2 pending now)

### As a Coach/Organizer
- [ ] Create event → Should be auto-approved (status: 'approved')
- [ ] Event should appear in public feed immediately
- [ ] Access `/event-approvals` → Should see all pending fan events
- [ ] Approve an event → Event should disappear from pending list
- [ ] Check public feed → Approved event should now appear
- [ ] Reject an event with reason → Event should disappear from pending
- [ ] (Future) Creator should receive rejection notification

### As a Fan (After Event Rejected)
- [ ] (Future) Receive notification with rejection reason
- [ ] (Future) View rejected event in "My Events"
- [ ] (Future) Edit and resubmit rejected event

### Permission Checks
- [ ] Non-coaches accessing `/events/pending` → Should get PERMISSION_DENIED error
- [ ] Non-coaches trying to approve/reject → Should get PERMISSION_DENIED error

### Edge Cases
- [ ] Create event with past date → Should show validation error
- [ ] Create event without title → Should show validation error
- [ ] Create event without location → Should show validation error
- [ ] Extremely long description → Should handle gracefully (truncate in UI)
- [ ] Special characters in title/description → Should save/display correctly

---

## 📊 Database Indexes

**Performance optimization already included:**

```prisma
@@index([creator_id])      // Fast lookup: "my events"
@@index([approval_status])  // Fast lookup: pending queue
@@index([event_type])       // Fast lookup: filter by type
```

These indexes ensure:
- Creator's event list loads quickly
- Pending approval queue is fast (even with hundreds of events)
- Filtering by event type is efficient

---

## 🎨 UI Screenshots Reference

Refer to `todo.md` screenshots for:
- Three-tier Discover layout (Team Hub, Create Event, Approvals)
- Event creation form design
- League page mockups

---

## 🚀 Deployment Notes

### Database Migration (Production)
```bash
# Review migration SQL before applying
npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel schema.prisma

# Apply migration
npx prisma migrate deploy

# Regenerate client
npx prisma generate
```

### Backend Environment
No new environment variables needed. Uses existing:
- Authentication middleware
- User role system
- Notification system (if adding notifications)

### Frontend Build
No config changes needed. Standard Expo build process:
```bash
eas build --platform ios
eas build --platform android
```

---

## 💡 Future Enhancements

### Event Discovery
- Map view of nearby events
- Calendar view integration
- Event search and filters
- "Interested" / "Going" RSVP status

### Advanced Moderation
- Bulk approve/reject
- Moderator notes/comments
- Auto-approval based on creator reputation
- Spam detection (flag suspicious events)

### Analytics
- Track approval rates by moderator
- Event type popularity metrics
- Average approval time
- Creator success rates

### Social Features
- Event comments/discussion
- Share events to feed
- Invite friends to events
- Event photo galleries post-event

---

## 📝 Code Quality Notes

### Type Safety
- All API routes use Zod validation
- TypeScript interfaces for Event types
- Proper error handling with typed error codes

### Error Handling
- User-friendly error messages
- Specific error codes for different scenarios
- Graceful degradation for network issues

### Performance
- Database indexes on high-query fields
- Pagination ready (can add `page`/`limit` params)
- Optimistic UI updates (approve/reject removes from list immediately)

### Accessibility
- Semantic labels on all form fields
- Error messages associated with inputs
- Pressable areas have minimum touch target sizes
- Color contrast meets WCAG standards

---

## 🎯 Success Metrics

**Feature Adoption:**
- % of fans creating events (target: 20% within first month)
- Events submitted per week
- Approval rate (target: >80%)

**Engagement:**
- Event RSVPs per event
- Event share rate
- Repeat event creators

**Moderation:**
- Average approval time (target: <24 hours)
- Rejection rate by event type
- Moderator activity levels

---

## 🛠️ Quick Start Commands

**Start Development:**
```bash
# Terminal 1: Backend
cd server
npx prisma migrate dev --name add_event_approvals
npx prisma generate
npm run dev

# Terminal 2: Mobile app
npm start
```

**Test Event Workflow:**
1. Log in as fan user
2. Tap "+" tab → "Create Fan Event"
3. Fill form and submit
4. Log in as coach user
5. Navigate to Event Approvals
6. Approve or reject the event

---

## 📞 Support

**Common Issues:**

**"Field does not exist" error:**
- Run `npx prisma generate` in server directory

**"PERMISSION_DENIED" when accessing approvals:**
- User role must be 'coach', 'organizer', or 'admin'
- Check `user.preferences.role` in database

**Events not appearing after approval:**
- Check `approval_status` field is set to 'approved'
- Check GET /events is filtering correctly

**Date picker not showing (Android):**
- Ensure `@react-native-community/datetimepicker` is installed
- Check for platform-specific issues

---

**Implementation completed by:** GitHub Copilot  
**Date:** 2024  
**Status:** ✅ Ready for testing after database migration
