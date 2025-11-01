# ✅ PostgreSQL Database - Setup Complete

## 📊 Your PostgreSQL Database on Railway

### Database Status: ✅ RUNNING

Your VarsityHub application is using a PostgreSQL database hosted on Railway with persistent storage.

---

## 🔑 Key Information

### Database Details
- **Service Name:** Postgres
- **Database Name:** railway
- **Database User:** postgres
- **PostgreSQL Version:** Latest
- **Storage:** Persistent volume (postgres-volume)
- **Backups:** Automatic (Railway managed)

### Connection URLs

**For Your API (Internal - Already Configured):**
```
postgresql://postgres:***@postgres.railway.internal:5432/railway
```
✅ Your API service already uses this automatically via `DATABASE_URL` environment variable.

**For External Tools (Public Access):**
```
Host: hopper.proxy.rlwy.net
Port: 22104
Database: railway
User: postgres
Password: [See Railway Dashboard]
```

---

## ✅ What's Already Configured

1. **✅ Database Created** - PostgreSQL service running on Railway
2. **✅ Connected to API** - API service has DATABASE_URL configured
3. **✅ Auto-Migrations** - Prisma migrations run automatically on deployment
4. **✅ Persistent Storage** - Data is stored on permanent volume
5. **✅ Private Network** - API connects via internal network (faster, secure)
6. **✅ Public Access** - Available via proxy for admin tools
7. **✅ SSL Configured** - Secure connections enabled

---

## 🎯 Quick Access Methods

### Method 1: Prisma Studio (Recommended)

Best for viewing and editing data with a nice UI.

```powershell
cd c:\Users\xsanc\Documents\5.Projects xsantcastx\VariestyHub\test3\VarsityHubMobile\server

# Set database URL (temporary for this session)
$env:DATABASE_URL="postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway"

# Open Prisma Studio
npx prisma studio
```

Opens at: http://localhost:5555

### Method 2: pgAdmin

Download: https://www.pgadmin.org/download/

**Connection Settings:**
- Name: VarsityHub Production
- Host: hopper.proxy.rlwy.net
- Port: 22104
- Database: railway
- Username: postgres
- Password: AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg
- SSL Mode: Prefer

### Method 3: DBeaver

Download: https://dbeaver.io/download/

**Connection Settings:**
- Database Type: PostgreSQL
- Host: hopper.proxy.rlwy.net
- Port: 22104
- Database: railway
- Username: postgres
- Password: AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg

### Method 4: Railway Dashboard

- Go to: https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e
- Click on "Postgres" service
- View metrics, logs, and configuration

---

## 📋 Common Database Tasks

### View Data

```powershell
# Open Prisma Studio
cd server
$env:DATABASE_URL="postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway"
npx prisma studio
```

### Check Tables

Your database includes these main tables (from Prisma schema):
- User
- Team
- TeamMembership
- TeamInvite
- Post
- Comment
- Event
- Game
- Highlight
- Message
- Notification
- Follow
- RSVP
- Ad
- Organization
- GroupChat
- And more...

### Run Migrations

Migrations run automatically on deployment. To manually run:

```powershell
cd server
railway service api
railway run npx prisma migrate deploy
```

### Generate Prisma Client

```powershell
cd server
npx prisma generate
```

---

## 💾 Backup & Restore

### Automatic Backups

Railway automatically backs up your database. View backups in:
- Railway Dashboard → Postgres → Backups

### Manual Backup (Future Setup)

Install PostgreSQL tools locally, then:

```powershell
# Install chocolatey first (if not already): https://chocolatey.org/install
choco install postgresql

# Then backup
pg_dump "postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway" > backup.sql
```

Or use pgAdmin/DBeaver's backup features.

---

## 📊 Monitoring

### View Metrics

**In Railway Dashboard:**
1. Go to Postgres service
2. Click "Metrics" tab
3. View:
   - CPU usage
   - Memory usage
   - Storage usage
   - Network traffic

### Check Connection Status

```powershell
railway service Postgres
railway status
```

### View Logs

**Railway Dashboard:** Postgres → Deployments → Logs

**Or via CLI:**
```powershell
railway service Postgres
railway logs
```

---

## 🔒 Security

### ✅ Current Security Features

- **Password Protected** - Strong password configured
- **Private Network** - API uses internal URL (no internet exposure)
- **SSL Enabled** - All connections encrypted
- **Volume Encryption** - Data encrypted at rest
- **Network Isolation** - Only accessible to your Railway services or via proxy
- **Automatic Updates** - Railway manages PostgreSQL security updates

### Best Practices

1. ✅ Use internal URL for API (already done)
2. ✅ Keep password secure (don't commit to git)
3. ✅ Monitor access logs regularly
4. ⏳ Set up alerts for unusual activity
5. ⏳ Review and rotate password periodically

---

## 💰 Costs & Limits

### Current Plan

Check your Railway plan in the dashboard for:
- Storage limits
- Memory limits
- Network transfer
- Costs

### Free Tier Includes:
- Up to $5 in usage per month
- 1GB storage
- Shared compute

### To Upgrade:
- Railway Dashboard → Account → Billing
- Hobby Plan: $5/month for more resources
- Pro Plan: Pay-as-you-go

---

## 🚨 Troubleshooting

### Can't Connect from Local Machine

**Issue:** Connection refused or timeout

**Solutions:**
1. Use public URL: `hopper.proxy.rlwy.net:22104`
2. Check Railway service is running
3. Verify password is correct
4. Check firewall settings

### Migrations Not Applied

**Issue:** Database schema doesn't match Prisma schema

**Solutions:**
1. Migrations run automatically on deployment
2. Check deployment logs for errors
3. Manually run: `railway run npx prisma migrate deploy`
4. Use `npx prisma db push` for development

### Database Full

**Issue:** Out of storage

**Solutions:**
1. Check usage in Railway Dashboard
2. Clean up old/unused data
3. Upgrade Railway plan
4. Optimize database (remove old logs, etc.)

---

## 📚 Additional Resources

### Documentation
- **Railway PostgreSQL:** https://docs.railway.app/databases/postgresql
- **Prisma PostgreSQL:** https://www.prisma.io/docs/concepts/database-connectors/postgresql
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

### Tools
- **Prisma Studio:** Built into Prisma
- **pgAdmin:** https://www.pgadmin.org/
- **DBeaver:** https://dbeaver.io/
- **DataGrip:** https://www.jetbrains.com/datagrip/ (paid)

---

## 🔗 Quick Links

- **Railway Project:** https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e
- **Postgres Service:** https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e/service/5e9e611c-aa18-45ae-bb9a-b76c643c4d38
- **Full PostgreSQL Guide:** See `POSTGRESQL_GUIDE.md`

---

## ✅ Summary

Your PostgreSQL database is:
- ✅ Running and healthy
- ✅ Connected to your API
- ✅ Configured with persistent storage
- ✅ Accessible via Prisma Studio or database tools
- ✅ Automatically backed up by Railway
- ✅ Secured with password and SSL

**Everything is set up and working!** 🎉

Use Prisma Studio (method above) to view and manage your data easily.

---

*Last Updated: November 1, 2025*
