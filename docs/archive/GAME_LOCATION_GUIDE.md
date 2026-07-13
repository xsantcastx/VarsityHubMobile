# Location & Map Features for Game Creation

## What Was Added

When creating a new game in VarsityHub, you now have **location and mapping options** that will automatically show the game on the discovery map!

---

## 🎯 Features

### 1. Location Field (Required)

- Enter the game venue or address
- Example: "Madison Square Garden, New York, NY"
- Example: "123 Main St, Los Angeles, CA 90001"
- Example: "Stanford Stadium"

### 2. Auto-Geocoding (Enabled by Default) ✨

When you check **"📍 Auto-find coordinates"**:

- The system automatically uses Google Maps to find the exact coordinates
- Happens when you save the game
- No manual work needed!
- Free for the first 200 games per month

**How it works:**

1. Enter location: "Wrigley Field, Chicago"
2. Check the auto-find checkbox (✓)
3. Save the game
4. System finds: `41.948376, -87.655334`
5. Game appears on the map! 🗺️

### 3. Manual Coordinates (Optional)

If you uncheck auto-geocoding, you can enter coordinates manually:

- **Latitude**: North/South position (e.g., `40.7505`)
- **Longitude**: East/West position (e.g., `-73.9934`)

**When to use manual:**

- You already know the exact coordinates
- The location name is ambiguous
- You want precise control

---

## 📱 User Flow

### Creating a Game with Location:

```
1. Go to "Manage Season" in your team
2. Tap "Add Game" → "Manual Entry"
3. Fill in game details:
   - Current Team: "My Team"
   - Opponent: "Rival Team"
   - Date & Time
   - Location: "Madison Square Garden, NYC" ✍️
4. See the checkbox:
   ☑️ Auto-find coordinates
   "Automatically add map coordinates using Google Maps"
5. Tap "Save"
6. ✅ Game created with coordinates!
7. Go to Discover → Map 🗺️
8. See your game marker on the map!
```

---

## 🎨 What It Looks Like

### Location Section in Add Game Modal:

```
┌─────────────────────────────────────────┐
│ Location *                              │
│ ┌─────────────────────────────────────┐ │
│ │ Enter game location/venue           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ☑️ 📍 Auto-find coordinates             │
│    Automatically add map coordinates    │
│    using Google Maps                    │
└─────────────────────────────────────────┘
```

### If You Uncheck Auto-Geocode:

```
┌─────────────────────────────────────────┐
│ Location *                              │
│ ┌─────────────────────────────────────┐ │
│ │ Madison Square Garden, NYC          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ☐ 📍 Auto-find coordinates              │
│    Automatically add map coordinates    │
│                                         │
│ Or enter coordinates manually:          │
│ ┌──────────────┐  ┌──────────────────┐ │
│ │ Latitude     │  │ Longitude        │ │
│ │ 40.7505      │  │ -73.9934         │ │
│ └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🗺️ Map Display

After creating games with locations:

### Discover Tab → Map View:

- See markers for all games with coordinates
- Red markers 🔴 = Games
- Teal markers 🔵 = Events
- Tap marker → See game details
- Tap callout → Navigate to game page

---

## 💡 Tips

### Best Practices:

✅ **Use full addresses**: "123 Main St, Los Angeles, CA 90001"
✅ **Include city & state**: "Stanford Stadium, Palo Alto, CA"
✅ **Famous venues work**: "Wrigley Field" or "Madison Square Garden"
✅ **Leave auto-geocode ON**: Easiest option!

### What to Avoid:

❌ Vague locations: "Home" or "Away"
❌ Just street names: "Main Street"
❌ No city/state: "The Stadium"

### Good Examples:

- "Madison Square Garden, New York, NY"
- "1600 Amphitheatre Parkway, Mountain View, CA"
- "Rose Bowl Stadium, Pasadena, CA"
- "123 Oak Street, Chicago, IL 60601"

---

## 🔧 Backend Magic

When you save a game with auto-geocoding enabled:

1. **Mobile app** sends game data to server with `autoGeocode: true`
2. **Server** receives the request
3. **Google Maps API** is called with the location
4. **Coordinates** are returned (latitude & longitude)
5. **Game** is saved with coordinates
6. **Associated Event** is created automatically
7. **Response** includes the coordinates
8. **Mobile app** updates and shows success

### Server Logs:

```
✅ Auto-geocoded game location: Madison Square Garden, NYC → 40.7505045, -73.9934387
POST /games 201 Created
```

---

## 🎯 Next Steps

### For Users:

1. **Create games** with locations
2. **Check the auto-geocode box** (it's on by default)
3. **View games on the map** in Discover tab

### For Existing Games:

If you have games without coordinates, run the batch geocoding script:

```bash
cd server
npx tsx scripts/geocode-all-games.ts
```

This will find coordinates for all existing games with locations!

---

## 📊 Cost

Google Maps Geocoding API:

- **First 200 requests/month**: FREE 🎉
- **After 200**: $0.005 per request (half a cent)
- **Example**: 1000 games = $4.00 total

Very affordable for most teams!

---

## 🐛 Troubleshooting

### Map shows no markers?

1. Check if games have a location entered
2. Verify auto-geocode was enabled when saving
3. Reload the app
4. Check server logs for geocoding errors

### "No Events with Locations" message?

- Games need coordinates to appear on map
- Run the batch geocoding script for existing games
- New games should auto-geocode when created

### Manual coordinates not working?

- Make sure you unchecked auto-geocode
- Latitude: -90 to 90
- Longitude: -180 to 180
- Use decimal format: 40.7505, not 40°45'01.8"N

---

## 🚀 Summary

You now have a complete location and mapping system!

**What You Can Do:**
✅ Add locations when creating games
✅ Auto-geocode addresses to coordinates
✅ Manually enter coordinates if needed
✅ View all games on an interactive map
✅ Tap markers to see game details

**What Happens Automatically:**
🤖 Games with locations get coordinates via Google Maps
🗺️ Games with coordinates appear on the discovery map
📍 Users can find games near them
🎯 Tapping markers navigates to game details

Enjoy your new mapping features! 🎉
