# Coach Onboarding Enhancement - Implementation Plan

## ✅ Completed

### 1. Updated Plan Pricing
- **Rookie**: Free for 2 teams (e.g., Girls & Boys Soccer)
- **Veteran**: $1.50/month per team after first 2
- **Legend**: $29.99/year for unlimited teams/clubs

### 2. Zip Code Mandatory for Coaches
- Made zip code a required field when role = 'coach'
- Shows "Required for coaches" placeholder
- Validation prevents continuing without zip code

### 3. Improved Affiliation Buttons
- Changed from segmented control to grid layout
- Added icons for each affiliation type:
  - ❌ None
  - 🎓 University
  - 🏫 High School
  - ⚽ Club
  - 👶 Youth
- Better spacing and visual feedback
- 2-column grid layout that wraps properly

---

## 🚧 To Be Implemented

### 4. Team Color Selection
**Location**: `app/onboarding/step-5-league.tsx` (Team Creation Form)

**Requirements**:
- Add color picker during team creation
- Primary team color selection
- Optional: Secondary color
- Store in team preferences/settings

**Implementation Steps**:
1. Add color picker component (could use `react-native-color-picker` or custom picker)
2. Add `teamColor` field to team creation form
3. Update Team model in backend to include `primary_color` field
4. Save color preference with team creation
5. Use color in team branding/display throughout app

**Database Changes**:
```sql
ALTER TABLE teams ADD COLUMN primary_color VARCHAR(7); -- e.g., #FF5733
ALTER TABLE teams ADD COLUMN secondary_color VARCHAR(7); -- optional
```

---

### 5. School Organization Join Prompt
**Location**: `app/onboarding/step-5-league.tsx` or new step after team creation

**Requirements**:
- After coach creates team, check if school organization exists
- If exists: Prompt to join existing organization
- If doesn't exist: Prompt to create organization page
- First user to a school can create the organization page

**Implementation Steps**:

#### A. Check for Existing Organization
```typescript
// After team creation, check for school orgs
const checkSchoolOrganization = async (schoolName: string, zipCode: string) => {
  // API call to search organizations by school name + zip
  const existingOrgs = await Organization.search({
    name: schoolName,
    zip_code: zipCode,
    type: 'school'
  });
  
  if (existingOrgs.length > 0) {
    // Show join prompt
    showJoinOrganizationPrompt(existingOrgs[0]);
  } else {
    // Show create prompt
    showCreateOrganizationPrompt(schoolName);
  }
};
```

#### B. Join Existing Organization
```typescript
const joinOrganization = async (orgId: string, teamId: string) => {
  await Organization.requestMembership({
    organization_id: orgId,
    team_id: teamId,
    role: 'member' // or 'coach'
  });
  
  Alert.alert('Request Sent', 'Your request to join the organization has been sent to the admin.');
};
```

#### C. Create New Organization
```typescript
const createOrganization = async (schoolName: string) => {
  const org = await Organization.create({
    name: `${schoolName} Athletics`,
    type: 'school',
    zip_code: zipCode,
    creator_team_id: teamId,
  });
  
  // Automatically join as admin since you're the first
  await Organization.addTeam(org.id, teamId, { role: 'admin' });
  
  Alert.alert('Organization Created', `You're now the admin of ${schoolName} Athletics!`);
};
```

**Database Changes**:
```sql
-- Organization table
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'school', -- school, club, league
  zip_code TEXT,
  logo_url TEXT,
  banner_url TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization membership
