# Media Upload Debugging Runbook

Use this checklist whenever stories/highlights fail to upload from the mobile app. It isolates whether the failure is in the Expo client, the `/uploads` endpoint, or the `/games/:id/stories` registration step.

---

## 1. Confirm the mobile client uses the production API

1. In the mobile repo, enforce the remote API:
   ```bash
   export EXPO_PUBLIC_FORCE_REMOTE_API=true
   unset EXPO_PUBLIC_API_URL
   npx expo start --clear
   ```
2. When Metro starts, verify the log contains  
   `"[http] API base: https://api-production-8ac3.up.railway.app"`.
3. Launch the iOS Simulator from that same terminal (`i`) or switch to tunnel mode (`s` → *tunnel*) if the simulator cannot reach your LAN IP.

> If the base URL is a LAN address (e.g., `http://192.168.x.x`) the simulator may not reach it, which will cause every upload to time out.

---

## 2. Capture client-side story logs

The `Add Story` flow now emits detailed logs. Open a **real** game from Feed/Team/Events (sample IDs never call the backend) and trigger **Add Story** → Camera or Gallery. Copy the Metro output:

```
[story] Gallery - uploading to: https://api-production-8ac3.up.railway.app/uploads | file: story.jpg | mime: image/jpeg
[story] Gallery - upload response: {"path":"/uploads/2024/..."}
[story] Gallery - registering story with game: game_123 | media_url: /uploads/2024/...
[story] Gallery - story registered successfully
```

- If the log stops after “uploading to…”, the `/uploads` request never completed.
- If it stops after “registering story…”, `POST /games/:id/stories` timed out.
- If the log includes “sample ID detected”, you’re on a demo slug; switch to a real game.

Attach these logs to any bug ticket so we can see exactly which step hung.

---

## 3. Smoke-test the API endpoints directly

Run these from the server repo root (requires a valid bearer token; grab one from a successful mobile login).

### 3.1 `/health`
```bash
curl -sSf https://api-production-8ac3.up.railway.app/health
```

### 3.2 `/uploads`
```bash
TOKEN="Bearer <jwt>"
curl -sS \
  -H "Authorization: $TOKEN" \
  -F "file=@/path/to/photo.jpg" \
  https://api-production-8ac3.up.railway.app/uploads
```
Expect `{"url":"https://.../uploads/<file>","type":"image","mime":"image/jpeg","size":12345}` within ~1 s.

### 3.3 `/games/:id/stories`
```bash
curl -sS \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"media_url":"/uploads/<file>","caption":"Test"}' \
  https://api-production-8ac3.up.railway.app/games/<game_id>/stories
```
Expected: HTTP 201 with the created story JSON.  
Common failures:
- `401 Unauthorized`: token expired/missing.
- `404 Not found`: game ID incorrect.
- Timeout: check Railway logs; Prisma may be waiting on a locked row.

---

## 4. Railway-side diagnostics

If the curl tests hang:
1. Open Railway logs for the API service.
2. Filter for `/uploads` or `/games/*/stories`.
3. Confirm whether the request reaches the server. If not, Railway networking is down; redeploy.
4. If it reaches the server but stalls, check Cloudinary/local disk connectivity (uploads log will note which storage is active) and verify the `Story` table isn’t locked.

---

## 5. Checklist before filing a bug

- [ ] Metro log shows the correct API base.
- [ ] `[story]` logs captured, showing which step failed.
- [ ] `/uploads` curl test result attached.
- [ ] `/games/:id/stories` curl test result attached.
- [ ] Railway log screenshot or snippet attached (if server received the request).

With these artifacts we can reproduce or escalate the failure quickly without guesswork.
