# 🚀 VarsityHub Setup Guide

## Prerequisites

### Required Software
- **Node.js**: v18 or higher
- **npm** or **yarn**
- **Git**
- **Expo CLI**: `npm install -g expo-cli eas-cli`
- **iOS**: Xcode (Mac only) or Expo Go app
- **Android**: Android Studio or Expo Go app

### Required Accounts
- **Expo Account** (free): https://expo.dev
- **Google Cloud Account** (for Maps & OAuth)
- **Stripe Account** (for payments)
- **Railway Account** (for backend hosting)

---

## 📦 Installation

### 1. Clone Repository
```bash
git clone https://github.com/xsantcastx/VarsityHubMobile.git
cd VarsityHubMobile
```

### 2. Install Dependencies

#### Frontend (Mobile App)
```bash
npm install
```

#### Backend (Server)
```bash
cd server
npm install
cd ..
```

### 3. Environment Setup

#### Frontend - Create `.env` file in root:
```properties
# API URL
EXPO_PUBLIC_API_URL=http://192.168.0.11:4000  # Local development
# EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app  # Production

# App Configuration
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
EXPO_PUBLIC_NODE_ENV=development

# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=your-expo-client-id
```

#### Backend - Create `server/.env` file:
```properties
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Security
JWT_SECRET=your-long-random-string

# Server
PORT=4000

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
ADMIN_EMAILS=admin@example.com

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PRICE_VETERAN=price_id_for_veteran
STRIPE_PRICE_LEGEND=price_id_for_legend

# App URLs
APP_BASE_URL=http://localhost:4000
APP_SCHEME=varsityhubmobile

# Cloudinary (for media uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-key
GOOGLE_MAPS_DEFAULT_COUNTRY=US

# CORS
ALLOWED_ORIGINS=http://localhost:9500,http://localhost:5173
```

### 4. Database Setup
```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

---

## 🏃 Running the App

### Development Mode

#### Start Backend Server
```bash
npm run server:dev
```
Server will run on: http://localhost:4000

#### Start Mobile App
```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

### Useful Commands

```bash
# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web

# Database studio (view data)
npm run server:db:studio

# Run migrations
npm run server:db:migrate

# Lint code
npm run lint
```

---

## 🔧 Configuration

### Google OAuth Setup

1. Go to: https://console.cloud.google.com
2. Create new project (or select existing)
3. Enable **Google+ API**
4. Create OAuth 2.0 credentials:
   - **Android OAuth Client**
   - **iOS OAuth Client**
   - **Web Application**
5. Copy client IDs to `.env`

See: [Environment Setup](./03-ENVIRONMENT.md#google-oauth)

### Google Maps Setup

1. Go to: https://console.cloud.google.com
2. Enable APIs:
   - **Maps SDK for iOS**
   - **Maps SDK for Android**
   - **Geocoding API**
3. Create API keys (iOS and Android)
4. Add to `app.json` and `server/.env`

See: [Environment Setup](./03-ENVIRONMENT.md#google-maps)

### Stripe Setup

1. Go to: https://dashboard.stripe.com
2. Get API keys from **Developers → API Keys**
3. Create products and prices:
   - Veteran: $9.99/month
   - Legend: $19.99/month
4. Copy price IDs to `server/.env`
5. Set up webhook endpoint (for production)

See: [Environment Setup](./03-ENVIRONMENT.md#stripe)

---

## 🌐 Network Configuration

### Finding Your Local IP (for testing on physical devices)

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.0.11)

**Mac/Linux:**
```bash
ifconfig
```
Look for "inet" under your active connection

**Update `.env`:**
```properties
EXPO_PUBLIC_API_URL=http://YOUR_IP:4000
```

---

## ✅ Verify Setup

### 1. Backend Health Check
```bash
curl http://localhost:4000/health
```
Should return: `{"status":"ok"}`

### 2. Run Mobile App
Start app and verify:
- ✅ App loads without errors
- ✅ Sign-up screen appears
- ✅ Can create account
- ✅ API requests work

### 3. Check Console
- No red errors in terminal
- No critical warnings in Expo Dev Tools

---

## 🐛 Troubleshooting

### "Cannot connect to server"
- Verify backend is running (`npm run server:dev`)
- Check `EXPO_PUBLIC_API_URL` in `.env`
- Ensure firewall allows port 4000
- Use correct IP address (not `localhost` for physical devices)

### "Database connection failed"
- Verify `DATABASE_URL` in `server/.env`
- Run migrations: `npm run server:db:migrate`
- Check PostgreSQL is running

### "Google OAuth not working"
- Verify client IDs in `.env`
- Check OAuth consent screen is configured
- Ensure redirect URIs are correct

### "Module not found"
- Delete `node_modules` and reinstall:
  ```bash
  rm -rf node_modules
  npm install
  ```

### "Metro bundler issues"
- Clear cache:
  ```bash
  npm start -- --clear
  ```

---

## 📖 Next Steps

1. ✅ **Read**: [Project Structure](./02-PROJECT-STRUCTURE.md)
2. ✅ **Configure**: [Environment Variables](./03-ENVIRONMENT.md)
3. ✅ **Develop**: [Development Guide](./04-DEVELOPMENT.md)
4. ✅ **Features**: [Features Overview](./05-FEATURES.md)

---

## 🆘 Need Help?

- **Expo Docs**: https://docs.expo.dev
- **React Native Docs**: https://reactnative.dev
- **Troubleshooting**: [Common Issues](./11-TROUBLESHOOTING.md)

---

**Ready to code! 🎉**
