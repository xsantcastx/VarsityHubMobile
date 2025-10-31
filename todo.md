🧠 Main Understanding

Your client is emphasizing that fans should be able to create (“pitch”) events — not just teams or coaches.
This gives fans, schools, and communities a way to share local sports activity (e.g., watch parties, fundraisers, or BBQs) inside the app, all under the same league or local hub.

🔍 Detailed Breakdown
1. “Fans pitching events is also important”

Fans should be allowed to submit events like:

🏈 Watch parties

🍔 Fundraisers / BBQs

🏟️ Local league games

These fan-submitted events go into an Approval Queue for review by moderators, coaches, or admins.

After approval, the event appears on:

The League Page

The Discover tab

Nearby users’ feeds (based on location)

✅ Implementation summary:

Add a “Create Event” button accessible for Fans (with limited scope).

Require event title, date/time, description, and location.

Route submission to the Approval Queue for verification.

2. “For them to have a league page where they see all their local sports”

The League Page becomes a central hub:

Displays all teams (men’s/women’s) and local events.

Merges official and fan-submitted content.

Fans can view upcoming games, fundraisers, and local sports activity in one place.

✅ Design implication:

League Page Tabs:

🏆 Teams

📅 Events

📰 Highlights / News

Use “Local League” metadata or geolocation to show nearby leagues automatically.

3. “This three-tier setup is fire”

Your client’s referring to the 3-level structure visible in the Discover UI:

Team Hub → Team creation and management.

Create Event → Fan or team-created events.

Approvals → Moderation for pending events.

✅ Core workflow:

Discover
 ├── Team Hub       (Teams management)
 ├── Create Event   (Submit local events)
 └── Approvals      (Moderation dashboard)


This is the foundation of a scalable community ecosystem.

4. “Keep in mind people will schedule fundraisers/bbqs through the app”

Events should not be restricted to sports competitions — community gatherings matter.

Suggested additional fields:

Event Type: Game, Fundraiser, Watch Party, Tryout, BBQ, etc.

Contact Info or RSVP link

Optional “Donate” button for charity/fundraiser events (integrated with Stripe later)

✅ Future enhancement:

Allow organizers to collect payments or donations directly via Stripe once verified.

✅ Summary

Discover Section – New Community Flow

Tab	Purpose	User Roles	Key Actions
Team Hub	Manage or create teams	Coach, Organizer	Create/edit team pages
Create Event	Submit local games, watch parties, or fundraisers	Fans, Coaches	Fill form → Send for approval
Approvals	Moderate fan-submitted events	Admins, Coaches	Approve/reject before publishing
💡 Technical & UX Recommendations

Event Creation Permissions:

role === fan → can create events → status = pending_approval

role === coach/organizer → events publish immediately

Backend:

Event object includes:

{
  "creatorRole": "fan",
  "approvalStatus": "pending",
  "eventType": "fundraiser",
  "linkedLeague": "Stamford High School League"
}


UI Feedback:

“Your event has been submitted for approval.”

“Approved events will appear in your local league section.”

⚙️ In short

This feature makes VarsityHub:

More social: Fans contribute to the ecosystem.

More local: Everyone sees nearby sports and community activity.

More complete: Three-tier Discover system ties the community together.🧠 Main Understanding

Your client is emphasizing that fans should be able to create (“pitch”) events — not just teams or coaches.
This gives fans, schools, and communities a way to share local sports activity (e.g., watch parties, fundraisers, or BBQs) inside the app, all under the same league or local hub.

🔍 Detailed Breakdown
1. “Fans pitching events is also important”

Fans should be allowed to submit events like:

🏈 Watch parties

🍔 Fundraisers / BBQs

🏟️ Local league games

These fan-submitted events go into an Approval Queue for review by moderators, coaches, or admins.

After approval, the event appears on:

The League Page

The Discover tab

Nearby users’ feeds (based on location)

✅ Implementation summary:

Add a “Create Event” button accessible for Fans (with limited scope).

Require event title, date/time, description, and location.

Route submission to the Approval Queue for verification.

2. “For them to have a league page where they see all their local sports”

The League Page becomes a central hub:

Displays all teams (men’s/women’s) and local events.

Merges official and fan-submitted content.

Fans can view upcoming games, fundraisers, and local sports activity in one place.

✅ Design implication:

League Page Tabs:

🏆 Teams

📅 Events

📰 Highlights / News

Use “Local League” metadata or geolocation to show nearby leagues automatically.

3. “This three-tier setup is fire”

Your client’s referring to the 3-level structure visible in the Discover UI:

Team Hub → Team creation and management.

Create Event → Fan or team-created events.

Approvals → Moderation for pending events.

✅ Core workflow:

