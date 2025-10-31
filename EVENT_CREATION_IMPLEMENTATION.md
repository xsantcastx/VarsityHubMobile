# Event Creation with Home/Away Teams & Maps Integration

## Overview
Complete implementation guide for event creation system supporting home/away teams, venue management with Google Maps integration, and free tier team limits with upgrade prompts.

---

## Phase 1: Database Schema ✅ COMPLETED

### Updated Models

#### Team Model
```prisma
model Team {
  id          String   @id @default(cuid())
  name        String
  description String?
  logo_url    String?
  avatar_url  String?
  sport       String?
  season_start DateTime?
  season_end  DateTime?
  organization_id String?
  status      String   @default("active")
  
  // NEW: Venue information
  venue_place_id String?
  venue_lat      Float?
  venue_lng      Float?
  venue_address  String?
  venue_updated_at DateTime?
  
  // NEW: Metadata for search/disambiguation
  city           String?
  state          String?
  league         String?
  
  created_at  DateTime @default(now())

  organization Organization? @relation(fields: [organization_id], references: [id], onDelete: SetNull)
  memberships TeamMembership[]
  invites     TeamInvite[]
  groupChats  GroupChat[]
  
  // NEW: Game relations
  homeGames   Game[] @relation("home_games")
  awayGames   Game[] @relation("away_games")
  
  @@index([name])
  @@index([city, state])
  @@index([sport])
}
```

#### Game Model
```prisma
model Game {
  id              String   @id @default(cuid())
  title           String
  date            DateTime
  location        String?
  latitude        Float?
  longitude       Float?
  
  // NEW: Team relationships
  home_team_id    String?
  away_team_id    String?
  home_team       Team?    @relation("home_games", fields: [home_team_id], references: [id], onDelete: SetNull)
  away_team       Team?    @relation("away_games", fields: [away_team_id], references: [id], onDelete: SetNull)
  
  // NEW: Legacy support for manual opponent names
  away_team_name  String?
  
  // NEW: Venue information
  venue_place_id  String?
  venue_address   String?
  venue_lat       Float?
  venue_lng       Float?
  is_neutral      Boolean  @default(false)
  
  description     String?
  cover_image_url String?
  banner_url      String?
  appearance      String?
  created_at      DateTime @default(now())

  posts   Post[]
  stories Story[]
  events  Event[]
  votes   GameVote[]

  @@index([date])
  @@index([latitude, longitude])
  @@index([home_team_id])
  @@index([away_team_id])
}
```

### Migration Steps
```bash
cd server
npx prisma migrate dev --name add_team_venues_and_home_away_games
npx prisma generate
```

---

## Phase 2: Backend API Updates ✅ COMPLETED

### Teams Router (`server/src/routes/teams.ts`)

#### Team Directory Search
- **Endpoint**: `GET /teams?directory=1&q=<query>`
- **Features**:
  - Search across name, city, state, league, sport
  - Returns venue data if available
  - Includes city/league/sport for disambiguation

#### Create Team with Venue & Limit Check
- **Endpoint**: `POST /teams/create`
- **Schema**:
```typescript
{
  name: string;
  description?: string;
  sport?: string;
  season_start?: string;
  season_end?: string;
  organization_id?: string;
  logo_url?: string;
  city?: string;
  state?: string;
  league?: string;
  venue_place_id?: string;
  venue_lat?: number;
  venue_lng?: number;
  venue_address?: string;
  authorized_users?: Array<{
    email?: string;
    user_id?: string;
    role?: string;
    assign_team?: string;
  }>;
}
```
- **Team Limit Logic**:
  - Check user's `preferences.plan` (default: 'rookie')
  - Rookie/Free tier: Max 2 teams as owner
  - Returns error with code `TEAM_LIMIT_EXCEEDED` if limit reached
  - Error response:
```json
{
  "error": "Team limit reached",
  "message": "You've reached your free limit (2 teams). Upgrade to add more.",
  "code": "TEAM_LIMIT_EXCEEDED",
  "limit": 2,
  "current": 2
}
```

#### Update Team Venue
- **Endpoint**: `PUT /teams/:id`
- **New Fields**: city, state, league, venue_place_id, venue_lat, venue_lng, venue_address
- **Auto-updates**: venue_updated_at when venue_place_id changes

---

## Phase 3: Frontend Components

### 1. TeamSearchInput Component ✅ CREATED
**File**: `components/TeamSearchInput.tsx`

