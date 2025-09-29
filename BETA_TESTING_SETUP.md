# 🚀 VarsityHub Beta Testing Setup Guide

## 📋 Pre-Launch Checklist

### 1. Database Setup (Production Ready) ✅
- [x] Local PostgreSQL working
- [ ] Production database deployment
- [ ] Environment variables configured
- [ ] Database seeded with sample data

### 2. Backend Deployment 🚀
- [ ] Deploy to Railway/Render/Heroku
- [ ] Configure production environment variables
- [ ] Test API endpoints
- [ ] Set up monitoring

### 3. Frontend Configuration 📱
- [ ] Update API URLs for production
- [ ] Build for internal distribution
- [ ] Test on real devices
- [ ] Configure push notifications (optional)

### 4. Beta Testing Preparation 👥
- [ ] Create test user accounts
- [ ] Prepare sample sports content
- [ ] Document testing scenarios
- [ ] Set up feedback collection

## 🎯 Step-by-Step Implementation

### Step 1: Database Deployment Options

#### Option A: Railway (Recommended)
```bash
# 1. Sign up at railway.app
# 2. Create new PostgreSQL database
# 3. Get connection string
# 4. Update production .env
```

#### Option B: Render
```bash
# 1. Sign up at render.com
# 2. Create PostgreSQL database
# 3. Get connection details
# 4. Configure environment
```

#### Option C: Supabase (Free tier)
```bash
# 1. Sign up at supabase.com
# 2. Create new project
# 3. Get database URL
# 4. Run migrations
```

### Step 2: Backend Deployment

#### Railway Deployment (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize in server directory
cd server
railway init

# Deploy
railway up
```

#### Environment Variables for Production
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secure-jwt-secret-here
PORT=4000
NODE_ENV=production

# Email (keep your current SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=its.sc05@gmail.com
SMTP_PASS=oqjwfyovgmxuwobg
FROM_EMAIL=its.sc05@gmail.com

# CORS for mobile app
ALLOWED_ORIGINS=*

# Production URLs
APP_BASE_URL=https://your-app.railway.app
```

### Step 3: Frontend Production Build

#### Update API Configuration
```typescript
// Create src/config/api.ts
export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.0.11:4000'  // Your local IP
  : 'https://your-app.railway.app';  // Production URL
```

#### Expo Build for Internal Distribution
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for internal distribution
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

### Step 4: Beta Testing Materials

#### Sample Test Accounts
- **Coach Account**: coach@test.com / password123
- **Player Account**: player@test.com / password123  
- **Fan Account**: fan@test.com / password123

#### Sample Sports Content
- Football highlights from recent games
- Basketball team updates
- Baseball season statistics
- Soccer match results

## 🔧 Quick Deployment Script

### Railway Deployment (Fastest)
```bash
# 1. Database Setup
echo "Setting up production database..."
# Go to railway.app, create PostgreSQL service
# Copy connection string

# 2. Server Deployment  
cd server
npm install
railway login
railway init
railway up

# 3. Configure Frontend
cd ..
# Update API_BASE_URL in your code
```

## 📱 Distribution Methods

### Option 1: Expo Go (Easiest)
- Beta testers install Expo Go app
- Share QR code or link
- Instant updates
- **Limitation**: Some native features limited

### Option 2: Development Build (Recommended)
- Custom app build with your branding
- Full native functionality  
- Distributed via TestFlight (iOS) or Play Console (Android)
- **Setup**: Requires Expo EAS build

### Option 3: Internal Distribution
- Direct APK/IPA file sharing
- No app store approval needed
- **iOS**: Requires Apple Developer Program ($99/year)
- **Android**: Allow "Unknown Sources"

## 🧪 Beta Testing Scenarios

### Core Features to Test
1. **Account Creation & Login**
   - Sign up with email
   - Email verification
   - Password reset

2. **Sports Content Browsing**
   - View highlights feed
   - Filter by sport categories
   - Scroll through trending content

3. **Social Interactions**
   - Upvote posts (visual feedback)
   - Comment on posts
   - Follow other users
   - Save/bookmark content
   - Share posts

4. **Profile Management**
   - Edit profile information
   - View follower/following lists
   - Update preferences

5. **Performance Testing**
   - App loading speed
   - Smooth scrolling
   - Image/video loading
   - Network error handling

## 📝 Feedback Collection

### Beta Testing Form
```markdown
**Beta Tester Feedback Form**

**Device Info:**
- Device: 
- OS Version:
- App Version:

**Feature Testing:**
- [ ] Account creation worked
- [ ] Can browse highlights
- [ ] Upvoting works
- [ ] Commenting works
- [ ] Following works
- [ ] Sharing works

**Issues Found:**
1. Bug description:
2. Steps to reproduce:
3. Expected vs actual behavior:

**Overall Experience (1-10):**
**Most liked feature:**
**Suggestions for improvement:**
```

## ⚡ Quick Start (30 Minutes)

### Minimal Beta Setup
1. **Deploy Database** (5 min): Sign up for Railway, create PostgreSQL
2. **Deploy Backend** (10 min): `railway up` from server directory  
3. **Update Frontend** (5 min): Change API URL in code
4. **Build App** (10 min): `expo publish` or share via Expo Go

### Beta Tester Instructions
```markdown
**VarsityHub Beta Test - Setup Instructions**

1. **Install Expo Go** (if using Expo Go method)
   - iOS: Download from App Store
   - Android: Download from Play Store

2. **Join Beta Test**
   - Open this link: [Your Expo Link]
   - Or scan QR code: [Your QR Code]

3. **Test Account**
   - Email: beta@test.com
   - Password: beta123

4. **What to Test**
   - Browse sports highlights
   - Try upvoting posts
   - Add comments
   - Follow other users
   - Share content

5. **Report Issues**
   - Send feedback to: [your-email]
   - Include screenshots if possible
```

## 🎉 Launch Day Checklist

- [ ] Database is running and accessible
- [ ] Backend API is deployed and responding
- [ ] Frontend is built and distributed
- [ ] Test accounts are created
- [ ] Sample content is loaded
- [ ] Beta testers have access
- [ ] Feedback collection is set up
- [ ] Monitoring is in place

---

**Ready to launch your sports app beta! 🏈🚀**