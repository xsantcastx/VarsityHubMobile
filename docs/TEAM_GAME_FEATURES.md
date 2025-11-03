# Team & Game Management Features

## Overview
This document outlines the new features implemented for team and game management, including location tracking, Google Maps integration, team linking, and subscription-based team limits.

---

## 🏠 1. Home Team Location Auto-Save

### Backend Implementation
When a team is created or updated, the system automatically stores location data:

**Team Model Fields:**
- `city` - City where the team is based
- `state` - State/province of the team
- `venue_address` - Full address of the home venue
- `venue_lat` / `venue_lng` - Geographic coordinates
- `venue_place_id` - Google Maps Place ID for precise location
- `venue_updated_at` - Timestamp of last venue update

**How It Works:**
1. When creating/editing a team, coaches can set the venue location
2. This location is saved to the Team record
3. When creating a game for that team, the venue location is automatically used as the default game location

**API Endpoint:**
```
PUT /api/teams/:id
Body: {
  "venue_address": "123 Stadium Drive, City, State",
  "venue_lat": 40.7128,
  "venue_lng": -74.0060,
  "venue_place_id": "ChIJOwg...",
  "city": "New York",
  "state": "NY"
}
```

---

## 🗺️ 2. Google Maps Integration for Away Games

### Automatic Maps Links
When typing an opponent's location (or selecting an opponent team), the system automatically generates a Google Maps link.

**Implementation Details:**

**Helper Function:**
```typescript
generateMapsLink(location, lat, lng, placeId)
```

**Priority Order:**
1. **Place ID** (most accurate) → `https://google.com/maps/place/?q=place_id:XXXX`
2. **Coordinates** → `https://google.com/maps/search/?api=1&query=LAT,LNG`
3. **Location text** → `https://google.com/maps/search/?api=1&query=LOCATION`

**Game Response Fields:**
- `venue_maps_link` - Direct Google Maps link for the venue
- `venue_address` - Formatted address
- `venue_lat` / `venue_lng` - Coordinates for precise mapping

**Frontend Usage:**
```javascript
// Display clickable map link in game details
if (game.venue_maps_link) {
  <a href={game.venue_maps_link} target="_blank">
    View Location on Google Maps
  </a>
}
```

---

## 🔗 3. Opponent Team Page Linking

### Automatic Team Profile Links
If an opponent team exists in the system, clicking their name links to their profile page.

**Game Model Fields:**
- `home_team_id` - Reference to home team (if in system)
- `away_team_id` - Reference to away team (if in system)
- `away_team_name` - Manual opponent name (if NOT in system)

**API Response Structure:**
```json
{
  "homeTeam": {
    "id": "team_123",
    "name": "Warriors",
    "profile_link": "/teams/team_123"
  },
  "awayTeam": {
    "id": "team_456",
    "name": "Lakers",
    "profile_link": "/teams/team_456"
  }
}
```

**Manual Opponent (No Profile):**
```json
{
  "awayTeam": {
    "name": "Barcelona FC",
    "profile_link": null
  }
}
```

**Frontend Implementation:**
```javascript
// Render opponent name with conditional linking
{game.awayTeam.profile_link ? (
  <Link to={game.awayTeam.profile_link}>
    {game.awayTeam.name}
  </Link>
) : (
  <Text>{game.awayTeam.name}</Text>
)}
```

---

## ⚙️ 4. Free Team Limit (2 Teams Max)

### Subscription Tiers
Users are limited by their subscription tier:

**User Model Fields:**
- `subscription_tier` - `"free"`, `"premium"`, or `"pro"`
- `subscription_status` - `"active"`, `"cancelled"`, or `"expired"`
- `max_teams` - Number of teams user can own (default: 2)
- `subscription_expires_at` - When subscription ends
- `stripe_customer_id` - For payment processing

**Default Limits:**
- **Free**: 2 teams
- **Premium**: 10 teams (configurable)
- **Pro**: Unlimited (999)

**Team Creation Validation:**
```typescript
// Check team limit before creation
const ownedTeamsCount = await prisma.teamMembership.count({
  where: {
    user_id: userId,
    role: 'owner',
    status: 'active'
  }
});

if (ownedTeamsCount >= user.max_teams) {
  return res.status(403).json({
    error: 'Team limit reached',
    upgrade_required: true
  });
}
```

**API Endpoint to Check Limits:**
```
GET /api/teams/limits

Response:
{
  "owned_teams": 2,
  "max_teams": 2,
  "can_create_more": false,
  "remaining": 0,
  "subscription_tier": "free",
  "upgrade_required": true
}
```

---

## 💳 5. Upgrade Flow

### When User Hits Team Limit
When a user tries to create a 3rd team (or exceeds their limit), the system:

1. **Blocks Team Creation**
2. **Returns Upgrade Required Response**
3. **Frontend Redirects to Upgrade Page**

**Error Response Structure:**
```json
{
  "error": "Team limit reached",
  "message": "You've reached your limit of 2 teams. Upgrade to create more teams.",
  "owned_teams": 2,
  "max_teams": 2,
  "upgrade_required": true
}
```

**Frontend Handling:**
```javascript
// On team creation attempt
try {
  const response = await createTeam(teamData);
} catch (error) {
  if (error.upgrade_required) {
    // Redirect to upgrade page
    navigation.navigate('Billing', { 
      reason: 'team_limit',
      message: error.message 
    });
  }
}
```

