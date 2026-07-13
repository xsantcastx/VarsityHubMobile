# 🚀 Run This NOW - Fix Apple Sign-In Production Issue

## The Problem

Your production database is **missing the `apple_id` column**, causing all Apple Sign-In attempts to fail with a 500 error, creating the infinite onboarding loop.

## The Fix (Choose ONE Method)

### ⭐ METHOD 1: Railway Dashboard (Easiest - 2 minutes)

1. **Open Railway Dashboard**:
   - Go to: https://railway.app
   - Navigate to your project: "capable-trust"
   - Click on "api" service

2. **Open Shell**:
   - Click "Shell" tab (or "Connect")
   - This opens a terminal in your production environment

3. **Run Migration**:

   ```bash
   npx prisma migrate deploy
   ```

4. **Verify**:

   ```bash
   npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name='apple_id';"
   ```

   Expected: Should show `apple_id` column

5. **Done!** The server will automatically restart

---

### METHOD 2: Railway Database SQL Query (Also Easy)

1. **Open Railway Dashboard** → Your Database Service

2. **Click "Query" tab**

3. **Paste and Execute**:

   ```sql
   -- Add apple_id column if it doesn't exist
   DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name='User' AND column_name='apple_id'
       ) THEN
           ALTER TABLE "User" ADD COLUMN "apple_id" TEXT;
           CREATE UNIQUE INDEX "User_apple_id_key" ON "User"("apple_id");
       END IF;
   END $$;

   -- Verify
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name='User' AND column_name='apple_id';
   ```

4. **Expected Output**:
   ```
   column_name | data_type | is_nullable
   apple_id    | text      | YES
   ```

---

### METHOD 3: Trigger Redeployment (Automatic)

If your Railway is configured to run migrations on deploy:

1. **Make a Trivial Change**:

   ```bash
   cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
   git commit --allow-empty -m "trigger migration deployment"
   git push origin main
   ```

2. **Watch Railway Logs**:
   - Go to Railway Dashboard → Deployments
   - Watch for: "Running postdeploy script"
   - Should see: "prisma migrate deploy"

3. **Verify** in logs that migration succeeded

---

## Test the Fix

After running the migration:

### Test 1: API Endpoint Direct

```bash
curl -X POST https://api-production-8ac3.up.railway.app/auth/apple \
  -H "Content-Type: application/json" \
  -d '{"identity_token": "sim-test-12345"}'
```

**Expected**: `{"access_token": "...", "user": {...}}`
**Not**: `{"error": "Failed to authenticate with Apple"}`

### Test 2: In the App

1. Open app in iOS simulator
2. Tap "Continue with Apple"
3. Complete Face ID/Touch ID
4. **Should proceed to onboarding** (not show error)
5. Complete onboarding
6. **Should stay logged in** (no loop)

---

## Why This Fix Works

**Before Fix**:

```
User taps Apple Sign-In
  ↓
App sends identity_token to /auth/apple
  ↓
Server: prisma.user.findUnique({ where: { apple_id } })
  ↓
❌ ERROR: column "apple_id" does not exist
  ↓
Server returns 500: "Failed to authenticate with Apple"
  ↓
App shows error, user retries
  ↓
INFINITE LOOP
```

**After Fix**:

```
User taps Apple Sign-In
  ↓
App sends identity_token to /auth/apple
  ↓
Server: prisma.user.findUnique({ where: { apple_id } })
  ↓
✅ Column exists! Query succeeds
  ↓
Server creates/updates user
  ↓
Returns { access_token, user, needs_onboarding }
  ↓
App saves token, proceeds to onboarding
  ↓
User completes onboarding ONCE
  ↓
Stays logged in - NO LOOP! ✅
```

---

## Troubleshooting

### If Migration Fails

- **Error**: "relation 'User' does not exist"
  - **Fix**: Wrong database or schema. Check DATABASE_URL points to production

- **Error**: "column apple_id already exists"
  - **Fix**: Migration already applied! Skip to testing

- **Error**: "permission denied"
  - **Fix**: Database user needs ALTER TABLE permission

### If Apple Sign-In Still Fails After Migration

1. Check Railway logs for the actual error:

   ```bash
   railway logs --service api
   ```

2. Look for the `/auth/apple` request and any errors

3. Verify the column exists:
   ```bash
   railway run psql $DATABASE_URL -c "\d User" | grep apple_id
   ```

---

## Timeline

- **Run migration**: < 1 minute
- **Server auto-restart**: ~30 seconds
- **Total time**: ~2 minutes
- **User impact**: Apple Sign-In works immediately

---

## After Fix - Additional Testing

Test all auth methods to ensure nothing broke:

1. ✅ Email/Password Sign-In
2. ✅ Apple Sign-In (this was broken, now fixed)
3. ✅ Google Sign-In
4. ✅ Onboarding completion
5. ✅ Session persistence across app restarts

---

## Summary

**What you're fixing**: Missing database column
**How to fix it**: Run migration via Railway Dashboard Shell
**Time required**: 2 minutes
**Impact**: Fixes Apple Sign-In infinite loop immediately

**👉 Go to Railway Dashboard → Shell → Run `npx prisma migrate deploy` NOW**

Then test Apple Sign-In in your app. The onboarding loop will be gone.
