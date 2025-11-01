# PostgreSQL Database on Railway - Guide

## ✅ Database Status: RUNNING

### 📊 Database Details

**Service Name:** Postgres
**Database Name:** railway
**User:** postgres
**Version:** Latest PostgreSQL
**Volume:** postgres-volume (persistent storage)

### 🔗 Connection Information

**Internal URL (from API service):**
```
postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@postgres.railway.internal:5432/railway
```

**Public URL (from external tools):**
```
postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway
```

**Connection Components:**
- **Host (internal):** postgres.railway.internal
- **Host (public):** hopper.proxy.rlwy.net
- **Port (internal):** 5432
- **Port (public):** 22104
- **Database:** railway
- **User:** postgres
- **Password:** AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg

---

## 🔧 Database Management

### 1. Connect with Prisma Studio (Local)

```powershell
# From server directory
cd c:\Users\xsanc\Documents\5.Projects xsantcastx\VariestyHub\test3\VarsityHubMobile\server

# Set the public DATABASE_URL temporarily
$env:DATABASE_URL="postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway"

# Open Prisma Studio
npx prisma studio
```

This will open a web interface at http://localhost:5555 to view and edit your data.

### 2. Connect with pgAdmin or DBeaver

**Connection Settings:**
- **Name:** VarsityHub Production
- **Host:** hopper.proxy.rlwy.net
- **Port:** 22104
- **Database:** railway
- **Username:** postgres
- **Password:** AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg
- **SSL Mode:** Prefer or Require

### 3. Run SQL Queries via Railway CLI

```powershell
# Switch to Postgres service
railway service Postgres

# Open database shell
railway shell
# Then run: psql $DATABASE_URL

# Or run single query
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
```

### 4. Check Database via Prisma (Recommended)

```powershell
cd server

# Check migration status
railway run npx prisma migrate status

# View database schema
railway run npx prisma db pull

# Generate Prisma Client
railway run npx prisma generate
```

---

## 📊 Database Operations

### View All Tables

```powershell
# From server directory
railway run psql $DATABASE_URL -c "\dt"
```

### Check Database Size

```powershell
railway run psql $DATABASE_URL -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) AS size FROM pg_database;"
```

### Count Records in Tables

```powershell
# Count users
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"

# Count teams
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Team\";"

# Count posts
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Post\";"
```

### View Recent Users

```powershell
railway run psql $DATABASE_URL -c "SELECT id, email, \"displayName\", \"createdAt\" FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

---

## 🔄 Database Migrations

### Check Migration Status

```powershell
cd server
railway service api  # Switch to API service
railway run npx prisma migrate status
```

### Apply Migrations

Migrations are automatically applied on deployment via `start.sh`.

To manually apply:
```powershell
railway run npx prisma migrate deploy
```

### Create New Migration (Development)

```powershell
# Make changes to prisma/schema.prisma
# Then create migration
npx prisma migrate dev --name your_migration_name
```

### Reset Database (⚠️ DANGEROUS - Deletes all data)

```powershell
railway run npx prisma migrate reset
```

---

## 💾 Backup & Restore

### Create Backup

```powershell
# Backup entire database
railway run pg_dump $DATABASE_URL > backup_$(Get-Date -Format "yyyy-MM-dd_HH-mm").sql

# Backup specific table
railway run pg_dump $DATABASE_URL -t "User" > backup_users_$(Get-Date -Format "yyyy-MM-dd_HH-mm").sql
```

### Restore from Backup

```powershell
# Restore full database
railway run psql $DATABASE_URL < backup_2025-11-01_12-00.sql

# Restore specific table
railway run psql $DATABASE_URL < backup_users_2025-11-01_12-00.sql
```

### Export Data to CSV

```powershell
railway run psql $DATABASE_URL -c "COPY (SELECT * FROM \"User\") TO STDOUT WITH CSV HEADER" > users.csv
```

---

## 📈 Monitoring & Performance

### View Active Connections

```powershell
railway run psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### View Database Stats

```powershell
railway run psql $DATABASE_URL -c "SELECT schemaname,relname,n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

### Check Slow Queries

```powershell
railway run psql $DATABASE_URL -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

---

## 🔒 Security Best Practices

### ✅ Current Security Status

