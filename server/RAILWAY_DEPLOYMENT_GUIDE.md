# Railway Deployment Guide for VarsityHub Server

## Prerequisites
✅ Railway CLI installed (v4.10.0)
✅ Server configuration files ready
✅ Environment variables prepared

## Deployment Steps

### 1. Login to Railway
```powershell
railway login
```
This will open your browser to authenticate with Railway.

### 2. Initialize Railway Project (if new)

**Option A: Link to existing project**
```powershell
railway link
```
Select your existing project from the list.

**Option B: Create new project**
```powershell
railway init
```
Follow the prompts to create a new project.

### 3. Add PostgreSQL Database
In Railway dashboard or via CLI:
```powershell
railway add
```
Select "PostgreSQL" from the list. Railway will automatically provide the `DATABASE_URL` environment variable.

### 4. Set Environment Variables

**Required Environment Variables:**

```bash
# Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long-please-change-this
NODE_ENV=production

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=its.sc05@gmail.com
SMTP_PASS=oqjwfyovgmxuwobg
FROM_EMAIL=its.sc05@gmail.com
ADMIN_EMAILS=xsancastrillonx@hotmail.com

# CORS
ALLOWED_ORIGINS=*

# Application URLs
APP_SCHEME=varsityhubmobile

# Stripe
STRIPE_SECRET_KEY=sk_test_51S5t0kRuB2a0vFjp0bdj2NbzkDp6ACVhtWU48TXtNuviL0wnJxxIx0eBgg6whwiM9gJkNiqnINPbSQHqV9qRIxfe00KEwuxjwZ
STRIPE_WEBHOOK_SECRET=whsec_8f60823f31adfb85a3616a110e6a3d97fcfb529f8c0868a67a83b1d69edc833a
STRIPE_PRICE_VETERAN=price_1SCd6HRuB2a0vFjp1QlboTEv
STRIPE_PRICE_LEGEND=price_1SCd6IRuB2a0vFjpQOSdctN4

# Cloudinary (REQUIRED - Sign up at https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Google Maps (Optional)
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
GOOGLE_MAPS_DEFAULT_COUNTRY=US
```

**Set variables via CLI:**
```powershell
railway variables set JWT_SECRET="your-super-secure-jwt-secret-minimum-32-characters-long"
railway variables set NODE_ENV="production"
railway variables set SMTP_HOST="smtp.gmail.com"
railway variables set SMTP_PORT="587"
# ... continue for all variables
```

**Or set via Railway Dashboard:**
1. Go to https://railway.app/dashboard
2. Select your project
3. Click on your service
4. Go to "Variables" tab
5. Add each variable

### 5. Deploy to Railway
```powershell
railway up
```

This will:
- Build your application using the configuration in `.nixpacks.toml`
- Run `npm install && npm run build`
- Generate Prisma client
- Deploy to Railway

### 6. Run Database Migrations
After first deployment:
```powershell
railway run npx prisma migrate deploy
```

Or connect to your service and run:
```powershell
railway run npx prisma db push
```

### 7. Seed Database (Optional)
```powershell
railway run npm run seed
```

### 8. Get Your Deployment URL
```powershell
railway domain
```

Or check in Railway dashboard. Your server will be available at:
`https://your-project-name.up.railway.app`

## Monitoring & Logs

**View logs:**
```powershell
railway logs
```

**View service status:**
```powershell
railway status
```

**Open Railway dashboard:**
```powershell
railway open
```

## Important Configuration Files

Your server has these Railway configuration files:

1. **railway.json** - Railway service configuration
2. **railway.toml** - Deployment settings with health check
3. **.nixpacks.toml** - Build configuration (Node.js 20)

## Build & Deploy Commands

Your `package.json` includes:
- `build`: Generates Prisma client and compiles TypeScript
- `start`: Runs the production server
- `railway:deploy`: Build command for Railway

## Health Check

Railway will check `/health` endpoint with 300s timeout.

## Troubleshooting

### Database Connection Issues
```powershell
railway variables get DATABASE_URL
```
Verify the DATABASE_URL is properly set.

### Build Failures
Check logs:
```powershell
railway logs --deployment
```

### Migration Issues
Connect to service and run:
```powershell
railway shell
npx prisma migrate status
npx prisma migrate deploy
```

## Update Your Mobile App

After deployment, update your mobile app's API base URL to point to your Railway deployment:

```typescript
// In your mobile app constants
const API_BASE_URL = 'https://your-project-name.up.railway.app';
```

## Next Steps

1. ✅ Complete Cloudinary setup (required for image uploads)
2. ✅ Test all endpoints from mobile app
3. ✅ Set up custom domain (optional)
4. ✅ Enable production Stripe keys when ready
5. ✅ Configure Google Maps API (optional)

## Quick Deploy Commands

```powershell
# Full deployment workflow
railway login
railway link  # or railway init
railway add   # Add PostgreSQL
railway variables set KEY="value"  # Set all env vars
railway up
railway run npx prisma migrate deploy
railway domain
```

## Support Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Prisma Docs: https://www.prisma.io/docs
