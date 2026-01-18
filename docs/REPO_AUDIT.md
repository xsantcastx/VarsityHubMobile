# Repository Audit & Reorganization Plan

**Date**: January 17, 2025  
**Repository**: VarsityHub Mobile & API  
**Framework**: Expo Router (React Native) + Express.js Backend  
**Status**: Current structure analyzed, reorganization plan created

---

## 📊 Current Structure Snapshot

### Root Directory Issues

**Problems:**
- **25+ files in root directory** (should be < 10)
- Scripts scattered across root and `scripts/` directory
- Temporary directories (overnight-logs-*, test-results) in root
- No `.env.example` file
- Multiple markdown files in root that should be in `docs/`

**Files that should be moved:**
- `*.sh` scripts → `scripts/`
- `*.md` documentation → `docs/`
- Temporary log directories → `.gitignore` (or remove)
- Overnight scripts → `scripts/overnight/`

### Directory Structure

```
VarsityHubMobile/
├── app/                    ✅ Expo Router screens (correct - don't move)
├── components/             ✅ Reusable components (correct)
├── hooks/                  ✅ Custom hooks (correct)
├── utils/                  ✅ Utilities (correct)
├── api/                    ✅ API client (correct)
├── constants/              ✅ Constants (correct)
├── context/                ✅ React context (correct)
├── config/                 ✅ Config files (correct)
├── types/                  ✅ TypeScript types (correct)
├── server/                 ✅ Backend (correct - monorepo structure)
├── docs/                   ✅ Documentation (needs organization)
├── scripts/                ⚠️  Some scripts missing
├── assets/                 ✅ Static assets (correct)
├── tests/                  ✅ Test files (correct)
├── shared/                 ✅ Shared code (correct)
├── tools/                  ✅ Build tools (correct)
└── [ROOT CLUTTER]          ❌ 25+ files that should be organized
```

---

## 🎯 Pain Points

### 1. Root Directory Clutter
- **25+ files in root** causing confusion
- Hard to find important files (package.json, app.json buried)
- Scripts scattered between root and `scripts/`
- Temporary directories not cleaned up

### 2. Script Organization
- Scripts in root: `start.sh`, `start-overnight.sh`, `*.sh`
- Scripts in `scripts/`: Various utility scripts
- **No clear convention** for where scripts belong
- Overnight scripts should be grouped separately

### 3. Documentation Scattered
- Some docs in root: `README.md`, `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`
- Some docs in `docs/`: Various documentation files
- **No clear structure** for documentation

### 4. Missing Standard Files
- **No `.env.example`** - hard to know what env vars are needed
- **No `CONTRIBUTING.md`** - no contribution guidelines
- **No `CHANGELOG.md`** - no change tracking
- Incomplete `.gitignore` - temporary files committed

### 5. Configuration Inconsistencies
- TypeScript config: `strict: false` (should be stricter)
- ESLint config exists but may need improvements
- Prettier config exists but may need review
- No Husky/lint-staged setup

### 6. Component Organization
- `components/` directory ✅ (good)
- `app/components/` directory ⚠️ (duplicate? screen-specific?)
- **Unclear** when to use which directory

---

## ✅ Quick Wins

### Phase 1: Root Directory Cleanup (30 mins)
1. **Move all `.sh` scripts to `scripts/`**
   - Consolidate overnight scripts into `scripts/overnight/`
   - Keep only essential root scripts (if any)

2. **Move documentation files to `docs/`**
   - `PRIVACY_POLICY.md` → `docs/legal/PRIVACY_POLICY.md`
   - `TERMS_OF_SERVICE.md` → `docs/legal/TERMS_OF_SERVICE.md`
   - `BUILD_AND_INSTALL.md` → `docs/setup/BUILD_AND_INSTALL.md`
   - `INSTALL_ANDROID_DEVICE.md` → `docs/setup/INSTALL_ANDROID_DEVICE.md`
   - `QUICK_INSTALL_GUIDE.md` → `docs/setup/QUICK_INSTALL_GUIDE.md`

3. **Clean up temporary directories**
   - Add `overnight-*/`, `test-results/`, `playwright-report/` to `.gitignore`
   - Remove committed temporary directories

4. **Create `.env.example`**
   - Document all required environment variables
   - Create `docs/ENV.md` with detailed explanations

