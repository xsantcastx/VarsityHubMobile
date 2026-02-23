# Team/Organization Refactor - Testing Checklist

## Pre-Test Setup

- [ ] Restart Metro bundler: `npm start -- --reset-cache`
- [ ] Clear simulator cache: Simulator → Hardware → Erase All Content and Settings
- [ ] Rebuild app: `npx eas build --platform ios --local` or use Xcode

## Team Page Tests (team-page.tsx)

### Navigation & Loading
- [ ] Navigate to Warriors vs Cavaliers game details
- [ ] Tap Warriors team card at bottom
- [ ] Page loads and shows "Warriors" title
- [ ] Loading spinner appears briefly
- [ ] No error message shown

### Roster (CRITICAL FIX)
- [ ] Members tab shows
- [ ] Scroll members list
- [ ] **VERIFY**: All members have Warriors team (no Cavaliers mixed in)
- [ ] Members sorted by jersey number (ascending)
- [ ] Jersey numbers display correctly (#1, #2, etc.)
- [ ] Player names/avatars display correctly

### Schedule
- [ ] Schedule tab shows Warriors games
- [ ] Games sorted oldest → newest (for middle positioning)
- [ ] Scroll up: past games visible
- [ ] Scroll down: future games visible
- [ ] Tap game → opens game details (Warriors game, not random)

### Feed
- [ ] Feed tab shows posts
- [ ] Posts contain #warriors hashtag OR are associated with Warriors games
- [ ] **VERIFY**: No random Cavaliers posts shown
- [ ] Posts from team members visible
- [ ] Post timestamps make sense

### Organization Button (NEW)
- [ ] Scroll down to "View Organization" button
- [ ] Button shows with business icon
- [ ] Tap button → navigates to organization page
- [ ] Organization page loads (see Organization Tests below)

### Error Handling
- [ ] Kill network, retry button appears
- [ ] Network restored, tap retry → page reloads
- [ ] Pull to refresh works

## Organization Page Tests (organization.tsx - NEW)

### Navigation to Page
- [ ] Accessible via team-page org button
- [ ] Page title: "Organization"
- [ ] Loads without errors

### Teams Tab (Default)
- [ ] Shows all teams in organization
- [ ] Each team card shows:
  - [ ] Team logo (or placeholder icon)
  - [ ] Team name
  - [ ] Sport/season if available
  - [ ] Member count
- [ ] Tap team card → opens that team's team-page
- [ ] Tapping different teams works correctly

### Schedule Tab
- [ ] Shows all games for all org teams
- [ ] Games from different teams visible
- [ ] Sorted oldest → newest
- [ ] Tap game → opens game details

### Feed Tab
- [ ] Shows posts mentioning any team in org
- [ ] Posts from different team hashtags visible (#warriors, #cavaliers, etc.)
- [ ] Tap post → opens post detail

### Stats Card
- [ ] Shows accurate team count
- [ ] Shows accurate game count
- [ ] Shows accurate post count
- [ ] Numbers update when data refreshes

### Pull to Refresh
- [ ] Pull down → refresh spinner appears
- [ ] Data reloads
- [ ] Spinner disappears

## Navigation Flow Tests

### Team → Organization → Team
- [ ] Start at Warriors team-page
- [ ] Tap org button
- [ ] See all org teams (Warriors + others)
- [ ] Tap Warriors again → back to Warriors team-page
- [ ] Data still accurate (roster, games, feed)

### Game → Team → Organization → Game
- [ ] Start at Warriors vs Cavaliers game
- [ ] Tap Warriors card → team-page
- [ ] Tap schedule tab, tap game → back to game details
- [ ] All data consistent

## Data Isolation Tests (CRITICAL)

### Team Data
- [ ] Warriors team-page shows ONLY Warriors members
- [ ] Warriors team-page shows ONLY Warriors games
- [ ] Warriors team-page shows ONLY Warriors-related posts

### Organization Data
- [ ] Organization page shows ALL teams in org (not just Warriors)
- [ ] Organization games include all team games
- [ ] Organization feed includes all team posts

### No Cross-Contamination
- [ ] Switching teams doesn't mix data
- [ ] Cavaliers team-page clean from Warriors
- [ ] Warriors team-page clean from Cavaliers

## Performance Tests

### Load Times
- [ ] team-page loads in < 2 seconds
- [ ] organization.tsx loads in < 2 seconds
- [ ] Switching tabs doesn't lag
- [ ] Pulling to refresh responsive

### Memory
- [ ] No console errors/warnings
- [ ] App doesn't crash when navigating repeatedly
- [ ] Scrolling smooth (60 fps)

## UI/UX Tests

### Styling
- [ ] Colors match app theme
- [ ] Text readable (not cut off)
- [ ] Proper spacing/padding
- [ ] Icons visible and aligned

### Empty States
- [ ] Teams with no games: "No games scheduled" message
- [ ] Organizations with no teams: "No teams" message
- [ ] Empty feeds show proper messaging

### Loading/Error States
- [ ] Loading spinner centered and animated
- [ ] Error messages clear and actionable
- [ ] Retry button functional

## Edge Cases

### No Organization ID
- [ ] Try navigating to `/organization` without ID
- [ ] Error message shown (e.g., "No organization ID provided")
- [ ] No crash

### Org with One Team
- [ ] Organization page works with single team
- [ ] Stats show 1 team
- [ ] Team card clickable

### Team with No Members
- [ ] Team-page loads without error
- [ ] Roster tab shows "No members" message
- [ ] Feed/schedule tabs still work

### Network Issues
- [ ] App handles slow connection gracefully
- [ ] Timeout message appears
- [ ] Retry button works after network restored

## Regression Tests

### Existing Features Still Work
- [ ] GameDetailsScreen still displays correctly
- [ ] Game voting still works
- [ ] Team cards at bottom of game page still visible
- [ ] Finals banner still displays
- [ ] Stories/timeline features unaffected

## Sign-Off Checklist

- [ ] All team tests passed
- [ ] All organization tests passed
- [ ] Navigation flows work correctly
- [ ] Data isolation verified
- [ ] No crashes or console errors
- [ ] Performance acceptable
- [ ] UI/UX polished
- [ ] Edge cases handled

---

## Notes for Testing

1. **Critical Data Points**: The most important test is **roster filtering** - verify Warriors team-page shows ONLY Warriors members, not mixed with Cavaliers.

2. **Schedule Sorting**: Verify games appear with past games above scroll, future games below scroll.

3. **Organization ID**: When testing org page, verify the ID is real and has teams associated.

4. **API Availability**: Make sure backend is running and APIs are returning data.

5. **Network**: Ensure simulator has network access (can reach backend).

---

**Testing Duration Estimate**: 1-2 hours
**Critical Issues to Report**: Roster mixing, data isolation failures, navigation errors
**Nice to Have**: Performance optimizations, UI polish