- [x] Password protected
- [x] Private network access (postgres.railway.internal)
- [x] Public access via proxy only
- [x] SSL certificates configured (820 days)
- [x] Volume encryption
- [x] Automatic backups by Railway

### Recommendations

1. **Rotate Password Periodically**
   - Go to Railway Dashboard → Postgres → Settings
   - Generate new password
   - Update API service environment variables

2. **Limit Public Access** (if not needed externally)
   - Use internal URL for API service
   - Only use public URL for admin tools

3. **Monitor Access**
   - Check logs in Railway Dashboard
   - Review active connections regularly

4. **Regular Backups**
   - Railway provides automatic backups
   - Consider additional manual backups for critical data

---

## 📦 Volume & Storage

**Current Volume:** postgres-volume
**Mount Path:** /var/lib/postgresql/data
**Volume ID:** 74f42943-4db9-4c57-8fe4-f3f09da81fe0

### Check Storage Usage

```powershell
# View in Railway Dashboard → Postgres → Metrics
# Or check via CLI
railway run df -h /var/lib/postgresql/data
```

### Storage Limits

Railway provides:
- **Free Tier:** 1GB storage
- **Hobby Plan:** 100GB storage
- **Pro Plan:** Unlimited storage

Monitor usage in Railway Dashboard.

---

## 🧪 Testing Database Connection

### From Your API Server

Your API automatically connects using the `DATABASE_URL` environment variable.

### Test Connection Manually

```powershell
# Quick connection test
railway run psql $DATABASE_URL -c "SELECT version();"

# Check if database is accepting connections
railway run psql $DATABASE_URL -c "SELECT 1;"
```

### From Prisma

```powershell
cd server
railway run npx prisma db execute --stdin < test_query.sql
```

---

## 🚨 Troubleshooting

### Connection Refused

**Problem:** Can't connect to database
**Solutions:**
1. Check if Postgres service is running in Railway Dashboard
2. Verify DATABASE_URL is correct
3. Check firewall settings
4. Use public URL (hopper.proxy.rlwy.net) for external connections

### Migration Failures

**Problem:** Migrations fail to apply
**Solutions:**
1. Check migration files for errors
2. Ensure database user has proper permissions
3. Review logs: `railway logs`
4. Try manual migration: `railway run npx prisma migrate deploy`

### Database Full

**Problem:** Storage limit reached
**Solutions:**
1. Check usage in Railway Dashboard
2. Clean up old data
3. Upgrade Railway plan
4. Optimize indexes and tables

### Slow Queries

**Problem:** Database performance issues
**Solutions:**
1. Add indexes to frequently queried columns
2. Review and optimize Prisma queries
3. Use connection pooling (Prisma supports this)
4. Check Railway Dashboard metrics

---

## 🔗 Quick Links

**Railway Dashboard:**
https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e

**Postgres Service:**
https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e/service/5e9e611c-aa18-45ae-bb9a-b76c643c4d38

**View Metrics:**
Railway Dashboard → Postgres → Metrics

**View Logs:**
Railway Dashboard → Postgres → Deployments → Logs

---

## 📋 Quick Commands Cheat Sheet

```powershell
# Switch to Postgres service
railway service Postgres

# View variables
railway variables

# Open database shell
railway shell

# Run SQL query
railway run psql $DATABASE_URL -c "YOUR QUERY HERE"

# Backup database
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql

# Open Prisma Studio (from server directory)
cd server
$env:DATABASE_URL="postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway"
npx prisma studio
```

---

## 💡 Pro Tips

1. **Use Internal URL in Production**
   - Faster connection (no proxy)
   - More secure (private network)
   - Your API service already uses this

2. **Prisma Studio for Quick Admin**
   - Great for viewing/editing data
   - No separate admin panel needed
   - Works locally with public URL

3. **Monitor Usage**
   - Check Railway Dashboard regularly
   - Watch for storage growth
   - Monitor active connections

4. **Regular Backups**
   - Automate weekly backups
   - Store backups in different location
   - Test restore process periodically

5. **Connection Pooling**
   - Prisma handles this automatically
   - Configure in schema.prisma if needed
   - Helps with performance at scale

---

## 📞 Support

- **Railway Docs:** https://docs.railway.app/databases/postgresql
- **Prisma Docs:** https://www.prisma.io/docs/concepts/database-connectors/postgresql
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

**Database Status:** ✅ HEALTHY
**Last Checked:** November 1, 2025
