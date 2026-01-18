# VarsityHub Mobile & API

This repository contains the Expo mobile app and the Node/Express API.

**Repository Size**: ~18 MB (source code only, excludes generated artifacts)

## 🚀 Quick Start

### First Time Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/xsantcastx/VarsityHubMobile.git
   cd VarsityHubMobile
   ```

2. **Install dependencies**
   ```bash
   # Frontend dependencies
   npm install

   # Backend dependencies
   cd server && npm install && cd ..

   # iOS native dependencies (macOS only)
   cd ios && pod install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example file (create manually if .env.example doesn't exist)
   # See docs/ENV.md for all required variables
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Start development**
   ```bash
   # Terminal 1: Mobile app
   npm run start

   # Terminal 2: Backend server (if running locally)
   npm run server:dev
   ```

See **[docs/README.md](./docs/README.md)** for the full documentation index.

---

## 📚 Key Documentation

### Setup & Development
- **[docs/01-SETUP.md](./docs/01-SETUP.md)** - Development environment setup
- **[docs/02-PROJECT-STRUCTURE.md](./docs/02-PROJECT-STRUCTURE.md)** - Project structure guide
- **[docs/03-ENVIRONMENT.md](./docs/03-ENVIRONMENT.md)** - Environment configuration
- **[docs/04-DEVELOPMENT.md](./docs/04-DEVELOPMENT.md)** - Development workflow and standards

### Email System
- **[docs/EMAIL_GUIDE.md](./docs/EMAIL_GUIDE.md)** - Complete email system guide
- **[docs/EMAIL_ENV.md](./docs/EMAIL_ENV.md)** - Email environment variables
- **[docs/EMAIL_AUDIT.md](./docs/EMAIL_AUDIT.md)** - Email system audit

### Production
- **[docs/07-PRODUCTION.md](./docs/07-PRODUCTION.md)** - Production launch guide
- **[docs/PRODUCTION_HARDENING.md](./docs/PRODUCTION_HARDENING.md)** - Security hardening & audit notes
- **[docs/RAILWAY_ENV_SETUP.md](./docs/RAILWAY_ENV_SETUP.md)** - Railway deployment setup

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

### Development
```bash
npm run start                  # Start Expo dev server
npm run android               # Run on Android
npm run ios                   # Run on iOS (macOS only)
npm run web                   # Run on web
```

### Code Quality
```bash
npm run lint                  # Run ESLint
npm run lint:strict           # Run ESLint with auto-fix + typecheck
npm run typecheck            # Run TypeScript type checking
npm run format                # Format code with Prettier
npm run format:check          # Check code formatting
```

### Testing
```bash
npm test                      # Run Jest tests
npm run test:smoke            # Run Playwright E2E tests
npm run test:server           # Run server tests
```

### Server
```bash
npm run server:dev            # Start backend server
npm run server:db:migrate     # Run database migrations
npm run server:db:studio      # Open Prisma Studio (DB GUI)
npm run server:db:seed       # Seed database
```

### Building
```bash
npm run build:ios             # Build iOS app (EAS)
npm run build:android         # Build Android app (EAS)
npm run build:production      # Production build script
```

### Repository Health
```bash
npm run doctor                # Run Expo Doctor
./scripts/check-repo-health.sh # Verify clean state
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

## 📁 Project Structure

```
VarsityHubMobile/
├── app/                      # Expo Router screens (file-based routing)
├── components/               # React components
├── hooks/                    # Custom React hooks
├── utils/                    # Utility functions
├── api/                      # API client code
├── constants/                # App constants
├── context/                  # React context providers
├── config/                   # Configuration files
├── types/                    # TypeScript type definitions
├── server/                   # Backend API (Node.js/Express)
├── docs/                     # Documentation
│   ├── archive/             # Historical documentation
│   └── notes/               # Status reports and notes
├── scripts/                  # Build and utility scripts
├── tests/                    # Test files
└── assets/                   # Images, fonts, etc.
```

For detailed structure documentation, see **[docs/02-PROJECT-STRUCTURE.md](./docs/02-PROJECT-STRUCTURE.md)**.

---

## 🔧 Development Setup

### Prerequisites
- **Node.js**: v18 or higher
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli eas-cli`
- **iOS**: Xcode (Mac only) or Expo Go app
- **Android**: Android Studio or Expo Go app

### Environment Variables
See **[docs/ENV.md](./docs/ENV.md)** for complete environment variable documentation.

Key variables:
- `EXPO_PUBLIC_API_URL` - Backend API URL
- `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` - Google OAuth client IDs
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

### Code Style
- **ESLint**: Configured for React Native + TypeScript
- **Prettier**: Code formatting (run `npm run format`)
- **TypeScript**: Type checking (run `npm run typecheck`)

---

## 📚 Documentation

- **[docs/README.md](./docs/README.md)** - Documentation index
- **[docs/01-SETUP.md](./docs/01-SETUP.md)** - Detailed setup guide
- **[docs/02-PROJECT-STRUCTURE.md](./docs/02-PROJECT-STRUCTURE.md)** - Project structure
- **[docs/03-ENVIRONMENT.md](./docs/03-ENVIRONMENT.md)** - Environment configuration
- **[docs/ENV.md](./docs/ENV.md)** - Environment variables reference
- **[docs/REPO_AUDIT.md](./docs/REPO_AUDIT.md)** - Repository organization audit

---

**Last Updated**: December 2024  
**Security Grade**: A-  
**Repository Size**: ~18 MB (source) / ~2.5 GB (with dependencies)
