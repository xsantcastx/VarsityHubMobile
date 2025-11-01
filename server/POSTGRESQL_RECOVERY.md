# PostgreSQL Recovery Steps

## 🚨 Issue: PostgreSQL Container Crash

**Error:** `failed to exec pid1: No such file or directory`

This error indicates the PostgreSQL container cannot start. This is typically a Railway infrastructure issue.

---

## 🔧 Fix Steps (In Order)

### Step 1: Simple Restart (Try First)

1. Go to Railway Dashboard: https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e
2. Click on **Postgres** service  
3. Click **Settings** tab
4. Scroll to **Danger Zone** at bottom
5. Click **Restart Deployment**
6. Wait 2-3 minutes
7. Check if status changes to "Active"

### Step 2: Force Redeploy

If restart doesn't work:

1. In Postgres service → **Settings**
2. Under **Service**, click **Generate Domain** (if not already generated)
3. Click **Deployments** tab
4. Click the three dots (•••) on latest deployment
5. Click **Redeploy**
6. Wait for new deployment to complete

### Step 3: Check Volume Health

If still crashing:

1. In Postgres service → **Settings**
2. Scroll to **Volumes**
3. Check if `postgres-volume` is showing errors
4. If volume shows errors, you may need to detach and recreate

### Step 4: Contact Railway Support (If Above Don't Work)

This is likely a platform issue. Contact Railway:

1. Go to Railway Dashboard
2. Click the **?** icon (bottom left)
3. Click **Contact Support**
4. Provide:
   - Project ID: `22899614-5ae1-47e9-bdd6-7f6d5ce5619e`
   - Service ID: `5e9e611c-aa18-45ae-bb9a-b76c643c4d38`
   - Error: "PostgreSQL container failed to start with error: failed to exec pid1"
   - Logs: Paste the error logs

---

## ⚠️ Nuclear Option: Recreate Database

**ONLY if you don't have important data and above steps fail:**

### A. Delete and Recreate Postgres Service

1. **Backup DATA_URL first** (if you have data you care about)
2. Railway Dashboard → Postgres service → Settings
3. Scroll to bottom → "Delete Service"
4. Confirm deletion
5. In project dashboard, click **+ New**
6. Select **Database** → **PostgreSQL**
7. Wait for provisioning
8. Update API service with new DATABASE_URL

### B. Via Railway CLI

```powershell
# Switch to project
cd c:\Users\xsanc\Documents\5.Projects xsantcastx\VariestyHub\test3\VarsityHubMobile\server

# Remove old service (if needed)
railway service Postgres
# Then in Railway Dashboard: Settings → Delete Service

# Add new PostgreSQL
railway add
# Select PostgreSQL

# Link to API service
railway service api
railway link
```

Then update the DATABASE_URL in your API service settings.

---

## 🔄 After Database is Fixed

### 1. Verify Connection

```powershell
railway service Postgres
railway status
```

Should show "Active" or "Running"

### 2. Run Migrations

```powershell
railway service api
railway run npx prisma migrate deploy
```

Or redeploy API (migrations run automatically):

```powershell
railway service api
railway up
```

### 3. Test Connection

```powershell
# Test API health
curl https://api-production-8ac3.up.railway.app/health
```

---

## 📊 Common Causes

1. **Railway Infrastructure Issue** - Most common, usually resolved by restart
2. **Volume Corruption** - Rare, requires volume recreation
3. **Resource Limits** - Free tier hitting limits
4. **Image Pull Failure** - PostgreSQL image failed to download

---

## 💡 Prevention

1. **Upgrade to Hobby Plan** - More stable, less likely to crash
2. **Enable Automatic Backups** - Already enabled by Railway
3. **Monitor Usage** - Watch for resource limits
4. **Use Connection Pooling** - Reduces database load

---

## 🆘 Emergency: Database Lost

If you need to start fresh:

1. Delete Postgres service
2. Create new PostgreSQL database
3. Run migrations: `railway run npx prisma migrate deploy`
4. Your schema will be recreated (but data lost)

---

## 📞 Get Help

- **Railway Status:** https://status.railway.app (check for incidents)
- **Railway Discord:** https://discord.gg/railway
- **Railway Support:** Dashboard → Help (?) → Contact Support

---

**Most likely this is a temporary Railway platform issue. Try the restart first!**