CREATE TABLE IF NOT EXISTS organization_teams (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  team_id TEXT REFERENCES teams(id),
  role TEXT DEFAULT 'member', -- admin, member
  status TEXT DEFAULT 'active', -- active, pending, removed
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, team_id)
);
```

**API Endpoints Needed**:
- `GET /organizations/search?name=&zip_code=&type=` - Search for organizations
- `POST /organizations` - Create new organization
- `POST /organizations/:id/teams` - Add team to organization
- `POST /organizations/:id/join-request` - Request to join organization
- `GET /organizations/:id/teams` - Get teams in organization

---

### 6. Game Event Syncing/Merging
**Location**: Game creation logic

**Requirements**:
- When two teams both create an event for the same game
- Automatically merge if they match by location, date, and teams
- Determined by location proximity + date + team names

**Implementation Steps**:

#### A. Game Matching Algorithm
```typescript
const findMatchingGame = async (newGame: GameData) => {
  // Find games within time window (same day ± 2 hours)
  const potentialMatches = await prisma.game.findMany({
    where: {
      date: {
        gte: new Date(newGame.date.getTime() - 2 * 60 * 60 * 1000), // -2 hours
        lte: new Date(newGame.date.getTime() + 2 * 60 * 60 * 1000), // +2 hours
      },
      latitude: { not: null },
      longitude: { not: null },
    }
  });
  
  // Check location proximity (within 1 mile / 1.6km)
  for (const game of potentialMatches) {
    const distance = calculateDistance(
      newGame.latitude, newGame.longitude,
      game.latitude, game.longitude
    );
    
    if (distance < 1.6) { // km
      // Check if teams match (either home/away combination)
      if (teamsMatch(newGame, game)) {
        return game; // Found a match!
      }
    }
  }
  
  return null;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  // Haversine formula for distance between two coordinates
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

const teamsMatch = (game1: GameData, game2: GameData) => {
  const teams1 = [game1.home_team?.toLowerCase(), game1.away_team?.toLowerCase()];
  const teams2 = [game2.home_team?.toLowerCase(), game2.away_team?.toLowerCase()];
  
  // Check if both teams appear in both games (in any order)
  return teams1.every(team => teams2.includes(team || ''));
};
```

#### B. Merge Games
```typescript
const mergeGames = async (existingGameId: string, newGameData: GameData) => {
  // Don't create new game, link to existing one instead
  await prisma.gameParticipation.create({
    data: {
      game_id: existingGameId,
      team_id: newGameData.team_id,
      role: 'participant',
      confirmed: true,
    }
  });
  
  // Notify both teams about the merge
  await Notification.create({
    type: 'game_merged',
    game_id: existingGameId,
    message: `Your game has been linked with ${newGameData.opponent}`,
  });
  
  return existingGameId;
};
```

#### C. Game Creation with Merge Check
```typescript
// In POST /games route
const createGame = async (req, res) => {
  const gameData = req.body;
  
  // If game has coordinates, check for duplicates
  if (gameData.latitude && gameData.longitude) {
    const matchingGame = await findMatchingGame(gameData);
    
    if (matchingGame) {
      // Merge instead of creating new
      const mergedGameId = await mergeGames(matchingGame.id, gameData);
      return res.json({
        id: mergedGameId,
        merged: true,
        message: 'Game matched with existing event'
      });
    }
  }
  
  // No match found, create new game
  const newGame = await prisma.game.create({ data: gameData });
  return res.json({ ...newGame, merged: false });
};
```

**Database Changes**:
```sql
-- Track which teams are participating in a game
CREATE TABLE IF NOT EXISTS game_participations (
  id TEXT PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  team_id TEXT REFERENCES teams(id),
  role TEXT DEFAULT 'participant', -- host, participant, spectator
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, team_id)
);

-- Track game merge history
CREATE TABLE IF NOT EXISTS game_merges (
  id TEXT PRIMARY KEY,
  primary_game_id TEXT REFERENCES games(id),
  merged_game_id TEXT REFERENCES games(id),
  merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**API Endpoints Needed**:
- `POST /games` - Modified to include merge detection
- `GET /games/:id/participants` - Get teams participating in game
- `POST /games/:id/confirm-participation` - Confirm team participation

---

## 📱 UI/UX Considerations

### Team Color Picker
- Show preview of team with selected colors
- Provide preset color palettes (common school colors)
- Allow custom color picker for advanced users

### Organization Join Flow
```
After Team Creation
    ↓
Check for School Org
    ↓
    ├─→ Org Exists
    │       ↓
    │   [Join Existing Organization?]
    │   └─→ Yes → Send Join Request
    │   └─→ No → Continue
    │
    └─→ Org Doesn't Exist
            ↓
        [Create Organization Page?]
        └─→ Yes → Create & Become Admin
        └─→ No → Continue
```

### Game Merge Notification
```
When Creating Game:
- Checking for duplicate events...
- Found matching game!
  "Patriots vs Cowboys at AT&T Stadium on Nov 25"
  
  [Link to This Game] [Create Separate]
  
If Linked:
- "✓ Your team has been added to the game"
- "Both teams will now see this game"
```

---

## 🔧 Technical Requirements

### Dependencies
- Color picker: Consider `react-native-color-picker` or custom solution
- Distance calculation: Haversine formula (already shown above)
- Organization management: New API routes and database tables

### Backend Routes Summary
```
Organizations:
  GET    /organizations/search
  POST   /organizations
  GET    /organizations/:id
  POST   /organizations/:id/teams
  GET    /organizations/:id/teams
  POST   /organizations/:id/join-request
  
Games:
  POST   /games (modified with merge detection)
  GET    /games/:id/participants
  POST   /games/:id/confirm-participation
  
Teams:
  PATCH  /teams/:id (add primary_color, secondary_color)
```

---

## 📋 Priority Order

1. **HIGH**: Team Color Selection (cosmetic, easy to implement)
2. **HIGH**: School Organization Prompt (important for community building)
3. **MEDIUM**: Organization Search & Join
4. **MEDIUM**: Organization Creation (first user)
5. **LOW**: Game Merge Detection (nice-to-have, complex)

---

## 🎯 Next Steps

Would you like me to implement any of these features now? I recommend starting with:

1. **Team Color Selection** - Simplest, immediate visual impact
2. **School Organization Database Schema** - Foundation for org features
3. **Organization Search API** - Enable finding existing schools

Let me know which feature you'd like to tackle first!
