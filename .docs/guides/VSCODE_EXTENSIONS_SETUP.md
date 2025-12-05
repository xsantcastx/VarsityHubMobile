# VS Code Extensions & Tools Setup Guide

**Date:** Dec 4, 2024  
**Purpose:** Enable error tracking, API testing, and security scanning for Days 2-4 execution  
**Setup Time:** ~10 minutes total

---

## 🎯 Quick Install via VS Code UI

### Step 1: Open Extensions (Cmd+Shift+X)

Search and install these extensions in order:

#### **CRITICAL (Do First)**

1. **Sentry** (Sentry)
   - Search: `Sentry`
   - Publisher: Sentry
   - Use Case: See production errors in editor without leaving VS Code
   - After install: Run `Sentry: Connect` from Command Palette (Cmd+Shift+P)
   - Sign in with your Sentry account (same one with DSN)

2. **GitHub Actions** (GitHub)
   - Search: `GitHub Actions`
   - Publisher: GitHub
   - Use Case: Monitor Production Readiness workflow run status
   - After install: `GitHub: Sign in` from Command Palette

#### **RECOMMENDED (For Daily Use)**

3. **Thunder Client** (Ranga Venkata)
   - Search: `Thunder Client`
   - Publisher: Ranga Venkata
   - Use Case: Quick API endpoint testing (health checks, email verification, etc.)
   - After install: Left sidebar will show Thunder Client icon (⚡)

4. **Snyk Security** (Snyk)
   - Search: `Snyk Security`
   - Publisher: Snyk
   - Use Case: Highlight vulnerable npm dependencies inline
   - After install: `Snyk: Authenticate` from Command Palette
   - Sign in with GitHub account

5. **Expo Tools** (Expo)
   - Search: `Expo Tools`
   - Publisher: Expo
   - Use Case: Expo CLI integration, better snippets/linting
   - No setup needed after install

6. **React Native Tools** (Microsoft)
   - Search: `React Native Tools`
   - Publisher: Microsoft
   - Use Case: Debugging, intellisense for RN APIs
   - No setup needed after install

#### **OPTIONAL (For Secret Management)**

7. **Doppler** or **1Password** (if using for team secrets)
   - Search: `Doppler` or `1Password`
   - Use Case: Inject .env variables safely without committing
   - Requires account setup (skip if not needed)

---

## 📋 Configuration After Install

### Sentry Setup (2 min)

1. Open Command Palette: **Cmd+Shift+P**
2. Type `Sentry: Connect`
3. Sign in with your Sentry.io account
4. Select the VarsityHub project
5. Verify errors appear in the Sentry panel (Cmd+K Cmd+S to search)

**Result:** Any production errors (from your Sentry DSN) will appear in VS Code with stack traces

### GitHub Actions Setup (1 min)

1. Open Command Palette: **Cmd+Shift+P**
2. Type `GitHub: Sign in`
3. Authorize GitHub access
4. Check the **GitHub** tab in Activity Bar (left sidebar)
5. Select repo → Production Readiness workflow to see latest run

**Result:** Watch CI/CD runs without leaving VS Code

### Thunder Client Setup (3 min)

1. Click ⚡ **Thunder Client** icon in Activity Bar (left sidebar)
2. Create new request: `+ New Request`
3. Name: `Health Check`
4. Method: `GET`
5. URL: `https://railway-deployment-url/health` (from your Railway app)
6. Click **Send** to test

**For other endpoints:**
- **POST /api/test-email:** Send test email
- **GET /api/status:** Overall API status
- **POST /api/verify-token:** Token validation

**Tip:** Create an environment in Thunder Client with variables:
- `baseUrl`: Your Railway URL
- `authToken`: Bearer token for protected routes
- Then use `{{baseUrl}}/health` in requests

### Snyk Setup (2 min)

1. Open Command Palette: **Cmd+Shift+P**
2. Type `Snyk: Authenticate`
3. Sign in with GitHub
4. Open `package.json` and watch for vulnerability badges on imports

**Result:** Red/yellow badges appear next to vulnerable dependencies with fix suggestions

---

## 🚀 Usage Patterns for Days 2-4

### Daily Workflow

**Morning:**
1. Open GitHub Actions tab → Check Production Readiness workflow status
2. Open Sentry tab → Any new production errors?
3. Proceed with Day's tasks