**Recommended Upgrade Page Route:**
- `/billing` or `/upgrade`
- Display subscription tiers with benefits
- Integrate Stripe checkout for payment
- Update `subscription_tier` and `max_teams` on successful payment

---

## 📡 API Endpoints Summary

### Teams
```
GET    /api/teams/limits          # Check team creation limits
GET    /api/teams/managed         # Get teams managed by user
POST   /api/teams                 # Create team (enforces limits)
PUT    /api/teams/:id             # Update team (includes venue)
DELETE /api/teams/:id             # Delete team
```

### Games
```
GET    /api/games                 # List all games
GET    /api/games/:id/summary     # Get game with teams & maps link
POST   /api/games                 # Create game
```

**Create Game Request:**
```json
{
  "title": "Warriors vs Lakers",
  "home_team_id": "team_123",
  "away_team_id": "team_456",
  "away_team_name": "Lakers",
  "date": "2025-11-10T19:00:00Z",
  "location": "Madison Square Garden",
  "venue_place_id": "ChIJhRwB...",
  "venue_lat": 40.7505,
  "venue_lng": -73.9934,
  "is_neutral": false
}
```

**Game Response:**
```json
{
  "id": "game_789",
  "title": "Warriors vs Lakers",
  "homeTeam": {
    "id": "team_123",
    "name": "Warriors",
    "profile_link": "/teams/team_123"
  },
  "awayTeam": {
    "id": "team_456",
    "name": "Lakers",
    "profile_link": "/teams/team_456"
  },
  "venue_maps_link": "https://google.com/maps/place/?q=place_id:ChIJhRwB...",
  "location": "Madison Square Garden",
  "date": "2025-11-10T19:00:00.000Z"
}
```

---

## 🚀 Frontend Implementation Checklist

### Team Creation Flow
- [ ] Check `/api/teams/limits` before showing create form
- [ ] Display "X of Y teams used" in UI
- [ ] Handle 403 error with `upgrade_required: true`
- [ ] Redirect to billing page when limit reached
- [ ] Show upgrade prompt with benefits

### Team Profile/Settings
- [ ] Add venue address input field
- [ ] Integrate Google Places Autocomplete
- [ ] Save `venue_place_id`, `venue_lat`, `venue_lng`, `venue_address`
- [ ] Display "Home Venue" section on team page

### Game Creation
- [ ] Dropdown to select home team (auto-fills location)
- [ ] Dropdown to select away team (if in system) OR text input for manual name
- [ ] Show Google Maps preview for venue
- [ ] Include `home_team_id`, `away_team_id`, `away_team_name` in request

### Game Details View
- [ ] Make team names clickable (if `profile_link` exists)
- [ ] Display "View on Google Maps" button with `venue_maps_link`
- [ ] Show opponent name as plain text if no profile exists

### Billing/Upgrade Page
- [ ] Display subscription tiers (Free, Premium, Pro)
- [ ] Show benefits: "Create up to 10 teams" for Premium
- [ ] Stripe checkout integration
- [ ] Update user subscription after payment

---

## 🔒 Database Migration

**Migration Name:** `20251103101628_add_subscription_and_team_limits`

**Changes:**
- Added `subscription_tier`, `subscription_status`, `subscription_expires_at`, `stripe_customer_id`, `max_teams` to `User`
- Added `venue_address`, `venue_lat`, `venue_lng`, `venue_place_id`, `city`, `state` to `Team`
- Added `home_team_id`, `away_team_id`, `away_team_name`, `venue_*` fields to `Game`
- Added foreign keys for `Game.home_team_id` and `Game.away_team_id`

**Applied:** ✅ Migration successfully applied to production database

---

## 📝 Testing Checklist

### Team Limits
- [ ] Create 2 teams as free user → Success
- [ ] Try to create 3rd team → Blocked with upgrade message
- [ ] Upgrade to premium → Can create more teams
- [ ] Check `/api/teams/limits` returns correct counts

### Location & Maps
- [ ] Create team with venue address → Saves correctly
- [ ] Create game with home team → Auto-fills location
- [ ] View game → Google Maps link works
- [ ] Manual opponent name → No profile link shown

### Team Linking
- [ ] Create game with existing opponent team → Shows profile link
- [ ] Click opponent name → Navigates to team page
- [ ] Create game with manual opponent → Name shown without link

---

## 🎯 Future Enhancements

1. **Google Places API Integration**
   - Autocomplete for venue addresses
   - Fetch stadium photos automatically
   - Validate addresses in real-time

2. **Advanced Subscription Features**
   - Team transfer (change owner)
   - Subscription expiration warnings
   - Grace period for expired subscriptions

3. **Enhanced Maps Features**
   - Directions from user's location
   - Nearby parking/amenities
   - Traffic updates on game day

4. **Team Discovery**
   - Search opponents by location
   - Suggest teams in same league/division
   - Auto-link based on name matching

---

## 🐛 Troubleshooting

### Team Creation Fails
1. Check user's `max_teams` field in database
2. Verify `owned_teams` count is accurate
3. Check for orphaned team memberships

### Maps Link Not Working
1. Verify `venue_place_id` is valid Google Place ID
2. Check coordinates are in valid range (-90 to 90 lat, -180 to 180 lng)
3. Ensure location string is properly URL-encoded

### Opponent Not Linking
1. Confirm `away_team_id` exists in database
2. Check team has `id` and `name` fields
3. Verify foreign key relationship is set correctly

---

**Last Updated:** November 3, 2025  
**Migration Version:** 20251103101628  
**Status:** ✅ Fully Implemented & Deployed
