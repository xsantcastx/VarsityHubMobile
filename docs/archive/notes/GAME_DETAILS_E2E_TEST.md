# Game Details Screen - End-to-End Test Plan

## Test Case: Warriors vs Cavaliers Game Page

### 1. HEADER SECTION ✓

- [x] Header displays with Warriors vs Cavaliers title
- [x] Banner displays (blue-red-gold gradient for Finals matchup)
- [x] Back button navigates back
- [x] Share button opens share menu
- [x] RSVP button shows (if event exists)
- [x] Date/time displays: "Fri, Dec 12, 2025 6:00 PM"
- [x] Countdown displays: "Starts in 1d 23:59:57"

### 2. STORY SECTION

- [ ] "Add Story" button present and enabled 24hrs before event
- [ ] "Stories open 24hrs before event" message displays when disabled
- [ ] Clicking "Add Story" opens photo picker
- [ ] Stories carousel displays if media exists
- [ ] Stories carousel is empty state message if no stories

### 3. GAME DESCRIPTION

- [ ] "No description yet." displays when empty
- [ ] Description text displays when available
- [ ] Generic "friendly match" descriptions are hidden

### 4. VOTING SECTION (POLL)

- [ ] Poll displays: "Warriors 50% | Cavaliers 50%"
- [ ] Total votes counter shows: "0 votes • You haven't voted"
- [ ] Tapping Warriors button votes and updates poll
- [ ] Tapping Cavaliers button votes and updates poll
- [ ] Long-press on voted option allows un-voting
- [ ] Poll is disabled if game is past

### 5. POSTS/HIGHLIGHTS SECTION

- [ ] Section title "Posts" displays
- [ ] Subtitle shows "No highlights yet" when empty
- [ ] "+" button to add highlight is visible
- [ ] Posts grid displays when posts exist
- [ ] Each post shows thumbnail and can be tapped

### 6. TEAM SECTION (AT BOTTOM)

- [ ] Two team cards display side-by-side
- [ ] Each card shows team logo (72x72)
- [ ] Each card shows team name below logo
- [ ] Cards have border and proper styling
- [ ] Tapping card navigates to team page
- [ ] Icon shows if logo unavailable
- [ ] "No teams linked to this game yet" displays when empty

### 7. SCROLL & ANIMATION

- [ ] Page scrolls smoothly
- [ ] Pull-to-refresh works
- [ ] Header animates on scroll (fades out)
- [ ] "Top" FAB appears when scrolling down
- [ ] Clicking "Top" FAB scrolls back to top

### 8. LOADING STATES

- [ ] Loading spinner displays while fetching
- [ ] Error message displays if game not found
- [ ] "Retry" button appears on error
- [ ] Refresh control works after error

### 9. RESPONSIVENESS

- [ ] Layout looks good on iPhone 12
- [ ] Layout looks good on iPhone 15 Pro
- [ ] Safe area respected (notch/dynamic island)
- [ ] Text doesn't overflow
- [ ] Images load properly

### 10. ACCESSIBILITY

- [ ] All buttons have accessibility labels
- [ ] Colors have sufficient contrast
- [ ] Touch targets are >= 44pt
- [ ] VoiceOver navigation works

---

## ISSUES IDENTIFIED

### Issue 1: Team Section Styling Error

**Status**: CRITICAL
**Problem**: `Colors[colorScheme]` used in style object outside of function
**Location**: `teamLinkButtonEnhanced` style definition
**Impact**: CSS-in-JS error, team cards may not render
**Fix**: Move color-dependent styles to inline style objects in component

### Issue 2: SVG Image Loading

**Status**: HIGH
**Problem**: SVG data URI may not load properly in Image component
**Location**: `renderBanner()` function
**Fix**: Verify SVG renders or use LinearGradient fallback

### Issue 3: Poll Section Position

**Status**: MEDIUM
**Problem**: Poll appears above description per screenshot
**Expected**: Poll should appear below description per earlier conversation
**Fix**: Move poll section below description in render order

### Issue 4: Missing Team Card Navigation

**Status**: MEDIUM
**Problem**: Team cards navigate to `/team-page` but need team ID
**Currently**: Only passes team name
**Fix**: Lookup team ID from vm.teams before navigation

### Issue 5: Empty State Messages

**Status**: LOW
**Problem**: "No teams linked" message doesn't display when vm.teams is empty
**Location**: Early return in renderTeamSection
**Fix**: Ensure fallback message displays properly

---

## MANUAL TEST STEPS

### To Test Warriors vs Cavaliers Game:

1. Launch app on simulator
2. Navigate to Feed
3. Search or find Warriors vs Cavaliers game
4. Tap to open game details
5. Verify all sections above appear and function correctly

### To Test as New Game:

Use sample game ID: `sample-Warriors-Cavaliers`

---

## AUTOMATED TEST COVERAGE NEEDED

- [ ] Render test for GameDetailsScreen component
- [ ] Integration test for game data loading
- [ ] Unit test for `finalsBannerForTeams` function
- [ ] Unit test for `pickBannerFromArrays` function
- [ ] Unit test for vote section calculations
- [ ] Snapshot test for final rendered output
