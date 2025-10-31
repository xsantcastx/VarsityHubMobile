# Event Creation Implementation - Summary

## 🎯 What Was Implemented

I've set up the foundation for your event creation system with home/away teams, maps integration, and team limits. Here's what's ready:

### ✅ **Phase 1: Database Schema (COMPLETED)**

**Updated Models:**
1. **Team Model** - Added:
   - Venue fields: `venue_place_id`, `venue_lat`, `venue_lng`, `venue_address`, `venue_updated_at`
   - Search/disambiguation: `city`, `state`, `league`
   - Relations: `homeGames`, `awayGames`

2. **Game Model** - Added:
   - Team relationships: `home_team_id`, `away_team_id` (with relations to Team model)
   - Venue fields: `venue_place_id`, `venue_address`, `venue_lat`, `venue_lng`
   - Legacy support: `away_team_name` (for manual opponent names)
   - Neutral site: `is_neutral` boolean

**Next Step:** Run database migration:
```bash
cd server
npx prisma migrate dev --name add_team_venues_and_home_away_games
npx prisma generate
```

---

### ✅ **Phase 2: Backend API (COMPLETED)**

**Updated `server/src/routes/teams.ts`:**

1. **Team Directory Search** (`GET /teams?directory=1&q=<query>`)
   - Searches across: name, city, state, league, sport
   - Returns venue data for auto-fill
   - Includes disambiguation info

2. **Team Creation with Limits** (`POST /teams/create`)
   - Checks Rookie plan limit (max 2 teams)
   - Returns error code `TEAM_LIMIT_EXCEEDED` when limit reached
   - Accepts venue fields: `city`, `state`, `league`, `venue_place_id`, `venue_lat`, `venue_lng`, `venue_address`

3. **Team Update with Venue** (`PUT /teams/:id`)
   - Supports updating all new fields (city, state, league, venue data)
   - Auto-updates `venue_updated_at` when venue changes

**Error Response Example (when limit exceeded):**
```json
{
  "error": "Team limit reached",
  "message": "You've reached your free limit (2 teams). Upgrade to add more.",
  "code": "TEAM_LIMIT_EXCEEDED",
  "limit": 2,
  "current": 2
}
```

---

### ✅ **Phase 3: Frontend Components (COMPLETED)**

**Created `components/TeamSearchInput.tsx`:**

**Features:**
- Type-ahead search with 300ms debouncing
- Directory search across all team fields
- Disambiguation display (City • State • League • Sport)
- Manual entry for opponents not in directory
- Deep linking to team pages (`/team/:id`)
- Clear button for easy reset
- Loading and error states

**Usage Example:**
```tsx
<TeamSearchInput
  label="Opponent"
  value={opponentName}
  onSelect={(team) => {
    setOpponentId(team?.id || null);
    setOpponentName(team?.name || '');
    // Auto-fill venue if team has one
    if (team?.venue) {
      setAwayVenue(team.venue);
    }
  }}
  placeholder="Search for opponent..."
  allowManualEntry={true}  // Allow typing custom name
  showDeepLink={true}      // Show "View Team Page" link
/>
```

---

### ✅ **Phase 4: Documentation (COMPLETED)**

**Created `EVENT_CREATION_IMPLEMENTATION.md`:**

This 500+ line comprehensive guide includes:
- Complete database schema changes
- All backend API endpoints and schemas
- Frontend component specifications
- Team limit enforcement logic
- Map integration patterns (iOS/Android)
- Validation rules
- Acceptance criteria checklist
- Testing plan
- Migration notes
- Future enhancements

---

## 🚧 What's Next (Remaining Work)

### **1. VenuePicker Component** (Priority: High)
Create `components/VenuePicker.tsx` with:
- Google Places Autocomplete
- Place ID, lat/lng, address storage
- Mini map preview
- "Open in Maps" button (platform-specific)
- Auto-fill from team's saved venue
- Read-only option for saved venues

**Dependencies Needed:**
```bash
npm install @react-native-google-places/google-places
npm install react-native-maps  # or use Static Map Image API
```

**Required ENV Variable:**
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

