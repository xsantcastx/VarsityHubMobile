# 🔧 Railway Deployment Fix - Root Directory Issue

## Problem

Railway is currently configured with `server` as the root directory, but it's not finding `package.json` inside it.

## Fast Fix Checklist (Recommended)

1. In Railway → Service → Settings → Source:

- Builder: `Dockerfile`
- Dockerfile Path: `server/Dockerfile`
- Root Directory: leave empty or set to `server`

2. Redeploy the service.

This matches `railway.toml`:

```
[build]
builder = "dockerfile"
dockerfilePath = "server/Dockerfile"
buildContext = "."
```

If you prefer Nixpacks, override commands so it builds the backend:

- Build: `cd server && npm ci && npm run build`
- Start: `cd server && npm start`

---

## Solution: Change Root Directory in Railway Dashboard

### Step 1: Access Railway Dashboard

1. Open: https://railway.app/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e
2. Click on the **"api"** service

### Step 2: Change Root Directory Settings

1. Click on **Settings** tab (gear icon on the left sidebar)
2. Scroll down to **"Source"** section
3. Find **"Root Directory"** field
4. **CHANGE IT TO**: `server` (if not already set)
   - OR if it says `server`, try **CLEARING IT** to empty/root, then we'll use a different approach

### Step 3: If Root Directory Doesn't Work - Use Service Settings

#### Option A: Remove Root Directory, Use Custom Build Commands

1. **Root Directory**: Leave EMPTY or set to `/`
2. **Build Command**: `cd server && npm ci && npm run build`
3. **Start Command**: `cd server && npm start`
4. **Watch Paths**: `server/**`

#### Option B: Use Server Directory as Source

1. In Railway Dashboard → Service Settings
2. **Custom Build Command**:
   ```bash
   cd server && npm ci && npm run build
   ```
3. **Custom Start Command**:
   ```bash
   cd server && npm start
   ```

### Step 4: Alternative - Deploy from Server Directory

If dashboard method doesn't work, deploy directly from server folder:

```powershell
cd server
railway link <select your project>
railway up
```

## Quick Fix via CLI (from server directory)

```zsh
# Navigate to server directory
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/server

# Link to Railway (will ask you to select project/service)
railway link

# Deploy backend only
railway up
```

## Recommended: Deploy from Server Directory

Since your Railway project is configured for the server, it's best to always deploy from the server directory:

### One-Time Setup:

```zsh
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/server
railway link
# Select project: capable-trust
# Environment: production
# Service: api
```

### Every Time You Deploy:

```zsh
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/server
railway up
```

## Files to Keep/Remove

### Keep These (in server/ directory):

- ✅ `package.json`
- ✅ `railway.json`
- ✅ `railway.toml`
- ✅ `.nixpacks.toml`
- ✅ `.env.railway`

### Remove These (from root directory):

- ❌ `nixpacks.toml` (in root)
- ❌ `railway.json` (in root)
- ❌ `.railwayignore` (in root)

## Current Status

Your server IS already deployed and running at:

- **URL**: https://api-production-8ac3.up.railway.app
- **Project**: capable-trust
- **Service**: api
- **Database**: Connected (PostgreSQL)

The build is failing because the service is building the Expo app at repo root instead of the backend in `server/`.

## Test Your Current Deployment

Even though the latest build failed, your previous deployment might still be running:

```powershell
curl https://api-production-8ac3.up.railway.app/health
```

Or open in browser: https://api-production-8ac3.up.railway.app

## Next Steps After Fixing

1. Test the API endpoint
2. Run database migrations: `railway run npx prisma migrate deploy`
3. Seed database (if needed): `railway run npm run seed`
4. Update mobile app with API URL
