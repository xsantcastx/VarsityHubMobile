# 📁 VarsityHub Project Organization

This document outlines the organized folder structure for the VarsityHub mobile application.

## 🗂️ Root Directory Structure

```
VarsityHub/
├── 📱 app/                     # React Native app screens and navigation
├── 🎨 assets/                  # Images, fonts, animations
├── 🧩 components/              # Reusable React Native components
├── 📊 constants/               # App constants and configuration
├── 🔄 context/                 # React context providers
├── 🪝 hooks/                   # Custom React hooks
├── 📷 screenshots/             # App screenshots
├── 🌐 src/                     # Web version source code
├── 🗄️ server/                 # Backend Node.js server
├── 🛠️ tools/                   # Development tools and patches
├── 🔧 utils/                   # Utility functions
├── 📄 *.config.js             # Configuration files
├── 📋 *.json                  # Package and app configuration
└── 📖 *.md                    # Documentation
```

## 🗄️ Server Organization

```
server/
├── 📂 src/                    # TypeScript source code
│   ├── 🔌 routes/            # API endpoints
│   ├── 🔐 middleware/        # Authentication, validation
│   └── 📚 lib/               # Shared utilities
├── 🗃️ prisma/                # Database schema and migrations
├── 📁 scripts/               # Administrative scripts
│   ├── 💾 database/          # User and subscription management
│   └── 💳 stripe/            # Payment system scripts
└── 📋 uploads/               # File uploads storage
```

## 🛠️ Tools Organization

```
tools/
├── 🩹 patches/               # React Native/Expo patches
│   └── patch-*.js           # Auto-applied compatibility fixes
├── 📦 shims/                # Compatibility shims
├── ensure-*.js              # Dependency verification scripts
├── *.py                     # Legacy Python utilities
└── 📖 README.md             # Tools documentation
```

## 🧹 What Was Cleaned Up

### ❌ Removed Files
- Duplicate subscription test scripts
- Temporary files (`temp_script.ps1`, React Native debug files)
- Old CommonJS versions of working ES module scripts
- Unused test files (`test-delete-edit.js`, `tmp_check.py`)

### ✅ Organized Files
- **Server Scripts**: Moved to `server/scripts/` with logical subfolders
- **Development Tools**: Consolidated in `tools/` folder
- **Patches**: Separated into `tools/patches/`
- **Documentation**: Added README files explaining each folder

## 🎯 Benefits of This Organization

1. **🔍 Easy to Find**: Related scripts are grouped logically
2. **🛡️ Secure**: Sensitive scripts (Stripe) are clearly separated  
3. **📚 Documented**: Each folder has clear documentation
4. **🧼 Clean**: No duplicate or temporary files cluttering workspace
5. **⚡ Efficient**: Development tools don't mix with production scripts

## 🚀 Quick Access Commands

```bash
# Check user subscriptions
cd server && node scripts/database/check_user_plans.mjs

# Reset unpaid users
cd server && node scripts/database/reset_unpaid_simple.mjs

# Create Stripe prices
cd server && node scripts/stripe/create_stripe_prices.js

# Apply patches
node tools/patches/patch-logbox-all.js
```