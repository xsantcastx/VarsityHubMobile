# VarsityHub Mobile & API

This repository contains the Expo mobile app and the Node/Express API.

**Repository Size**: ~18 MB (source code only, excludes generated artifacts)

## 🚀 Quick Start

**Node version:** Use Node 20+ (`nvm use` will read `.nvmrc`). Older runtimes (Node 18) will throw `toReversed is not a function` during `expo start`.

### First Time Setup
```bash
# Install dependencies (generates ~2 GB of artifacts)
npm install

# iOS native dependencies (macOS only)
cd ios && pod install && cd ..

# Server dependencies
cd server && npm install && cd ..
```

### Start Development
```bash
# Terminal 1: Mobile app
npm run start

# Terminal 2: Backend server (if running locally)
cd server && npm run dev
```

See **[SETUP.md](./SETUP.md)** for detailed setup instructions.

---

## 📚 Key Documentation

- **[SETUP.md](./SETUP.md)** - Development environment setup
- **[SECURITY.md](./SECURITY.md)** - Security audit & foundation grade (A-)
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Feature implementation guide
- **[PRODUCTION_LAUNCH_CHECKLIST.md](./PRODUCTION_LAUNCH_CHECKLIST.md)** - Pre-launch checklist
- **[docs/RAILWAY_RUNBOOK.md](./docs/RAILWAY_RUNBOOK.md)** - Deployment guide

---

## 🔍 Repository Health

This repository is kept lean by excluding generated artifacts (~2 GB):
- `node_modules/` - npm dependencies
- `ios/Pods/` - CocoaPods dependencies  
- Build artifacts (`ios/build`, `android/build`)
- User uploads (`server/uploads/*`)

**Verify repository health**:
```bash
./scripts/check-repo-health.sh
```

---

## ✅ Quick Verify (Backend)

After deploying to Railway, verify endpoints:

```
SERVICE_URL="https://<your-service>.up.railway.app"
curl -i "$SERVICE_URL/health"     # 200 OK when DB reachable
curl -i "$SERVICE_URL/auth/me"    # 401 Unauthorized without token
```

Local DB connectivity check:

```
cd server
DATABASE_URL="postgresql://..." node scripts/check-db.js
```

---

## 🔐 Security

**Foundation Grade: A-** (see [SECURITY.md](./SECURITY.md))

Recent security enhancements:
- ✅ Refresh token system (1h access tokens + 30d refresh)
- ✅ Comprehensive audit logging
- ✅ JWT secret validation on startup
- ✅ Rate limiting on authentication endpoints

---

## 🛠️ Common Commands

```bash
# Development
npm install                    # Install root dependencies
npx expo start                 # Start Expo dev server  
npx expo start --ios          # Start with iOS simulator

# Server
cd server && npm install       # Install backend deps
cd server && npm run dev       # Start backend server
cd server && npx prisma studio # Open database GUI

# iOS (macOS only)
cd ios && pod install          # Install CocoaPods
npx expo run:ios              # Build and run on iOS

# Repository health
./scripts/check-repo-health.sh # Verify clean state
du -sh * | sort -h             # Check directory sizes
```

---

## 🧪 Feature Flags

- `EXPO_PUBLIC_FORCE_SAMPLE_FEED`: When set to `true`, the Feed shows bundled sample events (UNC/Duke, Warriors/Lakers, Patriots/Jets) regardless of backend results. Great for demos and regression tests. Configure in `.env` or your CI/CD env.

Example:
```bash
EXPO_PUBLIC_FORCE_SAMPLE_FEED=true npx expo start
```

On EAS/production, set it via your environment management (or keep `false` to use live data).

---

**Last Updated**: December 2, 2025  
**Security Grade**: A-  
**Repository Size**: ~18 MB (source) / ~2.5 GB (with dependencies)
