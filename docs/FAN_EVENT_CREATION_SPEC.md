# 📍 Discover + Fan Event Creation Flow

**Feature:** Community Events & Local League Visibility  
**Status:** Specification - Ready for Implementation  
**Priority:** High  

## 🎯 Overview

The Discover section serves as the community hub for all users — allowing fans, coaches, and organizers to view, create, and manage local sports content in one place.

**Key Features:**
- Fan-submitted events with approval workflow
- League-wide visibility and aggregation
- Three-tier Discover setup (Teams / Events / Approvals)

---

## 🧩 Three-Tier Discover Structure

| Tier | Description | User Access | Example UI |
|------|-------------|-------------|------------|
| **1. Team Hub** | Manage or create team pages | Coach / Organizer | "Create New Team" form with name, handle, org, description |
| **2. Create Event** | Submit games, watch parties, fundraisers, tryouts, etc. | All users (Fans included) | Event form (title, date/time, location, description, type) |
| **3. Approvals** | Moderate and review submitted events | Admin / Coach / League Rep | Pending events list with Approve/Reject buttons |

---

## 🧠 Functional Logic

### 1. Event Creation Permissions

**Fan Events (Require Approval):**
```typescript
if (user.role === 'fan') {
  event.status = 'pending_approval';
} else {
  event.status = 'approved';
}
```

**Auto-Approval:**
- Coaches/Organizers can create events instantly without review
- Approved events automatically publish to:
  - Related League Page
  - Discover feed
  - Local area map/highlights

### 2. Event Types

- 🏈 **Game / Match**
- 📺 **Watch Party**
- 🍔 **Fundraiser / BBQ**
- 🏃 **Tryout / Practice**
- ➕ **Other** (custom label)

**Event Schema:**
```json
{
  "title": "Varsity BBQ Fundraiser",
  "description": "Support SHS athletics with food and fun!",
  "date": "2025-10-27T12:30:00Z",
  "location": "Campus Pub, Stamford",
  "type": "fundraiser",
  "creatorRole": "fan",
  "approvalStatus": "pending",
  "linkedLeague": "Stamford High School",
  "maxAttendees": 100
}
```

### 3. League Page Integration

**League page now aggregates:**
- 🏈 All Teams
- 📅 All Events (official + fan-submitted)
- 📣 Highlights / Local News

**Filter Options:** Teams, Events, Posts

Fans can discover everything related to their local sports ecosystem in one place.

---

## ⚙️ Workflow

### Create Event Flow

1. User → Discover → Create Event
2. Fill form → Submit
3. **Fan event** → moves to "Approvals" queue
4. Moderator approves → published to League + Feed

### Approval Queue

**Moderators see:**
- Dashboard with filters: Pending, Approved, Rejected
- Bulk action buttons

**Notifications:**
- ✅ "Your event has been approved!"
- ❌ "Your event was rejected — please revise details."

---

## 💡 UX Guidelines

- ✅ Use clean vertical layout (consistent with current design)
- 📅 Display calendar preview at bottom showing upcoming local events
- 🗺️ Add "Open in Maps" links to event locations
- 👤 Show creator info (fan, coach, etc.) under event details
- 📤 Include easy RSVP / share buttons for community engagement

---

## 💰 Monetization / Upgrade Logic

### Free Users
- Can create up to **2 teams** and **3 pending events**

### Veteran / Legend Plans
- ✅ Unlimited team and event creation
- ⚡ Priority approval for events

**Upgrade Prompt Example:**
> "You've reached your limit of 3 pending events. Upgrade to Veteran to create unlimited community events."

---

## 🔒 Permissions Summary

| Role | Create Team | Create Event | Needs Approval | Manage Others | Moderate Events |
|------|-------------|--------------|----------------|---------------|-----------------|
| **Fan** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Coach/Organizer** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Admin/League Rep** | ✅ | ✅ | ❌ | ✅ | ✅ |

---

## ✅ Acceptance Criteria

- [ ] Fans can submit events, routed to the approval queue
- [ ] Approved events appear automatically on:
  - [ ] League pages
  - [ ] Local Discover tab
  - [ ] Search results by event name or location
- [ ] Coaches/Admins can manage approvals and edits
- [ ] Upgrade modal triggers on fan event or team creation limits

---

## 📋 Implementation Checklist

### Backend (Server)

- [ ] **Database Schema Updates:**
  - [ ] Add `events` table with approval workflow fields
  - [ ] Add `event_types` enum (game, watch_party, fundraiser, tryout, other)
  - [ ] Add `approval_status` enum (pending, approved, rejected)
  - [ ] Add creator tracking and linked league relationships

- [ ] **API Endpoints:**
  - [ ] `POST /api/events` - Create event (with auto-approval logic)
  - [ ] `GET /api/events` - List events (with filters: status, type, league)
  - [ ] `GET /api/events/:id` - Get event details
  - [ ] `PATCH /api/events/:id/approve` - Approve event (coach/admin only)
  - [ ] `PATCH /api/events/:id/reject` - Reject event (coach/admin only)
  - [ ] `GET /api/events/pending` - Get approval queue (moderators only)
  - [ ] Update `GET /api/leagues/:id` to include aggregated events

- [ ] **Permission Middleware:**
  - [ ] Check user role for auto-approval vs pending
  - [ ] Enforce 3-event limit for free fans
  - [ ] Validate moderator access for approval actions

- [ ] **Notifications:**
  - [ ] Send push notification on event approval
  - [ ] Send push notification on event rejection

### Frontend (Mobile App)

- [ ] **Discover Tab Redesign:**
  - [ ] Three-tier layout (Teams / Events / Approvals)
  - [ ] Filter tabs for Teams, Events, Posts
  - [ ] Calendar preview component at bottom

- [ ] **Create Event Screen:**
  - [ ] Event form with all fields (title, date, location, type, description)
  - [ ] Event type picker (Game, Watch Party, Fundraiser, Tryout, Other)
  - [ ] Location picker with Maps integration
  - [ ] Max attendees field
  - [ ] Link to league/team dropdown

- [ ] **Event Detail Screen:**
  - [ ] Display all event info
  - [ ] "Open in Maps" button
  - [ ] RSVP button
  - [ ] Share button
  - [ ] Show creator info and approval status

- [ ] **Approval Queue (Moderators):**
  - [ ] List pending events with filters
  - [ ] Approve/Reject buttons with confirmation
  - [ ] Event detail preview

- [ ] **League Page Updates:**
  - [ ] Display aggregated events
  - [ ] Filter between teams/events/posts

- [ ] **Upgrade Flow:**
  - [ ] Show limit warning when fan reaches 3 pending events
  - [ ] Upgrade modal with Veteran/Legend benefits
  - [ ] Link to subscription screen

### Testing

- [ ] Fan creates event → goes to pending
- [ ] Coach creates event → auto-approved
- [ ] Moderator approves fan event → appears on league page
- [ ] Free fan hits 3-event limit → upgrade modal shown
- [ ] Notifications sent on approval/rejection
- [ ] Events appear in search and discover feed
- [ ] Maps integration works correctly

---

## 🎯 Next Steps

1. Review and approve specification
2. Update Prisma schema with events table
3. Create migration for new tables
4. Implement backend API endpoints
5. Build frontend screens and components
6. Test approval workflow end-to-end
7. Deploy and beta test with real users

---

**Created:** November 3, 2025  
**Last Updated:** November 3, 2025
