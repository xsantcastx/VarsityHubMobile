# Railway Deployment Guide for VarsityHub

## 🚂 Quick Railway Setup (15 minutes)

### Step 1: Railway Account Setup
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Create new project

### Step 2: Add PostgreSQL Database
1. Click "Add Service" → "Database" → "PostgreSQL"
2. Railway will automatically create the database
3. Note: `${{ Postgres.DATABASE_URL }}` is automatically available

### Step 3: Deploy Your Server
1. Click "Add Service" → "GitHub Repo"
2. Connect your VarsityHubMobile repository
3. Set root directory to: `server`
4. Railway will auto-detect Node.js

### Step 4: Environment Variables
Go to your server service → Variables tab and add:

```bash
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long-please-change-this
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=its.sc05@gmail.com
SMTP_PASS=oqjwfyovgmxuwobg
FROM_EMAIL=its.sc05@gmail.com
ADMIN_EMAILS=xsancastrillonx@hotmail.com
ALLOWED_ORIGINS=*
APP_SCHEME=varsityhubmobile
STRIPE_SECRET_KEY=sk_test_51S5t0kRuB2a0vFjp0bdj2NbzkDp6ACVhtWU48TXtNuviL0wnJxxIx0eBgg6whwiM9gJkNiqnINPbSQHqV9qRIxfe00KEwuxjwZ
STRIPE_WEBHOOK_SECRET=whsec_8f60823f31adfb85a3616a110e6a3d97fcfb529f8c0868a67a83b1d69edc833a
STRIPE_PRICE_VETERAN=price_1SCd6HRuB2a0vFjp1QlboTEv
STRIPE_PRICE_LEGEND=price_1SCd6IRuB2a0vFjpQOSdctN4
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
GOOGLE_MAPS_DEFAULT_COUNTRY=US
```

### Step 5: Deploy Settings
In your server service settings:
- **Start Command**: `npm start`
- **Build Command**: `npm run build`
- **Root Directory**: `server`

## 🔧 Railway Configuration Files

### Create railway.json in server directory:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Create Dockerfile (optional - for custom build):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]
```

## 🗃️ Database Setup Commands

After deployment, run these in Railway console:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed with beta test data
npm run seed
```

## 🌐 Get Your URLs

After deployment, Railway will give you:
- **Database URL**: Available as `${{ Postgres.DATABASE_URL }}`
- **Server URL**: Available as `${{ RAILWAY_PUBLIC_DOMAIN }}`

Update your frontend with the server URL!

## ✅ Deployment Checklist

- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] GitHub repository connected
- [ ] Environment variables configured
- [ ] Server deployed successfully
- [ ] Database migrations run
- [ ] Test data seeded
- [ ] API endpoints responding
- [ ] Frontend updated with production URL

## 🐛 Common Issues

### Build Fails
- Check that `server` is set as root directory
- Ensure `package.json` has correct scripts
- Verify all dependencies are listed

### Database Connection Issues
- Make sure `DATABASE_URL` uses `${{ Postgres.DATABASE_URL }}`
- Check SSL mode is enabled for production
- Verify migrations are run after deployment

### Environment Variables
- Don't use quotes around values in Railway UI
- `${{ Postgres.DATABASE_URL }}` is auto-injected
- `${{ PORT }}` is auto-injected by Railway

## 🚀 Success!

Once deployed:
1. Your API will be available at: `https://your-app-name.railway.app`
2. Update your mobile app to use this URL
3. Test all endpoints
4. Share with beta testers!

---
Railway makes deployment super easy! 🎉