**When Testing:**
1. Use Thunder Client to verify API endpoints work
2. Check Snyk for any new dependency issues in npm audit
3. Use Expo Tools for debugging snippets/imports

**Before Committing:**
1. Check Snyk for vulnerable dependencies
2. Run lint locally: `npm run lint:strict`
3. Verify health endpoint: `curl https://your-railway-url/health`

### Common Queries

**"Is the API healthy?"**
- Thunder Client: GET `{{baseUrl}}/health` → see Sentry/SendGrid status

**"Did my changes break production?"**
- Sentry tab: Check for new errors post-deploy
- GitHub Actions: Watch workflow run in real-time

**"Are there new security issues?"**
- Snyk panel: Look for red badges in `package.json`
- Fix: Click badge → see remediation steps

**"Did my email config work?"**
- Thunder Client: POST `{{baseUrl}}/api/test-email` with test address
- Check email inbox for delivery

---

## 📊 Extensions Quick Reference

| Extension | Icon | Purpose | Setup |
|-----------|------|---------|-------|
| **Sentry** | 🔴 | Production errors | Sign in |
| **GitHub Actions** | ✓ | CI/CD monitoring | Sign in |
| **Thunder Client** | ⚡ | API testing | Create requests |
| **Snyk Security** | 🔒 | Vulnerability scanning | Sign in |
| **Expo Tools** | ⚙️ | Expo integration | Auto |
| **React Native Tools** | ▶️ | RN debugging | Auto |

---

## 🔗 Integration with Existing Setup

These extensions complement what you've already built:

### Day 0-1 (Infrastructure) ✅
- Sentry extension watches the DSN you set up
- Thunder Client verifies the health endpoint you created
- Snyk checks the dependencies you're managing

### Day 2 (Lint Cleanup) 🔄
- React Native Tools help with ESLint integration
- Snyk catches any vulnerable imports you add
- Expo Tools provides better snippet suggestions

### Day 3-4 (QA & Launch) 📋
- GitHub Actions monitors your production workflow
- Sentry alerts you to any new errors
- Thunder Client stress-tests your endpoints
- Snyk verifies no vulnerabilities before launch

---

## 🆘 Troubleshooting

**"Sentry: Connect" not found after install**
- Reload VS Code: Cmd+R or File → Restart
- Check Extensions tab to ensure Sentry is active (not disabled)

**Thunder Client requests show 401/403**
- Add authorization header manually in Thunder Client
- Or create environment with `authToken` and use: `Authorization: Bearer {{authToken}}`

**GitHub Actions tab not showing**
- Sign out and back in: Cmd+Shift+P → `GitHub: Sign out` then `GitHub: Sign in`
- Reload VS Code

**Snyk not finding vulnerabilities**
- Run `npm audit` in terminal to manually check
- Snyk may cache old results; reload VS Code

---

## 📝 What's Next

After installing, you're ready for:
1. **Day 2 Lint Cleanup** - Use React Native Tools + ESLint for better error messages
2. **API Testing** - Use Thunder Client to verify endpoints during refactoring
3. **Security Checks** - Run Snyk before each commit
4. **Production Monitoring** - Watch Sentry for live errors during Days 3-4

**Estimated Setup:** 10-15 minutes including sign-ins  
**Value Added:** Faster feedback loops, fewer surprises at launch  
**Recommendation:** Do this now before Day 3 to have monitoring in place

---

## 💡 Pro Tips

- **Keyboard shortcut to Command Palette:** Cmd+Shift+P (use it to quickly access extensions)
- **Thunder Client collections:** Save common requests as Collections for reuse
- **Snyk auto-fix:** Some vulnerabilities have automatic fixes; click the suggestion
- **Sentry filtering:** Filter by environment (staging/prod) in the Sentry panel
- **GitHub Actions logs:** Click workflow → Click job → View full logs for debugging

---

**Questions?** Refer back to each extension's documentation:
- Sentry: https://docs.sentry.io/product/integrations/vscodee/
- GitHub Actions: https://github.com/marketplace/actions/github-actions-for-github
- Thunder Client: https://www.thunderclient.com/welcome
- Snyk: https://docs.snyk.io/integrations/ide-tools/visual-studio-code-extension
