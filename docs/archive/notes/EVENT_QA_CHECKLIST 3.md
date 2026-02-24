# Event & Organizer QA Checklist

_Purpose:_ Provide a repeatable overnight test plan for the Event/Coach/Organizer flows so we can capture blocking issues before App Store submission.

## 1. Setup
1. Ensure backend is running (`npm run dev`) and Expo web is at `http://localhost:8081`.
2. Seed at least two test teams + one organizer account (use `scripts/seed-games.js` if needed).
3. Confirm SendGrid verification emails are arriving for new users.

## 2. Organizer Sign-In
- [ ] Email/password login
- [ ] Google login (after adding localhost redirect URIs)
- [ ] Verify landing on `(tabs)` and no forced re-auth redirect

## 3. Create & Manage Events
1. Navigate to **Create Event**.
2. Fill required fields (title, date, location, capacity).
3. Attach banner image; confirm Cloudinary upload succeeds.
4. Save event and capture:
   - Event ID
   - Organizer ID
- [ ] Edit event (change time/description) and verify persistence.
- [ ] Cancel/delete event and confirm removal from feed.

## 4. Coach/Organizer Permissions
- [ ] Switch to a coach-level user.
- [ ] Verify coach can:
  - RSVP attendees
  - Approve/deny join requests
  - See organizer tools (if not, capture screenshot + console log)
- [ ] Attempt restricted actions (e.g., deleting another team’s event) and confirm proper error message.

## 5. Event Detail Page
- [ ] Load event detail (web + iOS simulator) and confirm:
  - Posts/Highlights section renders
  - RSVP list loads
  - Map placeholder shows on web
- [ ] Trigger each API from DevTools and note failures (`/events/:id`, `/games/:id/posts`, `/teams?mine=1`).

## 6. Notifications
- [ ] Fire `/test-notifications/new-event` (dev-only endpoint) and confirm push arrives on device.
- [ ] Interact with notification to ensure deep link opens the correct event.

## 7. Reporting
Capture the following artifacts:
- Console log export (`Save all as HAR` or copy errors)
- Network panel screenshot for any failing API
- Server log excerpt (`tail -200 server.log`)
- Summary of pass/fail with timestamps

Store results in `QA_EXECUTION_LOG.md` under “Event & Organizer Flow” section.