**Features**:
- Type-ahead search with debouncing (300ms)
- Directory search across name, city, league, sport
- Disambiguation display (city • state • league • sport)
- Manual entry option for opponents not in directory
- Deep linking to team pages (`/team/:id`)
- Clear button
- Error states
- Loading states

**Props**:
```typescript
interface TeamSearchInputProps {
  label: string;
  value: string;
  onSelect: (team: TeamOption | null) => void;
  placeholder?: string;
  allowManualEntry?: boolean;
  showDeepLink?: boolean;
  disabled?: boolean;
  error?: string;
}
```

**Usage Example**:
```tsx
<TeamSearchInput
  label="Opponent"
  value={opponentName}
  onSelect={(team) => {
    setOpponentId(team?.id || null);
    setOpponentName(team?.name || '');
    if (team?.venue) {
      // Auto-fill away venue
      setAwayVenue(team.venue);
    }
  }}
  placeholder="Search for opponent..."
  allowManualEntry={true}
  showDeepLink={true}
/>
```

### 2. VenuePicker Component 🚧 TO CREATE
**File**: `components/VenuePicker.tsx`

**Requirements**:
- Google Places Autocomplete integration
- Store: place_id, lat, lng, address
- Mini map preview using expo-location or react-native-maps
- "Open in Google Maps" button
- Auto-fill from team's saved venue
- Editable even if pre-filled
- Platform-specific map linking (iOS: Apple Maps, Android: Google Maps)

**Props**:
```typescript
interface VenuePickerProps {
  label: string;
  venue: {
    place_id: string;
    lat: number;
    lng: number;
    address: string;
  } | null;
  onChange: (venue: VenueData | null) => void;
  disabled?: boolean;
  error?: string;
  readOnly?: boolean; // For home team venue when team has saved venue
}
```

**Implementation Notes**:
- Use `@react-native-google-places/google-places` or Google Places API
- Requires Google Maps API key in `.env`
- Map preview can use:
  - `react-native-maps` for native maps
  - Static Map Image API for lightweight preview
  - expo-location for coordinate validation

**Map Linking**:
```typescript
const openInMaps = (lat: number, lng: number, address: string) => {
  const scheme = Platform.select({
    ios: 'maps:0,0?q=',
    android: 'geo:0,0?q=',
  });
  const url = Platform.select({
    ios: `${scheme}${address}`,
    android: `${scheme}${lat},${lng}(${address})`,
  });
  Linking.openURL(url);
};
```

### 3. TeamLimitModal Component 🚧 TO CREATE
**File**: `components/TeamLimitModal.tsx`

**Features**:
- Shows when user tries to create 3rd team on Rookie plan
- Displays current limit (2) and upgrade benefits
- Buttons:
  - **Upgrade**: Navigate to Stripe checkout (Veteran $1.50/mo per extra team)
  - **See Plans**: Navigate to `/billing` or plans screen
  - **Cancel**: Close modal
- Track failed attempts in localStorage/AsyncStorage
- After 2 failed attempts: Auto-route to upgrade page (skip modal)

**State Management**:
```typescript
// AsyncStorage key
const TEAM_LIMIT_ATTEMPTS_KEY = '@team_limit_attempts';

// Track attempts
const trackLimitAttempt = async () => {
  const attempts = await AsyncStorage.getItem(TEAM_LIMIT_ATTEMPTS_KEY);
  const count = attempts ? parseInt(attempts, 10) : 0;
  const newCount = count + 1;
  await AsyncStorage.setItem(TEAM_LIMIT_ATTEMPTS_KEY, newCount.toString());
  
  if (newCount >= 2) {
    // Auto-route to upgrade
    router.push('/billing');
    return true;
  }
  return false;
};
```

**Props**:
```typescript
interface TeamLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onSeePlans: () => void;
  currentCount: number;
  limit: number;
}
```

---

## Phase 4: Enhanced AddGameModal

### Updates to `components/AddGameModal.tsx`

#### New State
```typescript
const [gameType, setGameType] = useState<'home' | 'away' | 'neutral'>('home');
const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
const [homeTeamName, setHomeTeamName] = useState('');
const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
const [awayTeamName, setAwayTeamName] = useState('');
const [homeVenue, setHomeVenue] = useState<VenueData | null>(null);
const [awayVenue, setAwayVenue] = useState<VenueData | null>(null);
const [isNeutral, setIsNeutral] = useState(false);
```

