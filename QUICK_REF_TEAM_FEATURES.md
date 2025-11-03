# Quick Reference - Team & Game Features

## 🎯 5 Features Implemented

### 1. Home Team Location Auto-Save
**Team venue is automatically used when creating home games**
```javascript
// Team stores: venue_address, venue_lat, venue_lng, city, state
// Game creation auto-fills location from home_team_id
```

### 2. Google Maps Integration
**Automatic maps links for game venues**
```javascript
game.venue_maps_link
// → "https://google.com/maps/place/?q=place_id:..."
```

### 3. Opponent Team Linking
**Click opponent name → Go to their team page**
```javascript
game.awayTeam.profile_link
// → "/teams/team_456" (if exists) or null (manual name)
```

### 4. 2 Teams Free Limit
**Free users can create/own max 2 teams**
```javascript
GET /api/teams/limits
// Check before attempting creation
```

### 5. Upgrade Flow
**Blocked at 3rd team → Redirect to billing**
```javascript
if (error.upgrade_required) {
  navigate('/billing');
}
```

---

## 📡 Key API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/teams/limits` | Check team creation limits |
| `POST` | `/api/teams` | Create team (enforces limits) |
| `PUT` | `/api/teams/:id` | Update team + venue |
| `POST` | `/api/games` | Create game with teams |
| `GET` | `/api/games/:id/summary` | Get game with maps link |

---

## 🗄️ Database Fields

### User
- `subscription_tier` - "free" | "premium" | "pro"
- `max_teams` - Default: 2

### Team
- `venue_address` - Full address
- `venue_lat`, `venue_lng` - Coordinates
- `venue_place_id` - Google Place ID
- `city`, `state` - Location metadata

### Game
- `home_team_id` - Home team reference
- `away_team_id` - Away team reference (if in system)
- `away_team_name` - Manual opponent name
- `venue_*` - Venue location details

---

## ✅ Migration Applied

**Migration:** `20251103101628_add_subscription_and_team_limits`  
**Status:** ✅ Applied to production database  
**Tables Updated:** User, Team, Game

---

## 🎨 Frontend TODO

- [ ] Check `/api/teams/limits` before "Create Team" button
- [ ] Handle `upgrade_required` error → redirect to billing
- [ ] Add venue input in team settings (Google Places)
- [ ] Show "View on Maps" button in game details
- [ ] Make opponent names clickable (if profile_link exists)
- [ ] Create billing/upgrade page with Stripe

---

**Full Docs:** See `TEAM_GAME_FEATURES.md` and `IMPLEMENTATION_SUMMARY.md`
