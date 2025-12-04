# Snyk Continuous Security Monitoring Setup

## Overview

This guide walks through setting up Snyk for continuous vulnerability scanning, PR gating, and automated fix PRs.

---

## Part 1: One-Time Setup

### Step 1: Create Snyk Account
1. Visit https://snyk.io/
2. Sign up with GitHub account
3. Authorize Snyk to access your GitHub repositories
4. Create or select organization (use `varsityhubmobile` or company name)

### Step 2: Get SNYK_TOKEN
1. Log in to Snyk dashboard: https://app.snyk.io/
2. Go to **Settings** → **Service Accounts** (or **Personal API Token**)
3. Generate new API token
4. Copy the token (you'll only see it once)

### Step 3: Add to GitHub Secrets
1. Go to repository: https://github.com/xsantcastx/VarsityHubMobile
2. Settings → Secrets and Variables → Actions
3. Click **New repository secret**
4. Name: `SNYK_TOKEN`
5. Value: Paste the token from Step 2
6. Click **Add secret**

### Step 4: Verify GitHub Actions Workflow
The workflow file is already created at `.github/workflows/snyk-security.yml`

Verify it exists:
```bash
cat .github/workflows/snyk-security.yml
```

---

## Part 2: Configure Snyk Dashboard

### Step 1: Link Repository
1. Log in to https://app.snyk.io/
2. Click **Add project** or **Integrate repository**
3. Select GitHub
4. Find and select `VarsityHubMobile` repository
5. Click **Import**

Snyk will now:
- Scan `package.json` for dependencies
- Scan code for vulnerabilities (SAST)
- Track vulnerabilities over time

### Step 2: Configure Scan Settings
1. Go to Project Settings → **Security Settings**
2. Set **Minimum Severity:** High
3. Enable **PR checks** ✅
4. Enable **PR gating** ✅ (fail PR if vulnerabilities found)
5. Enable **Automatic PR creation** ✅ (for fix PRs)
6. Set **PR auto-fix level:** High severity only
7. Click **Save**

### Step 3: License Policy (Optional)
1. Go to **License policies**
2. Define acceptable licenses (e.g., MIT, Apache 2.0, BSD)
3. Set policy to **block** GPL or unlicensed packages
4. Assign policy to your project

---

## Part 3: Configure PR Gating

### What is PR Gating?
When someone opens a PR, Snyk automatically:
1. Scans the new dependencies
2. Checks for vulnerabilities
3. If vulnerabilities found:
   - Fails the PR check (won't let you merge)
   - Posts comment with fix instructions
4. If clean:
   - ✅ Passes check (can merge)

### Enable in GitHub
1. Go to repository Settings → **Branches**
2. Click on `main` (or your primary branch)
3. Under **Require status checks to pass before merging:**
   - [ ] Add `snyk/snyk-security` check
4. Save

Now every PR will require Snyk to pass before merging.

---

## Part 4: Automated Fix PRs

### What are Fix PRs?
Snyk automatically creates pull requests that:
- Update vulnerable package to secure version
- Include changelog & CVE details
- Test the update works (runs your tests)
- Ready for review & merge

### Enable Fix PRs
1. Snyk dashboard → Project Settings
2. **Integrations** → **GitHub**
3. Enable **Automatic fix pull requests** ✅
4. Set frequency: **Daily** or **Weekly**
5. Set which vulnerabilities to auto-fix:
   - [ ] Critical
   - [x] High
   - [x] Medium
6. Save

Now Snyk will create automatic fix PRs for you!

---

## Part 5: First Snyk Scan

### Option A: Trigger from GitHub Actions
1. Make a small commit to `main` or open a PR:
   ```bash
   git commit --allow-empty -m "Trigger Snyk scan"
   git push origin main
   ```
2. Go to GitHub → **Actions** tab
3. Watch the **Snyk Security Scanning** workflow run
4. Check results in **Security** tab

### Option B: Manual Scan
```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth  # Opens browser, sign in with GitHub

# Run scan
snyk test --severity-threshold=high

# Monitor (optional - pushes results to Snyk dashboard)
snyk monitor --severity-threshold=high
```

---

## Part 6: Integrate with VS Code

Snyk extension for VS Code provides:
- Real-time vulnerability scanning as you code
- Hover tooltips with fix suggestions
- Inline fix PRs

### Install Extension
1. VS Code → Extensions
2. Search for "Snyk Security"
3. Click **Install** (by Snyk Security)
4. Reload VS Code

### Authenticate in VS Code
1. `Cmd+Shift+P` → "Snyk: Authenticate"
2. Sign in with GitHub
3. Grant permissions
4. Now you see vulnerabilities highlighted in editor

---

## Part 7: Understanding Snyk Findings

### Common Vulnerability Types

#### Vulnerable Dependency (SCA)
```
npm Package: lodash
Severity: High
Issue: Prototype Pollution (CVSS 9.8)
Path: lodash > lodash-es
Fix: Update lodash to 4.17.21
```

**Action:** Upgrade the dependency
```bash
npm install lodash@4.17.21
```

#### Code Vulnerability (SAST)
```
JavaScript Code: src/api.ts:15
Severity: Medium
Issue: Hardcoded API Key
Details: API key stored in source code
Fix: Move to .env file
```

**Action:** Move secret to environment variable

#### Container Vulnerability
```
Docker: Ubuntu:20.04
Severity: High
Issue: OpenSSL CVE-2023-xxxx
Fix: Rebuild with Ubuntu:24.04
```

**Action:** Update base image version

---

## Part 8: PR Review Workflow

### When Someone Opens a PR
1. **Snyk checks** automatically run
2. **Results appear** in PR status checks
3. **If vulnerabilities found:**
   - PR shows 🔴 **Snyk Check Failed**
   - Comment posted with details
   - Click "Show details" to see findings
   - Two options:
     a. Fix the vulnerability (update package)
     b. Close PR without merging

4. **If clean:**
   - PR shows ✅ **Snyk Check Passed**
   - Code review can proceed

### Fixing a Snyk Failure
```bash
# See the issue
snyk test

# Get recommendations
snyk fix --severity-threshold=high

# Manual fix (if snyk fix doesn't work)
npm install vulnerable-package@latest

# Commit the fix
git add package.json package-lock.json
git commit -m "Security: Fix vulnerable dependency

- Updated lodash from 4.17.20 → 4.17.21
- Resolves: Prototype Pollution CVE
- Snyk: Approved"
git push origin your-branch
```

---

## Part 9: Monitoring & Alerts

### Snyk Dashboard
Monitor all projects at https://app.snyk.io/projects

Dashboard shows:
- 📊 Vulnerability counts (Critical, High, Medium, Low)
- 📈 Trend over time
- 🔄 Dependency health
- ⏰ Age of vulnerabilities

### GitHub Security Tab
Monitor at: `github.com/xsantcastx/VarsityHubMobile/security/`

Shows:
- Code scanning alerts (SAST findings)
- Dependabot alerts (if enabled)
- Snyk integration
- Secret scanning results

### Email Alerts
Configure at: https://app.snyk.io/account/settings/notifications

Set notifications for:
- New vulnerabilities in production (Critical/High)
- Successful fixes
- Failed PR checks

---

## Part 10: Troubleshooting

### "SNYK_TOKEN not found"
**Problem:** GitHub Actions can't authenticate with Snyk

**Solution:**
1. Verify token added to GitHub Secrets:
   - Repo Settings → Secrets
   - Look for `SNYK_TOKEN`
2. If missing, add it again (see Part 1, Step 3)
3. If still failing, regenerate token:
   - Log in to https://app.snyk.io/
   - Settings → Generate new token
   - Update GitHub secret

### "Snyk scan timeout"
**Problem:** Scan takes longer than 60 seconds

**Solution:**
1. Increase timeout in workflow: `.github/workflows/snyk-security.yml`
   ```yaml
   - name: Run Snyk test
     timeout-minutes: 10  # Increase from default
   ```
2. Or split scans into separate jobs

### "False positive - not actually vulnerable"
**Problem:** Snyk flags something that's not a real issue

**Solution:**
1. Snyk dashboard → Project
2. Find the issue
3. Click **Ignore** → **Explain reason**
4. Options:
   - "Not applicable" (not used in code)
   - "Acceptable risk" (calculated decision)
   - "Won't fix" (temporary, set expiry date)

### "Package stuck on old version"
**Problem:** Dependency has no secure version available

**Solution:**
1. Check if package is maintained: https://www.npmjs.com/package/package-name
2. If unmaintained, consider:
   - Switching to alternative package
   - Forking & maintaining yourself
   - Accepting risk if minimal exposure
3. Document decision in `.snyk` file

---

## Part 11: Best Practices

### Daily Development
✅ DO:
- Review Snyk findings in VS Code as you code
- Update dependencies regularly (weekly)
- Fix high/critical vulnerabilities immediately
- Merge Snyk fix PRs after testing

❌ DON'T:
- Ignore Snyk PR gating
- Use old versions longer than needed
- Commit API keys (let Snyk catch them)
- Skip security reviews to speed up release

### Weekly
- [ ] Check Snyk dashboard for new issues
- [ ] Merge available fix PRs
- [ ] Review Snyk email alerts

### Monthly
- [ ] Run `npm audit` locally
- [ ] Review dependency update PRs
- [ ] Check GitHub Security tab
- [ ] Review any manual ignores

### Quarterly
- [ ] Full security audit of dependencies
- [ ] Test remediation/incident response plan
- [ ] Update security policies
- [ ] Review access controls & secrets

---

## Part 12: Integration with Other Tools

### GitHub Dependabot (Complementary)
Snyk + Dependabot:
- **Snyk:** Advanced analysis, license checking, container scans
- **Dependabot:** Simpler, built-in to GitHub

Both can be enabled simultaneously (some duplication OK).

### GitHub Secret Scanning
Snyk detects hardcoded API keys.
Enable at: Repo Settings → Security → **Secret Scanning**

### GitHub Code Scanning (CodeQL)
Complementary SAST tool. Enable at:
Repo Settings → Code Security → **Enable CodeQL**

---

## Automation Schedule

| Task | Frequency | Tool | Notes |
|------|-----------|------|-------|
| PR security check | On every PR | Snyk (GH Actions) | Blocks merge if issues |
| Auto-fix PR creation | Daily | Snyk | For high/critical only |
| Dependency updates | Weekly | Snyk + npm audit | Keep packages current |
| Full audit | Monthly | npm audit + Snyk | Generate report |
| Security review | Quarterly | Manual | Business logic, policy |
| Penetration test | Annually | External firm | Optional for production |

---

## Quick Commands

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate with GitHub
snyk auth

# Test current project
snyk test

# Show detailed report
snyk test --json > snyk-report.json

# Fix vulnerabilities (if possible)
snyk fix

# Monitor in Snyk dashboard
snyk monitor

# Monitor specific severity
snyk test --severity-threshold=high

# Scan entire monorepo
snyk test --all-projects
```

---

## Next Steps

1. ✅ Add `SNYK_TOKEN` to GitHub Secrets (done)
2. ✅ Create `.github/workflows/snyk-security.yml` (done)
3. 🔄 Open a test PR to trigger Snyk scan
4. 📊 Check Snyk dashboard: https://app.snyk.io/projects
5. 🔐 Configure PR gating in GitHub
6. 📧 Set up email notifications
7. 📚 Share this guide with team

---

## Support & Resources

- **Snyk Docs:** https://docs.snyk.io/
- **Snyk VS Code:** https://www.snyk.io/blog/snyk-for-visual-studio-code/
- **OWASP Mobile Top 10:** https://owasp.org/www-project-mobile-top-10/
- **GitHub Security:** https://docs.github.com/en/code-security

---

## Sign-Off

- **Created:** December 4, 2025
- **Setup Time:** ~30 minutes
- **Ongoing Maintenance:** ~5 minutes/week
- **Owner:** Security Team / DevOps

**Questions?** Contact the team lead or refer to MOBILE_SECURITY_HARDENING.md