#### Home/Away Toggle
```tsx
<View style={styles.toggleContainer}>
  <Pressable
    style={[styles.toggleButton, gameType === 'home' && styles.toggleButtonActive]}
    onPress={() => setGameType('home')}
  >
    <Text>Home Game</Text>
  </Pressable>
  <Pressable
    style={[styles.toggleButton, gameType === 'away' && styles.toggleButtonActive]}
    onPress={() => setGameType('away')}
  >
    <Text>Away Game</Text>
  </Pressable>
  <Pressable
    style={[styles.toggleButton, gameType === 'neutral' && styles.toggleButtonActive]}
    onPress={() => setGameType('neutral')}
  >
    <Text>Neutral Site</Text>
  </Pressable>
</View>
```

#### Home Team Section
```tsx
<TeamSearchInput
  label="Home Team"
  value={homeTeamName}
  onSelect={(team) => {
    setHomeTeamId(team?.id || null);
    setHomeTeamName(team?.name || '');
    if (team?.venue) {
      setHomeVenue(team.venue);
    }
  }}
  placeholder="Select home team..."
  showDeepLink={true}
/>

<VenuePicker
  label="Home Venue"
  venue={homeVenue}
  onChange={setHomeVenue}
  readOnly={homeVenue && homeTeamId ? true : false}
  error={errors.homeVenue}
/>
```

#### Away Team Section
```tsx
<TeamSearchInput
  label="Opponent (Away Team)"
  value={awayTeamName}
  onSelect={(team) => {
    setAwayTeamId(team?.id || null);
    setAwayTeamName(team?.name || '');
    if (team?.venue) {
      setAwayVenue(team.venue);
    }
  }}
  placeholder="Search for opponent..."
  allowManualEntry={true}
  showDeepLink={awayTeamId !== null}
/>

<VenuePicker
  label="Away Venue"
  venue={awayVenue}
  onChange={setAwayVenue}
  disabled={gameType !== 'away'}
  error={errors.awayVenue}
/>
```

#### Validation Logic
```typescript
const validateForm = (): boolean => {
  const newErrors: {[key: string]: string} = {};
  
  if (!homeTeamName.trim()) {
    newErrors.homeTeam = 'Home team is required';
  }
  
  if (!awayTeamName.trim()) {
    newErrors.awayTeam = 'Opponent is required';
  }
  
  if (!formData.date) {
    newErrors.date = 'Game date is required';
  }
  
  // Venue validation based on game type
  if (gameType === 'home') {
    if (!homeVenue) {
      newErrors.homeVenue = 'Home venue is required for home games';
    }
  } else if (gameType === 'away') {
    if (!awayVenue) {
      newErrors.awayVenue = 'Away venue is required for away games';
    }
  } else if (isNeutral) {
    if (!homeVenue && !awayVenue) {
      newErrors.venue = 'Neutral venue is required';
    }
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

#### Save Handler
```typescript
const handleSave = async () => {
  if (!validateForm()) return;
  
  const gameData: GameFormData = {
    home_team_id: homeTeamId,
    home_team_name: homeTeamName,
    away_team_id: awayTeamId,
    away_team_name: awayTeamName,
    date: formData.date,
    time: formData.time,
    is_neutral: isNeutral,
    venue_place_id: gameType === 'home' ? homeVenue?.place_id : awayVenue?.place_id,
    venue_lat: gameType === 'home' ? homeVenue?.lat : awayVenue?.lat,
    venue_lng: gameType === 'home' ? homeVenue?.lng : awayVenue?.lng,
    venue_address: gameType === 'home' ? homeVenue?.address : awayVenue?.address,
    // ... other fields
  };
  
  onSave(gameData);
};
```

---

## Phase 5: Team Creation Limit Enforcement

### Update `app/create-team.tsx`

#### Check Team Count Before Creation
```typescript
const handleCreateTeam = async () => {
  setSubmitting(true);
  
  try {
    // Attempt to create team
    const team = await Team.create(teamData);
    Alert.alert('Success', 'Team created successfully!');
    router.back();
  } catch (e: any) {
    if (e?.code === 'TEAM_LIMIT_EXCEEDED') {
      // Track attempt
      const shouldAutoRoute = await trackLimitAttempt();
      
      if (shouldAutoRoute) {
        // Already auto-routed to /billing
        return;
      }
      
      // Show upgrade modal
      setShowUpgradeModal(true);
      setLimitError(e);
    } else {
      Alert.alert('Error', e?.message || 'Failed to create team. Please try again.');
    }
  } finally {
    setSubmitting(false);
  }
};
```

#### Upgrade Modal Integration
```tsx
<TeamLimitModal
  visible={showUpgradeModal}
  onClose={() => setShowUpgradeModal(false)}
  onUpgrade={() => {
    setShowUpgradeModal(false);
    router.push('/billing?upgrade=veteran');
  }}
  onSeePlans={() => {
    setShowUpgradeModal(false);
    router.push('/billing');
  }}
  currentCount={limitError?.current || 2}
  limit={limitError?.limit || 2}
