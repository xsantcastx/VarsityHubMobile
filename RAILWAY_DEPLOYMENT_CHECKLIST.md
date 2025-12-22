# Railway Deployment Verification Checklist

## Quick Diagnosis Steps

### 1. Check Railway Service Status
```bash
# On Railway dashboard:
# - Go to your service
# - Check "Deployments" → latest deployment status (should be "Success")
# - Check "Logs" → look for errors during startup
# - Check "Monitoring" → see if the service is running
```

### 2. Verify Health Endpoint
```bash
# Test the health check endpoint (replace with your Railway URL)
curl https://api-production-8ac3.up.railway.app/health

# Expected response:
# {"status":"ok","database":"connected","integrations":{...}}
```

### 3. Test Organization Search Endpoint
```bash
# Test the search endpoint
curl "https://api-production-8ac3.up.railway.app/organizations?q=Westhill"

# Expected: JSON array of organizations or empty array []
```

## Critical Environment Variables Checklist

### Database & Core
- [ ] `DATABASE_URL` - PostgreSQL connection string (Railway Postgres plugin)
- [ ] `JWT_SECRET` - Minimum 32 random characters
- [ ] `NODE_ENV` - Must be "production"
- [ ] `PORT` - Should be auto-set by Railway (or leave blank)

### Email (SendGrid)
- [ ] `SENDGRID_API_KEY` - Your SendGrid API key
- [ ] `SENDGRID_FROM_EMAIL` - Sender email address
- [ ] Template IDs (optional but recommended):
  - [ ] `SENDGRID_WELCOME_TEMPLATE_ID`
  - [ ] `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
  - [ ] `SENDGRID_EMAIL_VERIFICATION_TEMPLATE_ID`

### Payment (Stripe)
- [ ] `STRIPE_SECRET_KEY` - Live key (sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- [ ] `STRIPE_PRICE_VETERAN` - Price ID for veteran plan
- [ ] `STRIPE_PRICE_LEGEND` - Price ID for legend plan
- [ ] `STRIPE_PRICE_AD_WEEKDAY` - Price ID for weekday ads
- [ ] `STRIPE_PRICE_AD_WEEKEND` - Price ID for weekend ads

### SMS/Auth (Twilio)
- [ ] `TWILIO_ACCOUNT_SID` - Your Twilio account SID
- [ ] `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- [ ] `TWILIO_VERIFY_SERVICE_SID` - Twilio Verify service ID
- [ ] `TWILIO_FROM_PHONE` - Phone number for SMS

### Cloud Storage (Cloudinary)
- [ ] `CLOUDINARY_CLOUD_NAME` - Your cloud name
- [ ] `CLOUDINARY_API_KEY` - Your API key
- [ ] `CLOUDINARY_API_SECRET` - Your API secret

### Frontend Integration
- [ ] `ALLOWED_ORIGINS` - Set to "*" for mobile or specific URLs
- [ ] `APP_BASE_URL` - Your Railway API URL (e.g., https://api-production-8ac3.up.railway.app)
- [ ] `APP_SCHEME` - Should be "varsityhubmobile"

### Optional Services
- [ ] `SENTRY_DSN` - Error tracking (optional)
- [ ] `GOOGLE_MAPS_API_KEY` - Maps (optional but recommended)

## Common Railway Deployment Issues & Fixes

### Issue: Service keeps crashing ("Crashed" status)
**Cause:** Usually missing environment variables or database connection failure

**Fix:**
1. Check Railway Logs for error messages
2. Verify `DATABASE_URL` is correct and database is running
3. Ensure all required variables are set (see list above)
4. Redeploy: Go to Deployments → select latest → "Redeploy"

### Issue: "Health check failed" or service won't start
**Cause:** API not responding on port or health endpoint not working

**Fix:**
1. Verify `/health` endpoint is accessible: `curl https://your-url/health`
2. Check start.sh and Dockerfile are correct:
   - Dockerfile WORKDIR should be `/app`
   - CMD should be `["/app/start.sh"]`
   - start.sh should be executable
3. Check Railway build logs for compilation errors

### Issue: Search returns empty results (but API responds)
**Cause:** Westhill not in database or has wrong status

**Fix:**
1. Run diagnostic script locally: `bash scripts/diagnose-westhill.sh`
2. Check database directly (if you have access):
   ```sql
   SELECT id, name, status FROM "Organization" WHERE name ILIKE '%Westhill%';
   ```
3. If not found, insert test data or create via app UI
4. If found but status != 'active', update:
   ```sql
   UPDATE "Organization" SET status = 'active' WHERE name = 'Westhill High School';
   ```

### Issue: App can't connect to API (network error)
**Cause:** Wrong API URL or CORS misconfigured

**Fix:**
1. Check app is pointing to correct Railway URL
2. In `api/http.ts`, verify `getApiBaseUrl()` returns the correct URL
3. Ensure `ALLOWED_ORIGINS` includes the mobile app origin or is "*"
4. Test CORS: `curl -H "Origin: *" https://api-production-8ac3.up.railway.app/health`

### Issue: Migrations fail on startup
**Cause:** Database schema out of sync

**Fix:**
1. Check Railway database is running
2. In Railway shell (if available):
   ```bash
   npx prisma migrate status
   npx prisma migrate deploy --force
   ```
3. Or rebuild from scratch: delete database → redeploy

## Step-by-Step Railway Verification

1. **Access your Railway dashboard**
   - Go to railway.app and log in
   - Select your project
   - Select your API service

2. **Check Deployments**
   - Click "Deployments" tab
   - Latest deployment should show "Success" ✅
   - If red (failed), click it to see the error logs

3. **Check Environment Variables**
   - Click "Variables" tab
   - Verify all required variables are set (see checklist above)
   - Check for typos in variable names

4. **Check Logs**
   - Click "Logs" tab
   - Tail the logs: look for startup messages
   - Should see: "✅ Environment validation: X required variables loaded"
   - Should see: "API listening on http://0.0.0.0:PORT"

5. **Test the Health Endpoint**
   - Copy your Railway URL (e.g., https://api-production-8ac3.up.railway.app)
   - Open browser or curl: `curl https://your-url/health`
   - Should return JSON with status "ok"

6. **Test Organization Search**
   - `curl "https://your-url/organizations?q=test"`
   - Should return JSON array (empty or with results)

## If Still Not Working

**Collect this info and ask for help:**
1. Screenshot of Railway "Deployments" tab (show latest status)
2. Last 50 lines of Railway logs (from "Logs" tab)
3. Screenshot of "Variables" tab (redact secret keys)
4. Output of health check: `curl -v https://your-url/health`
5. Output of search: `curl "https://your-url/organizations?q=Westhill"`
6. Output of diagnostic script: `bash scripts/diagnose-westhill.sh`
