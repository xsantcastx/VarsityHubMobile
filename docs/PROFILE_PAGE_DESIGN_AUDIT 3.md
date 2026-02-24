# Profile Page Design Audit

## Design Requirements (From Image)

All profile pages (coach, user, fans, organization, and team) should have:

### ✅ Header Section
- [ ] Header banner (landscape image)
- [ ] Settings icon (gear) in top-right corner
- [ ] Profile picture overlay (circular, overlaps banner)
- [ ] Username displayed prominently
- [ ] "Edit profile" button (rounded, white text on colored background)

### ✅ User Details
- [ ] @handle (username)
- [ ] Bio/description text
- [ ] Calendar icon + "Joined [Month Year]"
- [ ] Following/Followers count (e.g., "0 Following 0 Followers")

### ✅ Content Tabs
- [ ] "Posts" tab (active state highlighted)
- [ ] "Replies" tab
- [ ] "Upvotes" tab

### ✅ Content Area
- [ ] Empty state message (e.g., "No posts yet")
- [ ] Post feed below tabs

### ✅ Bottom Navigation
- [ ] Feed icon
- [ ] Highlights icon
- [ ] Create (+) icon (center, larger)
- [ ] Discover icon
- [ ] Profile icon (active)

---

## Current Implementation Status

### 1. User Profile (`app/profile.tsx`)

**✅ Matches Design:**
- Header banner with background image ✅
- Settings icon in top-right ✅
- Profile picture overlay ✅
- Username displayed ✅
- "Edit Profile" button ✅
- Stats section (posts, followers, following) ✅
- Empty state message ✅

**❌ Doesn't Match Design:**
- **Tabs:** Has "Posts" and "Interactions" instead of "Posts", "Replies", "Upvotes" ❌
- **Join Date:** Missing "Joined [Month Year]" with calendar icon ❌
- **Following/Followers:** Shows in stats format, not inline text ❌
- **Bio:** Appears below header, not in header overlay area ❌

**File:** `app/profile.tsx` (lines 449-641)

---

### 2. Team Profile (`app/team-page.tsx`)

**✅ Has Some Elements:**
- Hero header with gradient ✅
- Team logo ✅
- Team name ✅
- Follow button ✅
- Tabs: "Feed", "Schedule", "Roster" ✅

**❌ Doesn't Match Design:**
- **Header Banner:** Uses gradient, not landscape image ❌
- **Settings Icon:** Missing ❌
- **Edit Button:** Missing ❌
- **Join Date:** Missing ❌
- **Tabs:** Different tabs (Feed/Schedule/Roster vs Posts/Replies/Upvotes) ❌
- **Profile Picture:** Uses logo instead of profile picture overlay ❌

**File:** `app/team-page.tsx`

---

### 3. Organization Profile (`app/organization.tsx`)

**✅ Has Some Elements:**
- Hero header with gradient ✅
- Organization icon ✅
- Follow button ✅
- Tabs: "Teams", "Schedule", "Feed" ✅

**❌ Doesn't Match Design:**
- **Header Banner:** Uses gradient, not landscape image ❌
- **Settings Icon:** Missing ❌
- **Edit Button:** Missing ❌
- **Join Date:** Missing ❌
- **Tabs:** Different tabs (Teams/Schedule/Feed vs Posts/Replies/Upvotes) ❌
- **Profile Picture:** Uses icon instead of profile picture overlay ❌

**File:** `app/organization.tsx`

---

### 4. Coach Profile

**Status:** Uses same `app/profile.tsx` as regular users

**Issues:** Same as User Profile above

---

### 5. Fan Profile

**Status:** Uses same `app/profile.tsx` as regular users

**Issues:** Same as User Profile above

---

## Required Fixes

### Priority 1: Standardize Profile Layout

All profile pages need:

1. **Header Banner**
   - Landscape image (or gradient fallback)
   - Settings icon top-right
   - Profile picture overlay (circular, overlapping banner bottom-left)
   - Username prominently displayed
   - "Edit profile" button (if own profile)

2. **User Details Section**
   - @handle (username)
   - Bio text
   - Calendar icon + "Joined [Month Year]"
   - "X Following Y Followers" inline text

3. **Content Tabs**
   - "Posts" (show user's posts)
   - "Replies" (show user's comments/replies)
   - "Upvotes" (show posts user upvoted)

4. **Empty State**
   - "No posts yet" message
   - Centered, appropriate for each tab

### Priority 2: Team Profile Updates

**File:** `app/team-page.tsx`

- [ ] Add header banner image support
- [ ] Add settings icon (for team admins)
- [ ] Add "Edit profile" button (for team admins)
- [ ] Change tabs to: "Posts", "Replies", "Upvotes" (or adapt for team context)
- [ ] Add "Joined [Date]" or "Created [Date]"
- [ ] Profile picture should be circular overlay on banner

### Priority 3: Organization Profile Updates

**File:** `app/organization.tsx`

- [ ] Add header banner image support
- [ ] Add settings icon (for org admins)
- [ ] Add "Edit profile" button (for org admins)
- [ ] Change tabs to: "Posts", "Replies", "Upvotes" (or adapt for org context)
- [ ] Add "Joined [Date]" or "Created [Date]"
- [ ] Profile picture should be circular overlay on banner

### Priority 4: User Profile Tab Updates

**File:** `app/profile.tsx`

- [ ] Change "Interactions" tab to "Replies" and "Upvotes" (split into two tabs)
- [ ] Add "Joined [Month Year]" with calendar icon
- [ ] Update following/followers to inline text format
- [ ] Move bio to header overlay area

---

## Design Specifications

### Header Banner
- Height: ~200px (or as shown in image)
- Full width
- Landscape image (with gradient overlay)
- Editable by profile owner

### Profile Picture
- Size: ~80px diameter
- Circular border (white, ~3px)
- Overlaps banner bottom (about 1/3 overlap)
- Positioned left side

### Settings Icon
- Position: Top-right corner
- Size: 18px
- White color
- Circular background with transparency

### Edit Profile Button
- Rounded button
- White text
- Positioned in header area (as shown in image)
- Visible only for own profile

### Content Tabs
- Three tabs: "Posts", "Replies", "Upvotes"
- Active tab highlighted (blue underline)
- Icons optional (as shown in image)

### User Details
- @handle below username
- Bio text
- Calendar icon + "Joined [Month Year]"
- "X Following Y Followers" inline

---

## Implementation Checklist

- [ ] Update `app/profile.tsx` tabs (Posts, Replies, Upvotes)
- [ ] Add join date to user profile
- [ ] Update following/followers display format
- [ ] Add header banner to team profile
- [ ] Add header banner to organization profile
- [ ] Standardize all profile layouts
- [ ] Add settings icon to team/organization profiles
- [ ] Add edit button to team/organization profiles (for admins)
- [ ] Test all profile types match design

---

## Notes

- Team and Organization profiles may need adapted tabs (e.g., "Schedule", "Roster") while keeping the same visual design
- "Replies" tab may show team/organization comments on posts
- "Upvotes" tab may show team/organization liked posts
- Admin-only features (settings, edit) should be conditional