/>
```

### Update Onboarding Step (if team creation in onboarding)

**File**: `app/onboarding/step-6-team.tsx` (or equivalent)

Same logic as above - check for limit, show modal, track attempts.

---

## Phase 6: GameDetailsScreen Updates

### Add Deep Links and Map Links

**File**: `app/game-details/GameDetailsScreen.tsx`

#### Team Name Links
```tsx
<Pressable onPress={() => router.push(`/team/${game.home_team_id}`)}>
  <Text style={styles.teamName}>{game.home_team_name}</Text>
</Pressable>

{game.away_team_id ? (
  <Pressable onPress={() => router.push(`/team/${game.away_team_id}`)}>
    <Text style={styles.teamName}>{game.away_team_name}</Text>
  </Pressable>
) : (
  <Text style={styles.teamName}>{game.away_team_name}</Text>
)}
```

#### Venue Map Link
```tsx
{game.venue_address && (
  <Pressable
    style={styles.venueContainer}
    onPress={() => openInMaps(game.venue_lat, game.venue_lng, game.venue_address)}
  >
    <Ionicons name="location" size={16} color={Colors[colorScheme].link} />
    <Text style={[styles.venueText, { color: Colors[colorScheme].link }]}>
      {game.venue_address}
    </Text>
    <Ionicons name="open-outline" size={14} color={Colors[colorScheme].link} />
  </Pressable>
)}
```

---

## Phase 7: Backend Game Creation Updates

### Update `server/src/routes/games.ts`

#### Create Game Endpoint
```typescript
const createGameSchema = z.object({
  title: z.string().min(1),
  date: z.string(),
  home_team_id: z.string().optional(),
  away_team_id: z.string().optional(),
  away_team_name: z.string().optional(),
  venue_place_id: z.string().optional(),
  venue_lat: z.number().optional(),
  venue_lng: z.number().optional(),
  venue_address: z.string().optional(),
  is_neutral: z.boolean().optional(),
  description: z.string().optional(),
  banner_url: z.string().optional(),
  appearance: z.string().optional(),
});

gamesRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  }
  
  const data = parsed.data;
  
  const game = await prisma.game.create({
    data: {
      title: data.title,
      date: new Date(data.date),
      home_team_id: data.home_team_id,
      away_team_id: data.away_team_id,
      away_team_name: data.away_team_name,
      venue_place_id: data.venue_place_id,
      venue_lat: data.venue_lat,
      venue_lng: data.venue_lng,
      venue_address: data.venue_address,
      is_neutral: data.is_neutral || false,
      description: data.description,
      banner_url: data.banner_url,
      appearance: data.appearance,
    },
  });
  
  return res.status(201).json(game);
});
```

#### Update Game Endpoint
```typescript
gamesRouter.put('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  // Similar to create, but with validation for ownership/permissions
  // Allow updating venue if home team has no saved venue
});
```

---

## Acceptance Criteria Checklist

### Event Creation
- [ ] Creating a home game auto-prefills home venue from team's saved venue
- [ ] Creating an away game auto-prefills away venue from opponent's saved venue
- [ ] Both home and away venues show "Open in Maps" link
- [ ] Neutral site option enables venue input independent of both teams
- [ ] Venue is editable even if pre-filled
- [ ] If home team has no saved venue, allow manual venue entry and save to team profile

### Opponent Selection
- [ ] Opponent field supports type-ahead search across team directory
- [ ] Search results show disambiguation (city, league, sport)
- [ ] If team exists in directory, show "View Team Page" deep link
- [ ] If no match, allow manual opponent name entry
- [ ] Selecting opponent auto-fills venue if available

### Team Limits
- [ ] Users on Rookie/Free tier cannot create a 3rd team
- [ ] Attempting to create 3rd team shows upgrade modal with:
  - Clear message: "You've reached your free limit (2 teams). Upgrade to add more."
  - Upgrade button ($1.50/mo per extra team)
  - See Plans button
  - Cancel button
- [ ] After two failed attempts, auto-route to billing/upgrade page (skip modal)
- [ ] Team limit check happens both in:
  - Standalone team creation (`/create-team`)
  - Onboarding team creation step

### Deep Links & Maps
- [ ] Team names in game details link to team pages
- [ ] Venue address in game details opens native maps app
- [ ] iOS: Opens Apple Maps
- [ ] Android: Opens Google Maps
- [ ] Map link includes lat/lng and address for accurate navigation

### Validation
- [ ] Home team required
- [ ] Opponent (away team) required
- [ ] Date and time required
- [ ] Venue required based on game type:
  - Home game: Home venue required
  - Away game: Away venue required
  - Neutral: Either venue required
- [ ] Show error message: "Add venue to publish event" if missing

---

## Environment Setup

### Required ENV Variables
```env
# Google Maps API Key (for Places Autocomplete and Static Maps)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Stripe (for upgrade billing)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Pricing
VETERAN_PLAN_PRICE_ID=price_veteran_team_addon
VETERAN_TEAM_ADDON_PRICE=150  # $1.50 in cents
```

### Install Dependencies
```bash
# Frontend
npm install @react-native-google-places/google-places
npm install react-native-maps
npm install @react-native-async-storage/async-storage