Discover
 ├── Team Hub       (Teams management)
 ├── Create Event   (Submit local events)
 └── Approvals      (Moderation dashboard)


This is the foundation of a scalable community ecosystem.

4. “Keep in mind people will schedule fundraisers/bbqs through the app”

Events should not be restricted to sports competitions — community gatherings matter.

Suggested additional fields:

Event Type: Game, Fundraiser, Watch Party, Tryout, BBQ, etc.

Contact Info or RSVP link

Optional “Donate” button for charity/fundraiser events (integrated with Stripe later)

✅ Future enhancement:

Allow organizers to collect payments or donations directly via Stripe once verified.

✅ Summary

Discover Section – New Community Flow

Tab	Purpose	User Roles	Key Actions
Team Hub	Manage or create teams	Coach, Organizer	Create/edit team pages
Create Event	Submit local games, watch parties, or fundraisers	Fans, Coaches	Fill form → Send for approval
Approvals	Moderate fan-submitted events	Admins, Coaches	Approve/reject before publishing
💡 Technical & UX Recommendations

Event Creation Permissions:

role === fan → can create events → status = pending_approval

role === coach/organizer → events publish immediately

Backend:

Event object includes:

{
  "creatorRole": "fan",
  "approvalStatus": "pending",
  "eventType": "fundraiser",
  "linkedLeague": "Stamford High School League"
}


UI Feedback:

“Your event has been submitted for approval.”

“Approved events will appear in your local league section.”

⚙️ In short

This feature makes VarsityHub:

More social: Fans contribute to the ecosystem.

More local: Everyone sees nearby sports and community activity.

More complete: Three-tier Discover system ties the community together.

📍 Discover + Fan Event Creation Flow

(Community Events & Local League Visibility)

🎯 Overview

The Discover section will serve as the community hub for all users — allowing fans, coaches, and organizers to view, create, and manage local sports content in one place.
This introduces fan-submitted events, league-wide visibility, and a three-tier Discover setup (Teams / Events / Approvals).

🧩 Structure: Three-Tier Discover Setup
Tier	Description	User Access	Example UI
1. Team Hub	Manage or create team pages	Coach / Organizer	“Create New Team” form with name, handle, org, description
2. Create Event	Submit games, watch parties, fundraisers, tryouts, etc.	All users (Fans included)	Event form (title, date/time, location, description, type)
3. Approvals	Moderate and review submitted events	Admin / Coach / League Rep	Pending events list with Approve/Reject buttons
🧠 Functional Logic

1. Event Creation Permissions

Fans can create events but they require approval.

Coaches/Organizers can create events instantly without review.

Approved events automatically publish under:

The related League Page

The Discover feed

The local area map / highlights

if (user.role === 'fan') {
  event.status = 'pending_approval';
} else {
  event.status = 'approved';
}


2. Event Types

Game / Match

Watch Party

Fundraiser / BBQ

Tryout / Practice

Other (custom label)

Each event includes:

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


3. League Page Integration

League page now aggregates:

🏈 All Teams

📅 All Events (official + fan-submitted)

📣 Highlights / Local News

Filter options: Teams, Events, Posts.

Fans can discover everything related to their local sports ecosystem in one place.

⚙️ Workflow

Create Event Flow

User → Discover → Create Event

Fills form → Submit

Fan event → moves to “Approvals” queue

Moderator approves → published to League + Feed

Approval Queue

Admins and coaches see a moderation dashboard with filters: Pending, Approved, Rejected.

Actions trigger push notifications to creators:

“✅ Your event has been approved!”

“❌ Your event was rejected — please revise details.”

💡 UX Guidelines

Use the same clean vertical layout as shown in your screenshots.

Display a calendar preview at the bottom showing upcoming local events.

Add “Open in Maps” links to event locations.

Show creator info (fan, coach, etc.) under event details.

Allow easy RSVP / share buttons for community engagement.

💰 Monetization / Upgrade Logic

Free users:

Can create up to 2 teams and 3 pending events.

Veteran / Legend plans:

Unlimited team and event creation.

Priority approval for events.

Upgrade prompt example:

“You’ve reached your limit of 3 pending events. Upgrade to Veteran to create unlimited community events.”

🔒 Permissions Summary
Role	Create Team	Create Event	Needs Approval	Manage Others	Moderate Events
Fan	❌	✅	✅	❌	❌
Coach/Organizer	✅	✅	❌	✅	✅
Admin/League Rep	✅	✅	❌	✅	✅
✅ Acceptance Criteria

Fans can submit events, routed to the approval queue.

Approved events appear automatically on:

League pages

Local Discover tab

Search results by event name or location.

Coaches/Admins can manage approvals and edits.

Upgrade modal triggers on fan event or team creation limits.