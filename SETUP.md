# VarsityHub Development Setup

## Quick Start (After Clone)

The repository is kept lean (~18 MB) by excluding generated artifacts. Follow these steps to get running:

### 1. Install Root Dependencies
```bash
npm install
```

### 2. Install iOS Native Dependencies
```bash
cd ios
pod install
cd ..
```

### 3. Install Server Dependencies
```bash
cd server
npm install
cd ..
```

### 4. Setup Environment Variables
```bash
# Copy and configure root .env
cp .env.example .env  # If needed
# Edit .env with your API keys

# Copy and configure server .env
cd server
cp .env.example .env  # If needed
# Edit .env with database URL, JWT secret, etc.
cd ..
```

### 5. Run Development Server
```bash
# Terminal 1: Start Expo dev server
npx expo start

# Terminal 2: Start backend server (if running locally)
cd server
npm run dev
```

---

## What's Excluded from Git

The following are regenerated on setup (excluded via `.gitignore`):

### Root Level
- `node_modules/` - npm dependencies (~500 MB)
- `ios/Pods/` - CocoaPods dependencies (~800 MB)
- `ios/build/` - Xcode build artifacts
- `.expo/` - Expo cache

### Server Directory
- `server/node_modules/` - Backend dependencies (~300 MB)
- `server/ios/Pods/` - Server iOS deps (if applicable)
- `server/ios/build/` - Build artifacts
- `server/uploads/*` - User uploads (except `.gitkeep`)

**Total excluded**: ~2 GB of generated files

---

## Repository Size

- **Source code**: ~18 MB (actual codebase)
- **After `npm install`**: ~2.5 GB (with all dependencies)

---

## Platform-Specific Setup

### iOS Development
```bash
# Requires macOS with Xcode installed
cd ios
pod install
cd ..
npx expo run:ios
```

### Android Development
```bash
# Requires Android Studio & SDK
npx expo run:android
```

### Server Only
```bash
cd server
npm install
npm run dev
```

---

## Database Setup

### Local Development
```bash
cd server

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database (optional)
npm run seed
```

### Production (Railway)
```bash
# Apply migrations
railway shell
cd server
npx prisma migrate deploy
npx prisma generate
```

---

## Troubleshooting

### "Cannot find module" errors
```bash
# Reinstall all dependencies
npm install
cd ios && pod install && cd ..
cd server && npm install && cd ..
```

### Xcode build fails
```bash
# Clean iOS build
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..
```

### Server won't start
```bash
# Regenerate Prisma client
cd server
npx prisma generate
npm run dev
```

### Expo cache issues
```bash
# Clear Expo cache
npx expo start --clear
```

---

## Pre-Commit Checklist

Before pushing changes:

- [ ] Run `npm run lint` (if configured)
- [ ] Test on iOS simulator
- [ ] Test on Android emulator (if applicable)
- [ ] Verify server starts: `cd server && npm run dev`
- [ ] Check no large files added: `git status` (should not see `node_modules/` or `Pods/`)

---

## Security Note

**Never commit**:
- `.env` files with real secrets
- `node_modules/` or `Pods/`
- Build artifacts (`ios/build`, `android/build`)
- User uploads (`server/uploads/*` except `.gitkeep`)

All secrets should be in `.env` (gitignored) or Railway environment variables.

---

## Quick Commands Reference

```bash
# Development
npm install                          # Install root deps
npx expo start                       # Start Expo dev server
npx expo start --ios                 # Start with iOS simulator

# Server
cd server && npm install             # Install server deps
cd server && npm run dev             # Start backend server
cd server && npx prisma studio       # Open database GUI

# iOS
cd ios && pod install                # Install CocoaPods deps
npx expo run:ios                     # Build and run on iOS

# Clean rebuild
rm -rf node_modules ios/Pods server/node_modules
npm install
cd ios && pod install && cd ..
cd server && npm install && cd ..
```

---

**Repository cleaned**: December 2, 2025  
**Source code size**: ~18 MB  
**Full install size**: ~2.5 GB (with dependencies)
