# Restart Railway Backend - Apply Notification Fix

## 🚨 Issue

The backend is still returning the `message_id` column error because Railway hasn't deployed the new code yet.

## ✅ Fix is Already Pushed

The notification fixes are already on GitHub:

- ✅ `d1d1e20` - Remove message_id from notifications query
- ✅ `e68f9c9` - Remove message_id from notification creation

## 🔄 Restart Railway Backend

### Option 1: Railway Dashboard (Easiest)

1. Go to Railway Dashboard:
   - https://railway.app/project/capable-trust
   - Or: https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e

2. Click on your **API service** (the one that runs the backend)

3. Go to **Settings** tab

4. Scroll to **Danger Zone** at the bottom

5. Click **"Restart Deployment"** or **"Redeploy"**

6. Wait 2-3 minutes for the service to restart

7. The new code will be deployed automatically

### Option 2: Railway CLI

```bash
cd /Users/varsityhub/VarsityHubMobile/server
railway link
railway restart
```

Or force redeploy:

```bash
railway up
```

## ✅ Verify Fix

After restart, test the notifications endpoint:

```bash
curl https://api-production-8ac3.up.railway.app/notifications?limit=1&unread=1
```

Should return:

```json
{"items": [...], "nextCursor": null}
```

**NOT** the error about `message_id` column.

## 📊 What Will Happen

1. Railway will pull the latest code from GitHub
2. Build the server with the fixes
3. Deploy the new version
4. Notifications endpoint will work without `message_id` errors

---

**After restarting Railway, the notification errors will stop!** 🎉
