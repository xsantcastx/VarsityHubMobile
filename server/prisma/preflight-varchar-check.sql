-- =============================================================================
-- v1.0.2 Preflight: VARCHAR constraint check
-- Run against PRODUCTION before applying migration
-- 20260416183000_phase3_constraints_and_counts
-- Covers 53 constrained columns across 12 tables, matching the migration 1:1.
--
-- Any rows returned here MUST be fixed before the migration can succeed.
-- =============================================================================

-- ── User ────────────────────────────────────────────────────────────────────
SELECT 'User.email' AS col, id, LENGTH(email) AS len
  FROM "User" WHERE LENGTH(email) > 320
UNION ALL
SELECT 'User.display_name', id, LENGTH(display_name)
  FROM "User" WHERE LENGTH(display_name) > 120
UNION ALL
SELECT 'User.username', id, LENGTH(username)
  FROM "User" WHERE LENGTH(username) > 20
UNION ALL
SELECT 'User.avatar_url', id, LENGTH(avatar_url)
  FROM "User" WHERE LENGTH(avatar_url) > 2048
UNION ALL
SELECT 'User.bio', id, LENGTH(bio)
  FROM "User" WHERE LENGTH(bio) > 300

-- ── Game ────────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Game.title', id, LENGTH(title)
  FROM "Game" WHERE LENGTH(title) > 200
UNION ALL
SELECT 'Game.watch_location', id, LENGTH(watch_location)
  FROM "Game" WHERE LENGTH(watch_location) > 200
UNION ALL
SELECT 'Game.destination', id, LENGTH(destination)
  FROM "Game" WHERE LENGTH(destination) > 200

-- ── Post ────────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Post.title', id, LENGTH(title)
  FROM "Post" WHERE LENGTH(title) > 200
UNION ALL
SELECT 'Post.content', id, LENGTH(content)
  FROM "Post" WHERE LENGTH(content) > 4000
UNION ALL
SELECT 'Post.type', id, LENGTH(type)
  FROM "Post" WHERE LENGTH(type) > 50

-- ── Event ───────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Event.title', id, LENGTH(title)
  FROM "Event" WHERE LENGTH(title) > 200
UNION ALL
SELECT 'Event.location', id, LENGTH(location)
  FROM "Event" WHERE LENGTH(location) > 500
UNION ALL
SELECT 'Event.creator_role', id, LENGTH(creator_role)
  FROM "Event" WHERE LENGTH(creator_role) > 50
UNION ALL
SELECT 'Event.event_type', id, LENGTH(event_type)
  FROM "Event" WHERE LENGTH(event_type) > 50
UNION ALL
SELECT 'Event.description', id, LENGTH(description)
  FROM "Event" WHERE LENGTH(description) > 5000
UNION ALL
SELECT 'Event.linked_league', id, LENGTH(linked_league)
  FROM "Event" WHERE LENGTH(linked_league) > 255
UNION ALL
SELECT 'Event.contact_info', id, LENGTH(contact_info)
  FROM "Event" WHERE LENGTH(contact_info) > 500

-- ── Message ─────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Message.content', id, LENGTH(content)
  FROM "Message" WHERE LENGTH(content) > 5000

-- ── GroupChat ───────────────────────────────────────────────────────────────
UNION ALL
SELECT 'GroupChat.name', id, LENGTH(name)
  FROM "GroupChat" WHERE LENGTH(name) > 100

-- ── GroupChatMessage ────────────────────────────────────────────────────────
UNION ALL
SELECT 'GroupChatMessage.content', id, LENGTH(content)
  FROM "GroupChatMessage" WHERE LENGTH(content) > 5000

-- ── Comment ─────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Comment.content', id, LENGTH(content)
  FROM "Comment" WHERE LENGTH(content) > 1000

-- ── Ad ──────────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Ad.contact_name', id, LENGTH(contact_name)
  FROM "Ad" WHERE LENGTH(contact_name) > 200
UNION ALL
SELECT 'Ad.contact_email', id, LENGTH(contact_email)
  FROM "Ad" WHERE LENGTH(contact_email) > 320
UNION ALL
SELECT 'Ad.business_name', id, LENGTH(business_name)
  FROM "Ad" WHERE LENGTH(business_name) > 200
