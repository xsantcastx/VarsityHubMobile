# Team & Organization Page Architecture - Implementation Plan

## CURRENT STATE

### team-page.tsx (PUBLIC TEAM VIEW)

- Shows games, feed, and roster
- Called from GameDetailsScreen when user taps team card
- Receives: `{ id: string, name: string }`
- Problem: Currently treats it like a league/organization page, not a specific team

### team-profile.tsx (TEAM MANAGEMENT)

- Team editing, member management
- Admin/owner only
- Settings and configuration

### Issue: team-page.tsx is confusing - it acts like a league page but should act like a team page

---

## WHAT NEEDS TO BE IMPLEMENTED

### 1. ORGANIZATION BUTTON ON TEAM PAGE

**Where**: Top of team-page.tsx header (if team has organization_id)
**What**: Small button linking to organization page
**Implementation**:

- Check if team has `organization_id`
- Add button next to team name
- Navigate to organization page with org ID

### 2. FEED TAB IMPROVEMENTS

**Current**: Fetches posts from games where team plays
**Should Be**:

- Posts tagged with team hashtag (#warriors)
- Posts created by team members mentioning team
- Posts from game events involving this team
- Posts from team-specific hashtags
- Order: Most recent first

### 3. SCHEDULE TAB IMPROVEMENTS

**Current**: Shows all games, unsorted
**Should Be**:

- ALL games (past and future)
- Sorted with most recent (today) in the MIDDLE
- Scroll UP = past games (oldest first)
- Scroll DOWN = future games (soonest first)
- Visual indicator for current/today's games

### 4. ROSTER TAB

**Current**: Shows all members from all team variations
**Should Be**:

- Only members connected to THIS specific team
- Filter by: team_id matches
- Show role, jersey number, position
- Separate athletes from staff
- Alphabetical or jersey number order

---

## DATA MODEL FIXES NEEDED

### Team Object Should Include:

```
{
  id: string
  name: string
  organization_id?: string  // Link to org
  logo_url?: string
  description?: string
  created_at?: string
  sport?: string
  season?: string
  _count?: {
    members: number
    games: number
  }
}
```

### TeamMember Object Should Include:

```
{
  id: string
  user_id: string
  team_id: string  // CRITICAL: Specific team, not just user
  role: string
  jersey_number?: string
  position?: string
  user: {
    id: string
    display_name: string
    avatar_url?: string
  }
}
```

---

## TECHNICAL REQUIREMENTS

### 1. Fix team-page.tsx Data Loading

```typescript
// CURRENT (WRONG)
const teamNames = filteredTeams.map(t => t.name);
const gamesResult = games.filter(
  g => g.homeTeam.includes(teamName) || g.awayTeam.includes(teamName)
);

// SHOULD BE (RIGHT)
const teamId = params.id;
const gamesResult = games.filter(
  g =>
    g.team_id === teamId || // Direct team_id field
    g.home_team_id === teamId ||
    g.away_team_id === teamId
);
```

### 2. Fix Roster Loading

```typescript
// CURRENT (WRONG)
const allMembers = [];
filteredTeams.forEach(team => {
  Team.members(team.id).then(members => {
    allMembers.push(...members); // Aggregates from all teams
  });
});

// SHOULD BE (RIGHT)
const teamId = params.id;
const members = await Team.members(teamId); // Only THIS team
const filtered = members.filter(m => m.team_id === teamId);
```

### 3. Organization Link

```typescript
// Add to header
{team?.organization_id && (
  <Pressable
    onPress={() => router.push(`/organization?id=${team.organization_id}`)}
    style={styles.orgButton}
  >
    <Ionicons name="link" size={16} />
    <Text>View Organization</Text>
  </Pressable>
)}
```

---

## ANSWERS TO YOUR QUESTIONS

### "Are team and organization pages connected correctly?"

**NO** - Currently:

- ✗ team-page.tsx is a league view, not a team view
- ✗ No organization linking from team
- ✗ No separate organization page
- ✗ Roster shows mixed teams, not single team
- ✗ Feed logic doesn't filter by team

**What needs to happen:**

1. Rename/clarify: team-page should be TEAM VIEW (not league)
2. Create organization.tsx for organization view
3. Add org button from team → org
4. Fix data filtering to be team-specific
5. Sort schedule with today in middle

---

## PRIORITY FIXES

1. **CRITICAL**: Fix team-page to show only THIS team's data (not all teams in league)
2. **CRITICAL**: Fix roster to show only THIS team's members
3. **HIGH**: Add organization link button
4. **HIGH**: Fix schedule sorting (today in middle, scroll up=past, down=future)
5. **MEDIUM**: Improve feed to include team hashtags
6. **MEDIUM**: Create organization.tsx page

---

## FILES TO MODIFY

- [ ] `/app/team-page.tsx` - Fix team-specific data loading
- [ ] `/app/team-profile.tsx` - Add org link (if shown there too)
- [ ] Create `/app/organization.tsx` - New org page
- [ ] Check API entities for team/member structure

---

## NEXT STEPS

Want me to:

1. Fix team-page.tsx to be truly team-specific?
2. Create the organization.tsx page?
3. Implement the schedule sorting logic?
4. All of the above?
