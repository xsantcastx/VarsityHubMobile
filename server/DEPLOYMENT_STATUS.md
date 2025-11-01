# Railway Server Deployment - Test Script

## Your Server URL
https://api-production-8ac3.up.railway.app

## Test Commands

### Test Health Endpoint
```powershell
curl https://api-production-8ac3.up.railway.app/health
```

### Test API Root
```powershell
curl https://api-production-8ac3.up.railway.app/
```

### View in Browser
Open: https://api-production-8ac3.up.railway.app

## Recent Changes Made

1. ✅ Updated `.nixpacks.toml` - Added explicit Prisma generation and dev dependencies
2. ✅ Updated `railway.json` - Direct node command instead of npm start
3. ✅ Updated `package.json` - Added postinstall hook for Prisma
4. ✅ Created `Procfile` - Backup start command

## Build Configuration

**Build Command:**
```bash
npm ci --include=dev && npx prisma generate && npm run build
```

**Start Command:**
```bash
node dist/index.js
```

## Check Deployment Status

### Via Railway Dashboard
https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e/service/6bf477a3-56a7-44d0-aa29-ff86a76cdc02

### Via CLI (from server directory)
```powershell
railway status
railway logs
```

## If Build Still Fails

The issue is likely:
1. **Prisma Client not generating** - Fixed with postinstall hook
2. **TypeScript not compiling** - Fixed by including devDependencies with `npm ci --include=dev`
3. **dist/index.js not found** - Fixed by ensuring build runs properly

## Alternative: Use Docker

If Nixpacks continues to fail, you can deploy with Docker instead.

Create `Dockerfile` in server directory:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Then in Railway dashboard:
- Settings → Deploy → Builder: DOCKERFILE

## Verify Current Deployment

Wait 2-3 minutes for build to complete, then test:

```powershell
curl https://api-production-8ac3.up.railway.app/health
```

Expected response:
```json
{"status":"ok"}
```