### **2. TeamLimitModal Component** (Priority: High)
Create `components/TeamLimitModal.tsx` with:
- Upgrade prompt UI
- Stripe checkout routing ($1.50/mo per extra team)
- "See Plans" button → `/billing`
- Failed attempt tracking (AsyncStorage)
- Auto-route to billing after 2 failed attempts

**Dependencies Needed:**
```bash
npm install @react-native-async-storage/async-storage
```

---

### **3. Update AddGameModal** (Priority: High)
Enhance `components/AddGameModal.tsx` with:
- Home/Away/Neutral toggle buttons
- TeamSearchInput for opponent
- VenuePicker for home venue (auto-fill from home team)
- VenuePicker for away venue (auto-fill from opponent)
- Validation: Require venue based on game type
- Save with new data structure (home_team_id, away_team_id, venue data)

---

### **4. Team Creation Limit Enforcement** (Priority: High)
Update `app/create-team.tsx`:
- Wrap create call in try/catch
- Check for `TEAM_LIMIT_EXCEEDED` error code
- Track attempts with AsyncStorage
- Show TeamLimitModal on error
- Auto-route to `/billing` after 2 attempts

**Same updates needed for:**
- Onboarding team creation step (if applicable)

---

### **5. GameDetailsScreen Updates** (Priority: Medium)
Update `app/game-details/GameDetailsScreen.tsx`:
- Make team names clickable → navigate to `/team/:id`
- Make venue address clickable → open native maps
- Platform-specific map URLs:
  - iOS: `maps:0,0?q=${address}`
  - Android: `geo:0,0?q=${lat},${lng}(${address})`

---

### **6. Backend Game Routes** (Priority: Medium)
Update `server/src/routes/games.ts`:
- Add schema fields: `home_team_id`, `away_team_id`, `away_team_name`, `venue_place_id`, `venue_lat`, `venue_lng`, `venue_address`, `is_neutral`
- Create endpoint: Accept new fields
- Update endpoint: Allow venue update if no saved team venue
- List endpoint: Return team relations and venue data

---

## 📋 Quick Start Checklist

Before you can test the full flow, complete these steps in order:

1. **Run Database Migration** (5 min)
   ```bash
   cd server
   npx prisma migrate dev --name add_team_venues_and_home_away_games
   npx prisma generate
   npm run dev  # Restart server to pick up new Prisma types
   ```

2. **Install Google Maps Dependencies** (5 min)
   ```bash
   npm install @react-native-google-places/google-places react-native-maps @react-native-async-storage/async-storage
   ```

3. **Add Google Maps API Key** (10 min)
   - Get key from Google Cloud Console
   - Add to `.env`: `GOOGLE_MAPS_API_KEY=your_key`
   - Enable Places API and Static Maps API

4. **Create VenuePicker Component** (1-2 hours)
   - See detailed spec in `EVENT_CREATION_IMPLEMENTATION.md`
   - Reference TeamSearchInput for UI patterns

5. **Create TeamLimitModal Component** (30 min)
   - Simple modal with buttons
   - AsyncStorage for attempt tracking
   - See spec in implementation doc

6. **Update AddGameModal** (1 hour)
   - Integrate TeamSearchInput
   - Integrate VenuePicker
   - Add home/away toggle
   - Update validation logic

7. **Update create-team.tsx** (20 min)
   - Add error handling for team limit
   - Integrate TeamLimitModal
   - Add attempt tracking

8. **Update Backend Game Routes** (30 min)
   - Add new schema fields
   - Update create/update endpoints

9. **Test End-to-End** (30 min)
   - Create team with venue
   - Create home game → verify venue auto-fills
   - Create away game with opponent search
   - Try creating 3rd team → verify limit modal
   - Click team names and venue in game details

---

## 🎨 UI/UX Patterns Established

All components follow consistent patterns:

1. **Color Scheme**: Uses `Colors[colorScheme]` for theming
2. **Icons**: Ionicons from `@expo/vector-icons`
3. **Modals**: Bottom sheet style with safe area insets
4. **Search**: Debounced (300ms) with loading states
5. **Errors**: Red text below inputs
6. **Empty States**: Centered icon + message
7. **Links**: Uses `router.push()` for navigation