UNION ALL
SELECT 'Ad.banner_url', id, LENGTH(banner_url)
  FROM "Ad" WHERE LENGTH(banner_url) > 2048
UNION ALL
SELECT 'Ad.target_url', id, LENGTH(target_url)
  FROM "Ad" WHERE LENGTH(target_url) > 2048
UNION ALL
SELECT 'Ad.target_zip_code', id, LENGTH(target_zip_code)
  FROM "Ad" WHERE LENGTH(target_zip_code) > 12
UNION ALL
SELECT 'Ad.description', id, LENGTH(description)
  FROM "Ad" WHERE LENGTH(description) > 1000
UNION ALL
SELECT 'Ad.admin_note', id, LENGTH(admin_note)
  FROM "Ad" WHERE LENGTH(admin_note) > 2000

-- ── Story ───────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Story.caption', id, LENGTH(caption)
  FROM "Story" WHERE LENGTH(caption) > 500

-- ── Team ────────────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Team.name', id, LENGTH(name)
  FROM "Team" WHERE LENGTH(name) > 100
UNION ALL
SELECT 'Team.description', id, LENGTH(description)
  FROM "Team" WHERE LENGTH(description) > 1000
UNION ALL
SELECT 'Team.sport', id, LENGTH(sport)
  FROM "Team" WHERE LENGTH(sport) > 100
UNION ALL
SELECT 'Team.extracurricular_category', id, LENGTH(extracurricular_category)
  FROM "Team" WHERE LENGTH(extracurricular_category) > 100
UNION ALL
SELECT 'Team.season', id, LENGTH(season)
  FROM "Team" WHERE LENGTH(season) > 50
UNION ALL
SELECT 'Team.primary_color', id, LENGTH(primary_color)
  FROM "Team" WHERE LENGTH(primary_color) > 20
UNION ALL
SELECT 'Team.venue_place_id', id, LENGTH(venue_place_id)
  FROM "Team" WHERE LENGTH(venue_place_id) > 255
UNION ALL
SELECT 'Team.venue_address', id, LENGTH(venue_address)
  FROM "Team" WHERE LENGTH(venue_address) > 500
UNION ALL
SELECT 'Team.city', id, LENGTH(city)
  FROM "Team" WHERE LENGTH(city) > 100
UNION ALL
SELECT 'Team.state', id, LENGTH(state)
  FROM "Team" WHERE LENGTH(state) > 100
UNION ALL
SELECT 'Team.league', id, LENGTH(league)
  FROM "Team" WHERE LENGTH(league) > 100

-- ── Organization ────────────────────────────────────────────────────────────
UNION ALL
SELECT 'Organization.name', id, LENGTH(name)
  FROM "Organization" WHERE LENGTH(name) > 255
UNION ALL
SELECT 'Organization.description', id, LENGTH(description)
  FROM "Organization" WHERE LENGTH(description) > 2000
UNION ALL
SELECT 'Organization.logo_url', id, LENGTH(logo_url)
  FROM "Organization" WHERE LENGTH(logo_url) > 2000
UNION ALL
SELECT 'Organization.profile_picture_url', id, LENGTH(profile_picture_url)
  FROM "Organization" WHERE LENGTH(profile_picture_url) > 2000
UNION ALL
SELECT 'Organization.background_url', id, LENGTH(background_url)
  FROM "Organization" WHERE LENGTH(background_url) > 2000
UNION ALL
SELECT 'Organization.sport', id, LENGTH(sport)
  FROM "Organization" WHERE LENGTH(sport) > 100
UNION ALL
SELECT 'Organization.org_type', id, LENGTH(org_type)
  FROM "Organization" WHERE LENGTH(org_type) > 100
UNION ALL
SELECT 'Organization.location', id, LENGTH(location)
  FROM "Organization" WHERE LENGTH(location) > 500
UNION ALL
SELECT 'Organization.zip_code', id, LENGTH(zip_code)
  FROM "Organization" WHERE LENGTH(zip_code) > 20
UNION ALL
SELECT 'Organization.contact_info', id, LENGTH(contact_info)
  FROM "Organization" WHERE LENGTH(contact_info) > 500
UNION ALL
SELECT 'Organization.supporting_document_url', id, LENGTH(supporting_document_url)
  FROM "Organization" WHERE LENGTH(supporting_document_url) > 2000

ORDER BY col;
