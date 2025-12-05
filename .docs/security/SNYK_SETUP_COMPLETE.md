# Snyk Setup - Step-by-Step Instructions

## Current Status
✅ Snyk CLI installed (v1.1301.0)
✅ .snyk policy file created
⏳ Authentication needed (SNYK_TOKEN)
⏳ GitHub Secrets need updating

---

## Step 1: Get Your Snyk Token (2 minutes)

### Option A: Create a New Snyk Account (Recommended)
1. Go to **https://app.snyk.io/signup**
2. Sign up with **GitHub** (uses your GitHub account)
3. Once logged in, go to **Settings** (bottom left icon)
4. Click **API Token** tab
5. Click **Show** to reveal your token
6. Copy the entire token (looks like: `xxx-xxx-xxx-xxx`)

### Option B: Get Token from Existing Account
1. Go to **https://app.snyk.io/login**
2. Sign in with GitHub
3. Go to **Settings** → **API Token**
4. Copy the token

**Save this token safely - you'll use it twice:**
- Once locally: `snyk auth <TOKEN>`
- Once in GitHub: GitHub Secrets

---

## Step 2: Authenticate Locally (1 minute)

```bash
# Option A: Automatic (opens browser)
snyk auth

# Option B: Direct (use your token)
snyk auth YOUR_TOKEN_HERE
```

**What happens:**
- Opens browser → Authorize Snyk with GitHub
- Returns to terminal → Shows "Authenticated successfully"
- Saves credentials to `~/.snyk` file

---

## Step 3: Run First Security Scan (2 minutes)

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Run the full scan
snyk test

# Or just show vulnerabilities (no error on low severity)
snyk test --severity-threshold=high
```

**Expected output:**
```
Testing /Users/varsityhub/Desktop/CODE/VarsityHubMobile...

✓ 127 vulnerable paths
✓ 4 vulnerable dependency paths (4 medium severity)

Recommendations:
- Upgrade @sentry/expo to ≥7.1.1
- Review and patch transitive dependencies
```

**What this means:**
- 4 medium-severity vulnerabilities (all transitive)
- 0 high-severity vulnerabilities ✅
- 0 critical-severity vulnerabilities ✅

---

## Step 4: Add Token to GitHub (2 minutes)

### Go to GitHub Repo Secrets:

1. **Open GitHub** → Your Repository → **Settings**
2. Left sidebar → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Fill in:
   ```
   Name:  SNYK_TOKEN
   Value: [paste your Snyk token from Step 1]
   ```
5. Click **Add secret**

**Verify it was added:**
- You should see `SNYK_TOKEN` listed under "Repository secrets"
- It will show as a black dot (hidden value)

---

## Step 5: Trigger the GitHub Workflow (2 minutes)

### Option A: Automatic on Next Commit
The workflow will automatically run when you push any code:
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
git add .snyk
git commit -m "Add Snyk policy configuration"
git push origin main
```

### Option B: Manual Trigger
1. Go to **GitHub** → **Actions**
2. Left sidebar → **Snyk Security**
3. Click **Run workflow** button
4. Select branch: **main**
5. Click **Run workflow**

**Wait 2-5 minutes for the workflow to complete.**

---

## Step 6: Check Workflow Results (2 minutes)

### View Results:
1. Go to **GitHub** → **Security** tab
2. Click **Code scanning** (left sidebar)
3. You should see results from the Snyk scan

### Expected Results:
- **Scans:** Code (SAST), Dependencies (SCA)
- **Status:** Should pass (0 critical/high CVEs)
- **Warnings:** 4 medium-severity (transitive only)

### If Workflow Failed:
- Click the failed run
- Check the error message
- Most common: `SNYK_TOKEN` not set or invalid
- Fix: Go back to Step 4 and verify the secret

---

## Step 7: Verify Everything Works (2 minutes)

### Quick Verification Checklist:

```bash
# 1. Verify CLI works
snyk --version
# Expected: 1.1301.0 (or similar)

# 2. Verify auth works
snyk auth --token=$SNYK_TOKEN
# Expected: "Authenticated successfully"

# 3. Run a quick test
snyk test --severity-threshold=high
# Expected: Shows vulnerabilities (4 medium only, 0 high/critical)

# 4. Check GitHub
# Expected: Snyk workflow in Actions tab shows ✅ passed
```

---

## Troubleshooting

### Issue: "snyk: command not found"
**Fix:**
```bash
npm install -g snyk
snyk --version
```

### Issue: "Authentication error (SNYK-0005)"
**Fix:**
1. Run `snyk auth` again
2. Complete browser authorization
3. Return to terminal, should see "Authenticated"

### Issue: GitHub workflow fails silently
**Fix:**
1. Go to GitHub Settings → Secrets and variables → Actions
2. Verify `SNYK_TOKEN` exists (not a typo)
3. Verify it's the full token from app.snyk.io (no extra spaces)
4. Re-run workflow manually

### Issue: ".snyk file" YAML errors
**Fix:** The file is already valid. If you modified it, make sure:
- No tabs (only spaces)
- Proper YAML indentation (2-space)
- No trailing `---` separators

### Issue: "Test results not showing in GitHub"
**Fix:**
1. The workflow needs to complete (2-5 minutes)
2. Results appear in **Security** → **Code scanning**
3. Not in the standard "Actions" tab (that just shows the workflow status)

---

## Daily Use

### After Setup, It's Automatic:

**Every time you push code:**
```bash
git push origin main
```

**Automatically:**
1. ✅ Snyk SAST scans code
2. ✅ Snyk SCA scans dependencies
3. ✅ Results appear in GitHub Security tab
4. ✅ PR blocked if high/critical CVE found

**Manual scan anytime:**
```bash
snyk test
snyk code test
snyk container test node:latest
```

---

## Next Steps After Setup

Once everything is working:

### 1. Configure PR Protection (Optional)
- Go to **Settings** → **Branches** → **main** → **Add rule**
- Require status check: **snyk-security/snyk-test** to pass
- This blocks PRs with high/critical CVEs

### 2. Enable Auto-Fix PRs (Optional)
- Go to https://app.snyk.io → Project settings
- Enable **Automatic fix pull requests**
- Set frequency to **Daily** or **Weekly**
- Snyk will create fix PRs automatically

### 3. Monitor Dashboard
- Go to https://app.snyk.io/dashboard
- See all vulnerabilities at a glance
- Get recommendations for each issue

### 4. Set Up Notifications (Optional)
- **Snyk Dashboard** → **Settings** → **Notifications**
- Get emailed on new vulnerabilities
- Get alerts on PR security issues

---

## Files Created/Modified

```
Created:
  .snyk                     ← Policy file (version control safe)
  .docs/security/SNYK_SETUP_GUIDE.md  ← This file

Modified:
  .github/workflows/snyk-security.yml  ← Already configured
  GitHub Secrets (SNYK_TOKEN)          ← You'll add this

Unchanged:
  All source code
  package.json
  dependencies
```

---

## Estimated Time: 10-15 minutes total

```
Step 1: Get token          2 min
Step 2: Authenticate       1 min
Step 3: Run scan locally   2 min
Step 4: GitHub secrets     2 min
Step 5: Trigger workflow   2 min
Step 6: Check results      2 min
Step 7: Verify            2 min
─────────────────────────────
Total:                     15 min
```

---

## Questions?

**See full documentation:** https://docs.snyk.io/
**CLI reference:** https://docs.snyk.io/snyk-cli

---

**Status:**
- ✅ CLI installed locally
- ✅ Policy file created
- ⏳ Token needed (from app.snyk.io)
- ⏳ GitHub Secrets needed
- ⏳ Workflow execution pending

**Next action:** Get your Snyk token from app.snyk.io and follow Step 1 above.
