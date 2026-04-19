# VarsityHub Mobile & API

This repository contains the Expo mobile app and the Node/Express API.

**Repository Size**: ~18 MB (source code only, excludes generated artifacts)

## 🚀 Quick Start

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
# One command to run mobile + server
npm run dev
```

See **[docs/INDEX.md](./docs/INDEX.md)** for the full documentation index.

---

## 📚 Key Documentation

- **[docs/INDEX.md](./docs/INDEX.md)** - Documentation entry point
- **[docs/AUDIT_STANDARD.md](./docs/AUDIT_STANDARD.md)** - Canonical audit standard and invariants
- **[docs/AUDIT_EXECUTION_GUIDE.md](./docs/AUDIT_EXECUTION_GUIDE.md)** - Audit workflow and finding templates
- **[docs/PR_CHECKLIST.md](./docs/PR_CHECKLIST.md)** - PR review and release readiness checklist for protected changes
- **[docs/01-SETUP.md](./docs/01-SETUP.md)** - Development environment setup
- **[docs/04-DEVELOPMENT.md](./docs/04-DEVELOPMENT.md)** - Development workflow and standards
- **[docs/07-PRODUCTION.md](./docs/07-PRODUCTION.md)** - Production launch guide
- **[docs/release/CHECKLIST.md](./docs/release/CHECKLIST.md)** - Release gating checklist
- **[docs/status/INDEX.md](./docs/status/INDEX.md)** - Status reports and checklists

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

```bash
SERVICE_URL="https://<your-service>.up.railway.app"
./scripts/smoke-test.sh
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
- ✅ Coach approval system (PENDING coaches blocked until approved by super admin or league owner)

---

## 🛠️ Common Commands

```bash
# Development
npm install                    # Install root dependencies
npm run dev                    # Start mobile + server
npm run dev:expo               # Start Expo dev server only

# Server
cd server && npm install       # Install backend deps
cd server && npm run dev       # Start backend server
cd server && npx prisma studio # Open database GUI

# iOS (macOS only)
cd ios && pod install          # Install CocoaPods
npx expo run:ios              # Build and run on iOS

# Repository health
./scripts/check-repo-health.sh # Verify clean state
./scripts/clean-repo-artifacts.sh
du -sh * | sort -h             # Check directory sizes

# Coach approval (server)
cd server && npm run verify:coach-approval  # Static verification
cd server && npm test -- --testPathPattern="coach-approval"  # Integration tests (requires DB)
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

**Last Updated**: March 16, 2026  
**Security Grade**: A-  
**Repository Size**: ~18 MB (source) / ~2.5 GB (with dependencies)
