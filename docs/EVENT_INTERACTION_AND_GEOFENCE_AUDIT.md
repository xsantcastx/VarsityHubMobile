# Event Interaction & Geofence Posting Audit

**Date:** February 23, 2026  
**Scope:** Event discovery, RSVP, share, confirmation email; geofence posting flow

---

## Part 1: Event Interaction Flow

### 1. Can a fan find an event on the map?

**✅ Yes**

- **Game map** (`game-map.tsx`): Fetches games (`Game.list`) and events (`GET /events`), displays markers with coordinates
- **EventMap component:** Renders markers for games (red) and events (teal); tap opens callout with title, location, date
- **Navigation:** Tap game → `/(tabs)/feed/game/[id]`; tap event → `/event-detail?id=...`
- **Feed:** Main feed also shows upcoming games with RSVP badges; "View Nearby Games on Map" button opens game-map

### 2. View the event page?

**✅ Yes**

- **Event detail** (`event-detail.tsx`): Full event info, RSVP, share
- **Game detail** (`GameDetailsScreen.tsx`): Game page with associated event; RSVP uses `event_id` from game summary
- **Public event** (`public-event.tsx`): Event posts/highlights for sample or real events

### 3. Can they RSVP?

**✅ Yes**

- **API:** `POST /events/:id/rsvp` with `{ going: true|false }` or `{ attending: true|false }`
- **Places:** Feed (RSVPBadge), event-detail, GameDetailsScreen
- **Restrictions:** Past events return 400 "Event has passed"; capacity enforced (403 if full)
- **Auth:** Requires sign-in; event-detail prompts "Sign In Required" if not authenticated

### 4. Does the attendee count update?

**✅ Yes**

- **Server:** Returns `{ going, count, capacity }` after RSVP
- **Client:** `setRsvpCount(response.count)` (feed), `setAttendeesCount(res.count)` (event-detail), `rsvpCount` in GameDetailsScreen
- **Real-time:** No push; count updates when user RSVPs. Other viewers see updated count on next load/refresh.

### 5. Can they share the event?

**✅ Yes**

- **event-detail:** `useShareLink({ kind: 'event', id, title, contextLines })` with Share button
- **GameDetailsScreen:** Share via `useShareLink` for game/event
- **Feed:** RSVP badge does not share; share is on event/game detail pages

### 6. Do they receive a confirmation email after RSVP?

**✅ Yes** (fixed)

- **`sendEventRsvpConfirmedEmail`** exists in `server/src/lib/email.ts` and is wired to `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`
- **Now invoked:** `POST /events/:id/rsvp` in `events.ts` calls `sendEventRsvpConfirmedEmail` after successful RSVP create
- **Payload:** Event title, date, time, location, user name, event link; sent to user's email (best-effort, non-blocking)

---

## Part 2: Geofence Posting Flow

### Radius: 3 km (not 2 km)

The code uses **3 km** for regular posts. The user asked about 2 km; the implementation is 3 km.

- **`geofencing.ts`:** `isWithinGeofence(..., 3.0)` for posts
- **Stories:** 1 km (24-hour window)
- **Posts:** 3 km (4-day window: 2 days before to 1 day after game)

### When within 3 km — can they post?

**✅ Yes**

- **Server:** `verifyEventPostingPermission()` returns `{ allowed: true, distance }` when user is within 3 km
- **Bypass:** Admins and team members (home/away) skip geofencing
- **Sample events:** IDs starting with `sample-` bypass geofencing
- **Time window:** Must be within posting window (2 days before to 1 day after game)

### When outside 3 km — are they blocked with a clear message?

**✅ Yes**

- **Server response:** `403` with:
  - `error: 'TOO_FAR_FROM_VENUE'`
  - `message: 'You must be within 3 km of the venue to post.'`
  - `distance: <number>` (km)
- **Create-post handling:** `create-post.tsx` lines 639–640:
  ```ts
  } else if (code === 'TOO_FAR_FROM_VENUE') {
    setError(`You're too far from the venue. ${e?.data?.message || ''}`.trim());
  }
  ```
- **Result:** User sees: "You're too far from the venue. You must be within 3 km of the venue to post."

### Other geofence error codes

| Code                    | Message                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `LOCATION_REQUIRED`     | "Location access required. You must be at the game venue to post." |
| `POSTING_WINDOW_CLOSED` | "Posting opens [date] and closes [date]."                          |
| `EVENT_NOT_FOUND`       | "Event not found"                                                  |

### Location source for geofence

- **Create-post:** Uses `useDeviceLocation()` — `location.latitude`, `location.longitude` from device GPS
- **Payload:** Post includes `location: { lat, lng, ... }` from request body or user preferences (zip geocoding)
- **Server:** Reads `req.body.location.lat`, `req.body.location.lng` or falls back to `preferences.zip_code` geocoding

---

## Summary

| Question                   | Answer                                 |
| -------------------------- | -------------------------------------- |
| Find event on map?         | ✅ Yes                                 |
| View event page?           | ✅ Yes                                 |
| RSVP?                      | ✅ Yes                                 |
| Attendee count updates?    | ✅ Yes (on RSVP; no real-time push)    |
| Share event?               | ✅ Yes                                 |
| RSVP confirmation email?   | ❌ No (function exists but not called) |
| Post when within geofence? | ✅ Yes (3 km)                          |
| Blocked when outside?      | ✅ Yes, with clear message             |
| Geofence radius            | 3 km (not 2 km)                        |

---

## Recommendations

1. ~~**RSVP confirmation email:**~~ **Done.** `sendEventRsvpConfirmedEmail` is now called in `events.ts` after successful RSVP.
2. **2 km vs 3 km:** If product requires 2 km, change `geofencing.ts` line 253 from `3.0` to `2.0` and update the reason string.
3. **Location accuracy:** Create-post uses device location; ensure location permission and accuracy are sufficient for real-device testing (e.g. "Precise" on Android).
