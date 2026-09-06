# Code & Branch Organization Audit

**Date:** January 12, 2025

---

## 🔍 Current State Analysis

### Git Branches

**Main Branch:** `main` ✅

**Remote Branches (25+):**

- ✅ Active: `main`, `develop`
- ⚠️ Old/Stale: Multiple `dependabot/*` branches (7+)
- ⚠️ Old/Stale: Multiple `snyk-upgrade/*` branches (6+)
- ⚠️ Typo: `develope` (should probably be deleted)
- ⚠️ Feature: `chore/deploy-checklist`, `chore/eslint-autofix-warnings`

**Recommendation:** Clean up old branches to reduce clutter.

---

### File Organization Issues

#### ⚠️ Issue 1: Duplicate Screen Files

**Potential Duplicates Found:**

- `app/feed.tsx` vs `app/(tabs)/feed/index.tsx`
- `app/highlights.tsx` vs `app/(tabs)/highlights/index.tsx`
- `app/messages.tsx` vs `app/(tabs)/messages/index.tsx`
- `app/profile.tsx` vs `app/(tabs)/profile/index.tsx`

**Analysis:** Need to verify if these are:

1. **Duplicates** - Same content, should consolidate
2. **Different** - Serve different purposes, keep both
3. **Redirects** - One redirects to the other

**Action Required:** Verify and consolidate duplicates.

---

#### ⚠️ Issue 2: Root Directory Clutter

**Too Many Files in Root:**

```
Root Directory (~80+ files):
- Documentation files (*.md) - Should be in docs/
- Shell scripts (*.sh) - Should be in scripts/
- Temporary files (*.mjs) - Should be in scripts/ or removed
- Log directories - Should be in logs/ or .gitignored
- Build artifacts - Should be .gitignored
```

**Recommendation:**

1. Move all `.md` files to `docs/` (except README.md)
2. Move all `.sh` scripts to `scripts/`
3. Move all `.mjs` scripts to `scripts/`
4. Add log directories to `.gitignore`
5. Clean up temporary directories

---

#### ⚠️ Issue 3: Import Path Inconsistencies

**Found Relative Imports:**

- `app/(tabs)/team-contacts.tsx`: `import ... from '../utils/uploadUtils'`
- `app/(tabs)/create-team.tsx`: `import ... from '../api/http'`
- `app/(tabs)/edit-team.tsx`: `import ... from '../api/http'`
- `app/(tabs)/edit-profile.tsx`: `import ... from '../api/http'`
- `app/(tabs)/discover/mobile-community.tsx`: `import ... from '../../game-details/...'`

**Recommendation:**

- Use absolute imports (`@/utils/...`, `@/api/...`) consistently
- Configure path aliases in `tsconfig.json`

---

#### ⚠️ Issue 4: Screen File Location

**Screens Still in `app/` (Not in `(tabs)`):**

- `app/feed.tsx` - Should be in `(tabs)/feed/` or removed if duplicate
- `app/highlights.tsx` - Should be in `(tabs)/highlights/` or removed if duplicate
- `app/messages.tsx` - Should be in `(tabs)/messages/` or removed if duplicate
- `app/profile.tsx` - Should be in `(tabs)/profile/` or removed if duplicate
- `app/game-detail.tsx` - Should be moved to `(tabs)/` for tab bar access
- `app/team-page.tsx` - Should be moved to `(tabs)/` for tab bar access
- Many admin screens - Should be organized better

**Recommendation:**

1. Move remaining screens to `(tabs)/` if they need tab bar
2. Or organize into logical folders (`admin/`, `settings/`, etc.)

---

### Server Organization

**✅ Good Structure:**

```
server/src/
├── routes/        # API endpoints (organized by feature)
├── middleware/    # Auth, logging, rate limiting
├── lib/          # Shared utilities
├── services/     # Business logic
└── jobs/         # Background jobs
```

**Status:** Well organized ✅

---

### Components Organization

**✅ Good Structure:**

```
components/
├── ui/           # Reusable UI components
├── onboarding/   # Onboarding-specific components
└── [feature]/    # Feature-specific components
```

**Status:** Well organized ✅

---

## 🎯 Recommendations

### Priority 1: Critical Organization Issues

1. **Consolidate Duplicate Screens**
   - Check if `app/feed.tsx` and `app/(tabs)/feed/index.tsx` are duplicates
   - If duplicates, remove one and update all imports
   - If different, ensure clear naming and purpose

2. **Move Remaining Screens to `(tabs)/`**
   - `app/game-detail.tsx` → `app/(tabs)/game-detail.tsx`
   - `app/team-page.tsx` → `app/(tabs)/team-page.tsx`
   - Any other screens users navigate to from tabs

3. **Fix Import Paths**
   - Replace relative imports (`../`) with absolute imports (`@/`)
   - Ensure `tsconfig.json` has path aliases configured

---

### Priority 2: Cleanup Tasks

4. **Organize Root Directory**
   - Move all `.md` files (except README.md) to `docs/`
   - Move all `.sh` scripts to `scripts/`
   - Move all `.mjs` scripts to `scripts/`
   - Clean up temporary directories

5. **Branch Cleanup**
   - Delete old `dependabot/*` branches (already merged)
   - Delete old `snyk-upgrade/*` branches (already merged)
   - Delete typo branch `develope`
   - Keep only active branches: `main`, `develop`

---

### Priority 3: Future Improvements

6. **Standardize Screen Organization**
   - All tab-accessible screens → `app/(tabs)/`
   - Auth screens → `app/auth/` (or keep in root)
   - Admin screens → `app/admin/` or `app/(tabs)/admin-*`
   - Settings screens → Already in `app/settings/` ✅

7. **Documentation Organization**
   - Create `docs/guides/` for feature guides
   - Create `docs/api/` for API documentation
   - Create `docs/testing/` for test documentation
   - Keep only essential docs in root

---

## ✅ What's Working Well

1. **Server Structure** - Clean, organized by feature ✅
2. **Components** - Well organized with clear separation ✅
3. **Tab Navigation** - Most screens now in `(tabs)/` ✅
4. **Settings** - Already in dedicated folder ✅
5. **Onboarding** - Already in dedicated folder ✅

---

## 📋 Action Plan

### Immediate (Today)

1. ✅ Verify duplicate screens and consolidate
2. ✅ Move remaining screens to `(tabs)/` if needed
3. ✅ Fix import path inconsistencies

### Short-term (This Week)

4. Clean up root directory (move files to appropriate folders)
5. Clean up old git branches
6. Update documentation structure

### Long-term (This Month)

7. Standardize screen organization
8. Create comprehensive folder structure guide
9. Set up pre-commit hooks for organization checks

---

## 🔍 Verification Checklist

- [ ] No duplicate screen files
- [ ] All tab-accessible screens in `(tabs)/`
- [ ] All imports use absolute paths (`@/`)
- [ ] Root directory contains only essential files
- [ ] Old branches cleaned up
- [ ] Documentation properly organized
- [ ] Scripts in `scripts/` directory
- [ ] Logs and temp files in appropriate locations