### Phase 2: Configuration Improvements (30 mins)
1. **Improve TypeScript strictness** (carefully)
   - Enable `strict: true` incrementally
   - Fix type errors as they appear

2. **Review ESLint config**
   - Ensure all recommended rules are enabled
   - Add React Native specific rules

3. **Add Husky + lint-staged** (optional)
   - Pre-commit hooks for linting/formatting
   - Pre-push hooks for type checking

### Phase 3: Documentation Enhancement (1 hour)
1. **Update README.md**
   - Clear project overview
   - Step-by-step setup guide
   - Folder structure explanation
   - Troubleshooting section

2. **Create CONTRIBUTING.md**
   - Contribution guidelines
   - Code style standards
   - PR process

3. **Create CHANGELOG.md**
   - Track changes and releases

### Phase 4: CI/CD Setup (30 mins)
1. **Add GitHub Actions workflow**
   - Lint check
   - Type check
   - Test run (if tests exist)
   - Keep it fast and non-flaky

---

## ⚠️ Risks

### 1. Breaking Changes
- **Risk**: Moving files could break imports
- **Mitigation**: Use path aliases (`@/` imports), update imports incrementally
- **Test**: Run `npm run typecheck` after each change

### 2. Expo Router Requirements
- **Risk**: Moving files from `app/` breaks routing
- **Mitigation**: **DO NOT move files from `app/` directory** - it's Expo Router's routing directory
- **Note**: `app/` structure must remain as-is for file-based routing

### 3. Script Dependencies
- **Risk**: Scripts may have hardcoded paths
- **Mitigation**: Use relative paths, test scripts after moving
- **Check**: Update any scripts that reference moved files

### 4. Build System
- **Risk**: Metro bundler or build config may break
- **Mitigation**: Test build after changes: `npm run build:ios` and `npm run build:android`
- **Verify**: App still runs in Expo Go

---

## 🏗️ Proposed Target Structure

### Root Directory (Clean)

```
VarsityHubMobile/
├── .env.example            ✨ NEW - Environment template
├── .gitignore              ✅ Already exists (needs updates)
├── .editorconfig           ✅ Already exists
├── .prettierrc             ✅ Already exists
├── package.json             ✅ Stays
├── package-lock.json        ✅ Stays
├── tsconfig.json            ✅ Stays
├── app.json                 ✅ Stays (Expo config)
├── eas.json                 ✅ Stays (EAS config)
├── babel.config.js          ✅ Stays
├── metro.config.js          ✅ Stays
├── eslint.config.js         ✅ Stays (may need creation)
├── jest.config.js           ✅ Stays
├── playwright.config.ts     ✅ Stays
├── README.md                ✅ Stays (improved)
├── CONTRIBUTING.md          ✨ NEW
├── CHANGELOG.md             ✨ NEW
├── LICENSE                  ✨ NEW (if missing)
└── [NO OTHER FILES]         ✅ Clean root
```

### Organized Directory Structure

```
VarsityHubMobile/
├── app/                     ✅ Expo Router (file-based routing - DON'T CHANGE)
│   ├── (tabs)/              ✅ Tab routes
│   ├── onboarding/          ✅ Onboarding flow
│   ├── settings/            ✅ Settings screens
│   └── ...                  ✅ All route files
│
├── src/                     ⚠️  Currently missing - could add for non-route code
│   ├── features/            ✨ NEW - Feature-based organization
│   │   ├── auth/
│   │   ├── teams/
│   │   ├── games/
│   │   └── payments/
│   ├── components/          ⚠️  Move from root/components? (see note)
│   ├── hooks/               ⚠️  Move from root/hooks? (see note)
│   ├── utils/               ⚠️  Move from root/utils? (see note)
│   └── types/               ⚠️  Move from root/types? (see note)
│
├── components/              ✅ Current location (keep OR move to src/components)
├── hooks/                   ✅ Current location (keep OR move to src/hooks)
├── utils/                   ✅ Current location (keep OR move to src/utils)
├── constants/               ✅ Current location (keep OR move to src/constants)
├── api/                     ✅ API client (keep current)
├── context/                 ✅ React context (keep current)
├── config/                  ✅ Config (keep current)
├── types/                   ✅ Types (keep current)
├── assets/                  ✅ Static assets (keep current)
│
├── server/                  ✅ Backend (keep current - monorepo structure)
│   ├── src/
│   ├── prisma/
│   └── ...
│
├── scripts/                 ✅ Organized scripts
│   ├── setup/               ✨ NEW - Setup scripts
│   ├── build/               ✨ NEW - Build scripts
│   ├── deploy/              ✨ NEW - Deployment scripts
│   ├── overnight/           ✨ NEW - Overnight automation
│   └── utils/               ✨ NEW - Utility scripts
│
├── docs/                    ✅ Enhanced documentation
│   ├── README.md            ✅ Documentation index
│   ├── setup/               ✨ NEW - Setup guides
│   ├── legal/               ✨ NEW - Legal documents
│   ├── architecture/        ✅ Already exists
│   └── ...
│
├── tests/                   ✅ Test files (keep current)
├── shared/                  ✅ Shared code (keep current)
├── tools/                   ✅ Build tools (keep current)
├── .github/                 ✅ GitHub config
│   └── workflows/           ✅ CI workflows (enhance)
│
└── [Clean root directory]   ✅ Only essential files
```

