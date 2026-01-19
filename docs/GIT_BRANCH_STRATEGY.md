# Git Branch Strategy

**VarsityHub Branch Organization Guide**

---

## 📊 Current Branch Structure

### Main Branches

- **`main`** - Production branch (stable, deployable)
  - Protected branch
  - All production deployments come from here
  - Current HEAD: `8adf989`

- **`develop`** - Development branch (integration branch)
  - Where feature branches merge
  - Testing and integration happens here
  - Merges to `main` for releases

- **`develope`** ⚠️ - Typo branch (should be deleted)
  - Duplicate/typo of `develop`
  - Recommended: Delete this branch

---

## 🌿 Branch Naming Conventions

### Current Patterns (Good)

- **`chore/*`** - Maintenance tasks
  - Example: `chore/deploy-checklist`, `chore/eslint-autofix-warnings`

- **`dependabot/*`** - Automated dependency updates
  - Format: `dependabot/{package_manager}/{package_name}-{version}`
  - Example: `dependabot/npm_and_yarn/react-dom-19.1.2`

- **`snyk-*`** - Security fixes from Snyk
  - Format: `snyk-fix-{hash}` or `snyk-upgrade-{hash}`
  - Example: `snyk-fix-340bb33d3cc23bd2145d47c12a40b74a`

### Recommended Additional Patterns

- **`feature/*`** - New features
  - Format: `feature/feature-name` or `feature/issue-number-feature-name`
  - Example: `feature/overnight-tasks`, `feature/123-user-profile`

- **`fix/*`** - Bug fixes
  - Format: `fix/bug-description` or `fix/issue-number-description`
  - Example: `fix/stripe-pricing`, `fix/456-payment-webhook`

- **`hotfix/*`** - Critical production fixes
  - Format: `hotfix/critical-issue`
  - Example: `hotfix/payment-processing`

- **`release/*`** - Release preparation
  - Format: `release/v1.0.1` or `release/v1.1.0`
  - Example: `release/v1.0.2`

---

## 🔄 Recommended Workflow

### Feature Development

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/overnight-tasks

# 3. Develop and commit
git add .
git commit -m "feat: add overnight automation tasks"

# 4. Push and create PR
git push origin feature/overnight-tasks
# Create PR: feature/overnight-tasks -> develop

# 5. After PR approval, merge to develop
# (via GitHub PR merge)

# 6. Delete feature branch
git branch -d feature/overnight-tasks
git push origin --delete feature/overnight-tasks
```

### Bug Fixes

```bash
# 1. Start from develop (or main for hotfixes)
git checkout develop
git pull origin develop

# 2. Create fix branch
git checkout -b fix/stripe-pricing-discrepancy

# 3. Fix and commit
git add .
git commit -m "fix: correct Stripe pricing for Veteran plan"

# 4. Push and create PR
git push origin fix/stripe-pricing-discrepancy
# Create PR: fix/stripe-pricing-discrepancy -> develop (or main for hotfix)
```

### Release Process

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v1.0.2

# 2. Final testing and version bumps
# Update version in package.json, app.json, etc.

# 3. Merge to main
git checkout main
git merge release/v1.0.2
git tag v1.0.2
git push origin main --tags

# 4. Merge back to develop
git checkout develop
git merge release/v1.0.2
git push origin develop

# 5. Delete release branch
git branch -d release/v1.0.2
git push origin --delete release/v1.0.2
```

---

## 🧹 Branch Cleanup

### Automated Branches

- **Dependabot branches**: Auto-created, should auto-delete after PR merge
- **Snyk branches**: Auto-created, should auto-delete after PR merge

### Manual Cleanup

```bash
# List all remote branches
git branch -r

# Delete merged branches (safe)
git branch -r --merged origin/develop | grep -v "develop\|main" | sed 's/origin\///' | xargs -I {} git push origin --delete {}

# Check for stale branches (not updated in 90 days)
git for-each-ref --format='%(refname:short) %(committerdate:relative)' refs/remotes | grep "90 days ago\|months ago\|years ago"
```

---

## ✅ Best Practices

### Do's ✅

1. **Always branch from `develop`** for new features
2. **Use descriptive branch names** (`feature/user-profile`, not `feature/new`)
3. **Keep branches short-lived** (merge within days/weeks)
4. **Delete merged branches** (keep repository clean)
5. **Use conventional commits** (`feat:`, `fix:`, `chore:`, etc.)
6. **Create PRs for code review** before merging
7. **Keep `main` stable** - only merge from `develop` or `hotfix/*`

### Don'ts ❌

1. **Don't commit directly to `main`** (use PRs)
2. **Don't create branches from other feature branches**
3. **Don't leave branches unmerged for months**
4. **Don't use generic branch names** (`test`, `fix`, `update`)
5. **Don't force push to shared branches** (`main`, `develop`)

---

## 📋 Branch Status Checklist

- [ ] `main` branch is stable and deployable
- [ ] `develop` branch is up to date with `main`
- [ ] Feature branches are short-lived (< 2 weeks)
- [ ] All merged branches are deleted
- [ ] Stale branches are cleaned up (> 90 days)
- [ ] Branch protection rules are configured (GitHub)

---

## 🔧 Configuration

### Recommended Branch Protection (GitHub)

For `main` branch:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

For `develop` branch:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ⚠️  Allow force pushes (for emergency fixes only)

---

## 📊 Current Branch Summary

**Total Remote Branches:** ~23
- Main branches: 2-3 (main, develop, develope)
- Chore branches: 2
- Dependabot branches: 11 (automated)
- Snyk branches: 7 (automated)

**Recommendations:**
1. Delete `develope` typo branch
2. Clean up merged dependabot/snyk branches
3. Start using `feature/*` and `fix/*` naming
4. Document branch strategy in README

---

**Last Updated:** January 17, 2025  
**Status:** Current branch strategy analyzed, recommendations provided