# Backend (already installed)
# zod, prisma, express
```

---

## Testing Plan

### Unit Tests
- [ ] TeamSearchInput: Search, select, manual entry, deep link
- [ ] VenuePicker: Places autocomplete, map preview, Open in Maps
- [ ] TeamLimitModal: Display, button actions, attempt tracking

### Integration Tests
- [ ] Create home game → home venue auto-fills
- [ ] Create away game → away venue auto-fills
- [ ] Create neutral game → both venues available
- [ ] Search opponent → select → venue auto-fills
- [ ] Team creation limit → modal → upgrade routing
- [ ] 2 failed attempts → auto-route to billing

### E2E Tests
- [ ] Full game creation flow (home game with opponent search)
- [ ] Team creation on Rookie plan (2 teams max)
- [ ] 3rd team attempt → upgrade → Stripe checkout

---

## Migration Notes

### Data Migration (Optional)
If you have existing games with `home_team` and `away_team` string fields, migrate to new schema:

```sql
-- Example migration (run after schema update)
UPDATE "Game" 
SET home_team_name = home_team, 
    away_team_name = away_team
WHERE home_team IS NOT NULL OR away_team IS NOT NULL;
```

### Backward Compatibility
- Keep `away_team_name` field for manual opponent entries
- Frontend should check both `away_team_id` and `away_team_name`
- Display team name from relationship if `away_team_id` exists, else use `away_team_name`

---

## Future Enhancements

1. **Venue Photos**: Show Google Places photos in VenuePicker
2. **Recurring Games**: Bulk create games for entire season
3. **Team Roster Integration**: Link players to teams for lineup management
4. **Game Reminders**: Push notifications for upcoming games
5. **Venue Favorites**: Save frequently used venues
6. **Advanced Search**: Filter teams by sport, league, location radius
7. **Team Verification**: Badge for verified teams in directory
8. **Multi-Team Tournaments**: Support for tournament brackets with 4+ teams

---

## Support & Documentation

- **Prisma Schema**: `server/prisma/schema.prisma`
- **Teams API**: `server/src/routes/teams.ts`
- **Games API**: `server/src/routes/games.ts`
- **Team Search Component**: `components/TeamSearchInput.tsx`
- **Venue Picker Component**: `components/VenuePicker.tsx` (to be created)
- **Team Limit Modal**: `components/TeamLimitModal.tsx` (to be created)
- **Game Creation Modal**: `components/AddGameModal.tsx`
- **Game Details Screen**: `app/game-details/GameDetailsScreen.tsx`

---

## Implementation Status

✅ **Completed**:
- Prisma schema updates (Team venue, Game home/away teams)
- Backend API: Team directory search, venue updates, team limit check
- TeamSearchInput component with search, disambiguation, deep linking

🚧 **In Progress**:
- VenuePicker component (Google Places integration)
- TeamLimitModal component
- AddGameModal enhancements

📋 **Pending**:
- Backend game creation route updates
- GameDetailsScreen deep links and map links
- Team creation screen limit enforcement
- Onboarding team creation limit enforcement
- E2E testing

---

**Last Updated**: 2025-01-30
**Author**: GitHub Copilot
**Version**: 1.0
