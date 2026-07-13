# Railway Production Server Setup

**Date:** January 12, 2025  
**Status:** ✅ **CONFIGURED**

---

## Production API URL

```
https://api-production-8ac3.up.railway.app
```

---

## Configuration

### App Configuration (`app.json`)

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_URL": "https://api-production-8ac3.up.railway.app",
      "EXPO_PUBLIC_FORCE_REMOTE_API": "1",
      "EXPO_PUBLIC_NODE_ENV": "production"
    }
  }
}
```

### API Client (`api/http.ts`)

- **Default URL**: `https://api-production-8ac3.up.railway.app`
- **Force Remote**: Enabled (`EXPO_PUBLIC_FORCE_REMOTE_API=1`)
- **Fallback Logic**: Always falls back to Railway production if private IP detected
- **Production Mode**: Always uses Railway in production mode

---

## Benefits of Using Railway Production

✅ **Single source of truth** - All users connect to same server  
✅ **Easier management** - One deployment, one database  
✅ **Consistent data** - No local vs remote sync issues  
✅ **Better testing** - Test against real production environment  
✅ **Simplified debugging** - All logs in one place

---

## How It Works

1. **App reads config** from `app.json` → `EXPO_PUBLIC_API_URL`
2. **Force remote enabled** → Always uses Railway (no localhost fallback)
3. **Private IP detection** → Auto-falls back to Railway if cached private IP found
4. **Production mode** → Always uses Railway when `NODE_ENV=production`

---

## Verification

The app will automatically:

- Use Railway production URL
- Fall back to Railway if any private IP detected
- Log the API base URL on first request (check console)

**Expected console output:**

```
[http] API base: https://api-production-8ac3.up.railway.app
```

---

## Testing

1. **Start the app:**

   ```bash
   npm run dev
   # or
   npx expo start --dev-client
   ```

2. **Check console** for API base URL log

3. **Verify requests** go to Railway:
   - All API calls should hit `api-production-8ac3.up.railway.app`
   - Check Network tab in dev tools

---

**Status:** ✅ App configured to use Railway production server by default.
