# Quick Test Commands

## Setup

```bash
cd server
npm install expo-server-sdk
npm run build  # or npm run dev
```

## Test Endpoints (Development Only)

### 1. Check Push Token

```bash
curl http://localhost:4000/test-notifications/test/check-token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Send Test Notification

```bash
curl -X POST http://localhost:4000/test-notifications/test/push \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Notification Types

```bash
# Message notification
curl -X POST http://localhost:4000/test-notifications/test/simulate/message \
  -H "Authorization: Bearer YOUR_TOKEN"

# Like notification
curl -X POST http://localhost:4000/test-notifications/test/simulate/like \
  -H "Authorization: Bearer YOUR_TOKEN"

# Comment notification
curl -X POST http://localhost:4000/test-notifications/test/simulate/comment \
  -H "Authorization: Bearer YOUR_TOKEN"

# Follow notification
curl -X POST http://localhost:4000/test-notifications/test/simulate/follow \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Geofencing

```bash
# Check if location is within geofence
curl -X POST http://localhost:4000/test-notifications/test/geofence \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "YOUR_EVENT_ID",
    "lat": 34.0522,
    "lng": -118.2437
  }'
```

### 5. Calculate Distance

```bash
curl -X POST http://localhost:4000/test-notifications/test/distance \
  -H "Content-Type: application/json" \
  -d '{
    "lat1": 34.0522,
    "lng1": -118.2437,
    "lat2": 34.0622,
    "lng2": -118.2537
  }'
```

### 6. Check Upcoming Games

```bash
curl http://localhost:4000/test-notifications/test/upcoming-games \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. Run Game Reminders

```bash
npm run cron:game-reminders
```

## Expected Results

✅ **Push notification appears on device within 3-5 seconds**
✅ **Geofence blocks posts >0.5 miles away**
✅ **Geofence allows posts within 0.5 miles**
✅ **Game reminders sent for events in 12h and 1h**

## Common Issues

**No notification received?**

- Check token exists: `/test/check-token`
- Verify notifications enabled in preferences
- Use physical device (not simulator)

**Geofence not working?**

- Ensure event has `latitude` and `longitude`
- Check posting window (24h before game)
- Verify location permission granted

**Distance wrong?**

- GPS can be ±20-50m indoors
- Use High accuracy mode
- Wait for GPS to stabilize
