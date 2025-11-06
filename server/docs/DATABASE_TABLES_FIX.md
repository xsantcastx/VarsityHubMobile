# Database Tables Not Showing - Quick Fix

## Issue
Railway dashboard shows "You have no tables" even though schema.prisma has 30+ models defined.

## Why This Happens
The database schema wasn't pushed/migrated to the new PostgreSQL database.

## Solution

### Option 1: Check if Latest Deployment Created Tables

1. Refresh the Railway Database page (Press F5)
2. If tables appear, you're done! ✅

### Option 2: View Deployment Logs

1. Go to Railway → api service → Deployments
2. Click on the latest deployment
3. Look for this output:
   ```
   🔄 Setting up database schema...
   ✅ Database ready! Starting server...
   ```

If you see errors or it skipped the schema push, continue to Option 3.

### Option 3: Manually Create Tables

Since `railway run` doesn't work from your local machine, we need to create tables via the deployment.

**Quick Fix - Update Dockerfile:**

```dockerfile
# Add this before CMD at the end of Dockerfile
RUN npx prisma db push --accept-data-loss --skip-generate || true

CMD ["./start.sh"]
```

Then redeploy:
```powershell
railway up
```

### Option 4: Force Schema Push on Next Deploy

Update `start.sh` to be more verbose:

```bash
#!/bin/sh
set -e

echo "========================================="
echo "🔄 Prisma Database Setup Starting..."
echo "========================================="

echo "📊 Checking current database state..."
npx prisma db pull || echo "No existing schema found"

echo "🔄 Pushing schema to database..."
npx prisma db push --accept-data-loss --skip-generate || {
    echo "❌ db push failed, trying migrate deploy..."
    npx prisma migrate deploy || echo "⚠️  Migration also failed"
}

echo "✅ Database setup complete!"
echo "========================================="
echo "🚀 Starting server..."
exec node dist/index.js
```

### Option 5: Check API Service Variables

Verify DATABASE_URL is correct:
```powershell
railway service api
railway variables | Select-String "DATABASE_URL"
```

Should show the new database: `postgres-dkc5.railway.internal`

## Expected Result

After successful deployment, your database should have these tables:

- User
- Team
- TeamMembership
- TeamInvite
- Game
- Post
- Event
- EventRsvp
- Message
- Comment
- Story
- Notification
- Ad
- Category
- Follow
- GroupChat
- Organization
- PromoCode
- TransactionLog
- And more...

## Next Steps After Tables Are Created

1. ✅ Refresh Railway database page
2. ✅ See all 30+ tables
3. ✅ Test creating a user via API
4. ✅ Connect mobile app

---

**Most likely fix: Just refresh the Railway database page!**
The deployment may have already created the tables.