---

## 🔍 Key Implementation Details

### **Team Limit Logic**
```typescript
// Check user's plan
const prefs = (user.preferences as any) || {};
const userPlan = prefs.plan || 'rookie';

// Rookie/Free: Max 2 teams
if (userPlan === 'rookie' || !userPlan || userPlan === 'free') {
  const ownedTeamsCount = await prisma.teamMembership.count({
    where: {
      user_id: userId,
      role: 'owner',
      status: 'active',
    },
  });
  
  if (ownedTeamsCount >= 2) {
    throw { code: 'TEAM_LIMIT_EXCEEDED', limit: 2, current: ownedTeamsCount };
  }
}
```

### **Venue Auto-Fill Logic**
```typescript
// When opponent is selected
onSelect={(team) => {
  if (team?.venue) {
    // Auto-fill away venue from opponent's saved venue
    setAwayVenue({
      place_id: team.venue.place_id,
      lat: team.venue.lat,
      lng: team.venue.lng,
      address: team.venue.address,
    });
  }
}}
```

### **Map Opening (Platform-Specific)**
```typescript
const openInMaps = (lat: number, lng: number, address: string) => {
  const scheme = Platform.select({
    ios: 'maps:0,0?q=',
    android: 'geo:0,0?q=',
  });
  const url = Platform.select({
    ios: `${scheme}${encodeURIComponent(address)}`,
    android: `${scheme}${lat},${lng}(${encodeURIComponent(address)})`,
  });
  Linking.openURL(url);
};
```

---

## 🐛 Known Issues to Address

1. **Backend Compile Errors**: Prisma types not regenerated yet
   - Fix: Run `npx prisma generate` after migration
   
2. **Team.list API**: Currently expects string, not object params
   - Fix: Update API wrapper or use query string format
   
3. **Color Scheme**: TeamSearchInput uses Colors.card (not cardBg)
   - Already fixed in latest version

---

## 📚 Reference Files

- **Schema**: `server/prisma/schema.prisma`
- **Teams API**: `server/src/routes/teams.ts`
- **Games API**: `server/src/routes/games.ts` (needs updates)
- **Team Search**: `components/TeamSearchInput.tsx`
- **Full Spec**: `EVENT_CREATION_IMPLEMENTATION.md`

---

## 💡 Tips for Implementation

1. **Start with VenuePicker**: It's the most complex component, but once done, everything flows naturally

2. **Test Incrementally**: After each component, test in isolation before integrating

3. **Use Existing Patterns**: TeamSearchInput is a great template for VenuePicker

4. **Google Maps Setup**: Get API key early - it can take time to enable APIs

5. **Team Limit Testing**: Test with actual user account to verify preferences.plan logic

---

## 🚀 Expected Timeline

- **VenuePicker**: 1-2 hours (includes Google Maps setup)
- **TeamLimitModal**: 30 minutes
- **AddGameModal Updates**: 1 hour
- **create-team.tsx Updates**: 20 minutes
- **Backend Game Routes**: 30 minutes
- **GameDetailsScreen Updates**: 20 minutes
- **Testing**: 30 minutes

**Total**: ~4-5 hours to complete all remaining work

---

## ✅ Success Criteria

When complete, users should be able to:

1. ✅ Create a team with a saved venue
2. ✅ Search for opponent teams in directory
3. ✅ See disambiguation for similar team names
4. ✅ Create home game → home venue auto-fills
5. ✅ Create away game → opponent's venue auto-fills
6. ✅ Manually enter opponent not in directory
7. ✅ Open Google Maps from venue address
8. ✅ Click team names to view team pages
9. ✅ Hit team limit → see upgrade modal
10. ✅ After 2 attempts → auto-route to billing

---

**Status**: Foundation Complete ✅  
**Next Step**: Run database migration, then create VenuePicker component  
**Documentation**: See `EVENT_CREATION_IMPLEMENTATION.md` for full specs

---

**Last Updated**: 2025-01-30  
**Completed By**: GitHub Copilot