**Note on src/ directory:**
- Expo Router uses `app/` for routing, which is correct
- We can add `src/` for non-route code, but path aliases (`@/`) already work
- **Recommendation**: Keep current structure (components, hooks, utils at root) since path aliases are configured
- Alternative: Move to `src/` for better organization, but requires updating all imports

---

## 🔧 Implementation Plan

### Step 1: Create Audit Report ✅
- [x] Document current structure
- [x] Identify pain points
- [x] Propose target structure
- [x] Assess risks

### Step 2: Root Directory Cleanup
1. Move scripts to `scripts/` directory
2. Move documentation to `docs/` directory
3. Clean up temporary directories
4. Update `.gitignore`

### Step 3: Environment Setup
1. Create `.env.example`
2. Create `docs/ENV.md`
3. Verify env var usage

### Step 4: Configuration Improvements
1. Review ESLint config
2. Review Prettier config
3. Improve TypeScript config (incrementally)
4. Add Husky (optional)

### Step 5: Documentation
1. Update README.md
2. Create CONTRIBUTING.md
3. Create CHANGELOG.md
4. Organize docs/ directory

### Step 6: CI/CD
1. Create GitHub Actions workflow
2. Add lint, typecheck, test jobs
3. Test workflow

### Step 7: Verification
1. Run `npm run typecheck` - should pass
2. Run `npm run lint` - should pass
3. Run `npm run build:ios` - should work
4. Run `npm run build:android` - should work
5. Test app in Expo Go - should work

---

## 📋 File Organization Rules

### Root Directory
- **Only essential config files**
- **README.md, CONTRIBUTING.md, CHANGELOG.md**
- **No scripts, no temporary files, no scattered docs**

### Scripts
- **All scripts in `scripts/` directory**
- **Organized by purpose** (setup, build, deploy, overnight)
- **Naming**: `kebab-case.sh` or `kebab-case.js`

### Documentation
- **All docs in `docs/` directory**
- **Organized by topic** (setup, legal, architecture, etc.)
- **README.md stays in root** (entry point)

### Components
- **Keep `components/` at root** (or move to `src/components/`)
- **Screen-specific components**: `app/components/`
- **Reusable components**: `components/` or `src/components/`

---

## 🎯 Success Criteria

After reorganization:
- ✅ Root directory has < 10 files
- ✅ All scripts in `scripts/` directory
- ✅ All documentation in `docs/` directory
- ✅ `.env.example` exists
- ✅ TypeScript compiles without errors
- ✅ App builds successfully (iOS & Android)
- ✅ App runs in Expo Go
- ✅ CI workflow passes
- ✅ README.md is clear and helpful
- ✅ Folder structure is logical and scalable

---

## ⚠️ Important Notes

### DO NOT CHANGE:
- ❌ `app/` directory structure (Expo Router file-based routing)
- ❌ Server structure (monorepo backend)
- ❌ Path aliases configuration (already working)
- ❌ Package.json scripts (unless improving)
- ❌ Build configurations (unless fixing)

### DO CHANGE:
- ✅ Root directory cleanup
- ✅ Script organization
- ✅ Documentation organization
- ✅ Add missing standard files
- ✅ Improve configurations (incrementally)
- ✅ Add CI workflows

---

**Next Steps**: Implement changes incrementally, test after each step, commit logically.
