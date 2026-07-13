# 🔴 CRITICAL: Production Database Migration Fix

## Root Cause Identified ✅

The Apple Sign-In infinite loop is caused by a **missing database column** in production:

```
Error: column "apple_id" does not exist
Location: server/src/routes/auth.ts:305 (prisma.user.findUnique({ where: { apple_id } }))
Result: 500 error → "Failed to authenticate with Apple" → User stuck in loop
```

### Why This Happened

The migration `server/prisma/migrations/20251115194118_add_apple_id/migration.sql` exists locally but was never applied to the **production Railway database**.

## Immediate Fix (Required)

### Option 1: Run Migration via Railway CLI (Recommended)

```bash
# Install Railway CLI if not already installed
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy

# Verify the column exists
railway run npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name='apple_id';"
```

### Option 2: Direct Database Connection

```bash
# Connect to Railway database
# Get DATABASE_URL from Railway dashboard → Variables

cd server

# Set the production DATABASE_URL temporarily
export DATABASE_URL="postgresql://user:pass@host:port/database"

# Run migration
npx prisma migrate deploy

# Verify
npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name='apple_id';"
```

### Option 3: Railway Dashboard SQL Execute

1. Go to Railway Dashboard → Your Project → Database
2. Click "Query" tab
3. Run this SQL:

```sql
-- Add apple_id column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "apple_id" TEXT;

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "User_apple_id_key" ON "User"("apple_id");

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
AND column_name = 'apple_id';
```

Expected output:

```
column_name | data_type | is_nullable
------------+-----------+-------------
apple_id    | text      | YES
```

### Option 4: Manual SQL File Upload

If Railway supports SQL file execution:

1. Use the migration file directly:

   ```bash
   cat server/prisma/migrations/20251115194118_add_apple_id/migration.sql
   ```

2. Copy the contents:

   ```sql
   ALTER TABLE "User" ADD COLUMN "apple_id" TEXT;
   CREATE UNIQUE INDEX "User_apple_id_key" ON "User"("apple_id");
   ```

3. Execute via Railway dashboard

## Verify the Fix

After running the migration, test Apple Sign-In:

```bash
# Test from local environment pointing to production
curl -X POST https://api-production-8ac3.up.railway.app/auth/apple \
  -H "Content-Type: application/json" \
  -d '{"identity_token": "sim-test-12345"}'

# Should return:
# {"access_token": "...", "user": {...}, "needs_onboarding": true}

# NOT:
# {"error": "Failed to authenticate with Apple"}
```

Or test in the app:

1. Open app in simulator
2. Tap "Continue with Apple"
3. Should successfully sign in (no 500 error)
4. Should proceed to onboarding (not loop on sign-in)

## Prevent Future Issues

### 1. Ensure Railway Runs Migrations Automatically

Railway should run the `postdeploy` script from `package.json`:

```json
{
  "scripts": {
    "postdeploy": "npx prisma migrate deploy && npm run seed"
  }
}
```

**Check Railway Build Settings:**

- Go to Railway Dashboard → Your Project → Settings → Deploy
- Verify "Install Command": `npm install`
- Verify "Build Command": `npm run build`
- Verify "Start Command": `npm start`
- **Add or verify "Deploy Command"**: `npm run postdeploy` (if supported)

If Railway doesn't auto-run `postdeploy`, add a custom deploy script:

```json
{
  "scripts": {
    "railway:deploy": "npx prisma migrate deploy && npx prisma generate && npm run build",
    "start": "node dist/index.js"
  }
}
```

Then set Build Command to: `npm run railway:deploy`

### 2. Add Migration Check to Server Startup

Add a startup check in `server/src/index.ts`:

```typescript
// Before starting server
async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('💡 Run: npx prisma migrate deploy');
    process.exit(1);
  }
}

await checkDatabase();
```

### 3. Document Migration Process

Create `server/DEPLOYMENT.md`:

````markdown
# Deployment Checklist

Before deploying to Railway:

1. ✅ Run migrations locally: `npx prisma migrate dev`
2. ✅ Commit migration files to git
3. ✅ Push to GitHub
4. ✅ Railway auto-deploys
5. ✅ Verify migrations ran: Check Railway logs for "prisma migrate deploy"
6. ✅ Test critical endpoints (auth, Apple sign-in)

If migrations don't auto-run:

```bash
railway run npx prisma migrate deploy
```
````

````

## Expected Timeline

- **Migration execution**: < 1 minute
- **Server restart**: 1-2 minutes (if needed)
- **Total downtime**: 0-2 minutes
- **User impact**: Immediate fix for Apple Sign-In

## After Migration

The following flow will work correctly:

1. User taps "Continue with Apple"
2. App sends identity_token to `/auth/apple`
3. Server queries `User` table with `apple_id`
4. **Column exists** ✅
5. Server finds or creates user
6. Returns `{access_token, user, needs_onboarding}`
7. App stores token and proceeds to onboarding (if needed)
8. User completes onboarding
9. Server marks `onboarding_completed=true`
10. User stays logged in - **NO LOOP** ✅

## Monitoring

After deploying the fix, monitor:

```bash
# Watch Railway logs
railway logs

# Look for:
✅ "Prisma migration complete"
✅ "Database connection successful"
✅ POST /auth/apple → 200 OK

# NOT:
❌ "column apple_id does not exist"
❌ POST /auth/apple → 500
````

## Rollback (if needed)

If something goes wrong:

```sql
-- Remove the column (not recommended, but here for safety)
ALTER TABLE "User" DROP COLUMN IF EXISTS "apple_id";
DROP INDEX IF EXISTS "User_apple_id_key";
```

Then investigate and reapply properly.

---

## Summary

**Problem**: Production DB missing `apple_id` column
**Cause**: Migration not applied to Railway database
**Fix**: Run `npx prisma migrate deploy` via Railway CLI or dashboard
**Test**: Apple Sign-In should work without 500 errors
**Impact**: Fixes the infinite onboarding loop immediately

**Run the fix NOW, then test Apple Sign-In in the app.**
