# Quick Start Guide - Team/Organization Refactor

## What Was Changed

### 3 Files Involved:
1. **team-page.tsx** - MODIFIED (now truly team-specific, was league-wide)
2. **organization.tsx** - CREATED (new organization-level view)
3. **TEAM_ORG_REFACTOR_SUMMARY.md** - CREATED (documentation)

### Key Fixes:
✅ **Roster filtering** - Only shows that team's members (was showing all org members mixed together)
✅ **Schedule sorting** - Games sorted oldest-first (past up, future down)
✅ **Feed filtering** - Only shows that team's posts (team hashtags + game posts)
✅ **Organization linking** - New button to view all teams in the organization
✅ **Team-specific view** - Renamed from LeagueScreen to TeamScreen, loads single team instead of all teams

---

## How to Test

### 1. Quick Setup
```bash
# Reset Metro cache
npm start -- --reset-cache

# Or if using EAS
npx eas build --platform ios --local
```

### 2. Test the Main Flow
1. Launch simulator
2. Go to **Warriors vs Cavaliers** game
3. Tap the **Warriors** team card (bottom of screen)
4. You should see:
   - Warriors games (sorted oldest first)
   - **ONLY Warriors members** (verify Cavaliers NOT mixed in!)
   - Warriors hashtag posts
   - **"View Organization" button** at top

### 3. Test Organization Page
1. From Warriors team page, tap **"View Organization"** button
2. You should see:
   - All teams in the organization
   - All games across all teams
   - All posts across all teams
   - Stats: Team count, Game count, Post count
3. Tap a different team → should navigate to that team's page

### 4. Verify Data Isolation
This is the most important test:
- **Warriors team page**: Should show ONLY Warriors roster
- **Cavaliers team page**: Should show ONLY Cavaliers roster
- **Organization page**: Should show ALL teams + all data

---

## What Could Go Wrong

### Issue: Roster still shows mixed teams
- **Cause**: Database not filtered by team_id
- **Fix**: Check Team.members() API is returning correct data

### Issue: Organization button doesn't appear
- **Cause**: team.organization_id is null/undefined
- **Fix**: Verify Warriors team has organization_id set in database

### Issue: Navigation doesn't work
- **Cause**: Router navigation parameter mismatch
- **Fix**: Check that team IDs match in database

### Issue: App crashes on team-page
- **Cause**: TypeError trying to access team properties
- **Fix**: Ensure team data is loaded before rendering

---

## Files to Verify

### `/app/team-page.tsx`
- Line 53: `export default function TeamScreen()`
- Line 70: `const loadTeam = useCallback(async () => {`
- Line 62: `const [team, setTeam] = useState<LeagueTeam | null>(null);`
- Line 490-510: Organization linking button should be visible

### `/app/organization.tsx`
- Full new file (421 lines)
- Has Teams, Schedule, Feed tabs
- Shows all teams in organization

---

## Key Code Locations

### Team Member Filtering (THE CRITICAL FIX)
**File**: `/app/team-page.tsx` **Line ~190**
```typescript
// This is what filters roster to ONLY this team's members
const teamMembers = await Team.members(teamData.id);
return memberList
  .filter((m: any) => m.team_id === teamData!.id)
  .sort((a: any, b: any) => {
    const aJersey = parseInt(String(a.jersey_number || 999), 10);
    const bJersey = parseInt(String(b.jersey_number || 999), 10);
    return aJersey - bJersey;
  });
```

### Organization Navigation (NEW)
**File**: `/app/team-page.tsx` **Line ~490**
```typescript
{team?.organization_id && (
  <Pressable
    onPress={() => router.push(`/organization?id=${team.organization_id}` as any)}
  >
    {/* View Organization button */}
  </Pressable>
)}
```

### Game Sorting (OLDEST FIRST)
**File**: `/app/team-page.tsx` **Line ~130**
```typescript
.sort((a, b) => {
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  return dateA - dateB; // Oldest first
})
```

---

## Navigation Architecture

### Complete Flow:
```
GameDetailsScreen (Warriors vs Cavaliers)
         ↓ (tap Warriors team card)
    team-page.tsx (Warriors)
         ↓ (tap organization button)
    organization.tsx
         ↓ (tap Warriors card again)
    team-page.tsx (Warriors)
```

### Parameters:
- **team-page**: Accepts `?id=teamId` or `?name=teamName`
- **organization**: Accepts `?id=organizationId`

---

## Success Criteria

- [ ] Team-page loads when tapping team card
- [ ] Warriors roster shows ONLY Warriors (no Cavaliers)
- [ ] Schedule sorted with past games at top
- [ ] Feed shows only Warriors posts
- [ ] Organization button visible
- [ ] Organization page shows all teams
- [ ] Can navigate between pages without errors
- [ ] No console errors/warnings

---

## Rollback Instructions

If something breaks:

```bash
# Revert team-page.tsx to previous version
git checkout HEAD~1 app/team-page.tsx

# Delete organization.tsx
rm app/organization.tsx

# Restart Metro
npm start -- --reset-cache
```

---

## Questions or Issues?

Check these documents:
1. **TEAM_ORG_REFACTOR_SUMMARY.md** - Full technical details
2. **TEAM_ORG_TESTING_CHECKLIST.md** - Comprehensive test plan
3. **TEAM_ORGANIZATION_ARCHITECTURE.md** - Architecture explanation

---

**Status**: Ready for testing
**Last Updated**: $(date)
**Version**: 1.0 (Initial Release)
