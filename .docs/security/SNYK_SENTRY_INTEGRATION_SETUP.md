# Snyk + Sentry Integration Setup Checklist

## Quick Setup (15 minutes)

### Step 1: Get Sentry Auth Token (5 minutes)

**In Sentry Dashboard:**
1. Go to https://sentry.io/settings/account/api/auth-tokens/
2. Click **Create New Token**
3. Name: `Snyk Integration`
4. Scopes (check these):
   - [ ] `project:read`
   - [ ] `project:write`
   - [ ] `event:read`
   - [ ] `event:write`
5. Click **Create Token**
6. Copy the token (looks like: `snyrxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 2: Get Your Sentry Organization & Project (2 minutes)

**Find in Sentry:**
- Organization slug: Go to **Settings** → **Organization Settings** → URL shows: `sentry.io/organizations/[your-org-slug]/`
- Project slug: Go to your project → **Settings** → URL shows: `sentry.io/organizations/[org]/issues/?project=[project-id]`

**Alternative - Get from Sentry Settings:**
1. Click your avatar (bottom left)
2. Go to **Settings**
3. Under "Organizations": Click your org
4. The URL shows: `sentry.io/organizations/YOUR-ORG-SLUG/`
5. Go to your project → **Settings** → Project name is the slug

### Step 3: Add Secrets to GitHub (5 minutes)

**Go to GitHub Repository:**
1. **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**

**Add 3 secrets:**

Secret 1:
```
Name:  SENTRY_AUTH_TOKEN
Value: [paste from Sentry Step 1]
```

Secret 2:
```
Name:  SENTRY_ORG
Value: [your org slug from Step 2]
```

Secret 3:
```
Name:  SENTRY_PROJECT
Value: [your project slug from Step 2]
```

Click **Add secret** for each one.

### Step 4: Verify Workflow Has Integration Steps (2 minutes)

**Check file:** `.github/workflows/snyk-security.yml`

Should have this step:
```yaml
- name: Send Snyk results to Sentry
  if: always() && steps.snyk-test.outputs.snyk-test-complete
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
  run: |
    # ... Snyk → Sentry integration code
```

✅ If present, you're ready to test!

### Step 5: Test the Integration (5 minutes)

**Trigger workflow:**
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Option A: Push empty commit
git commit --allow-empty -m "Test: Snyk + Sentry integration"
git push origin main

# Option B: Manual trigger in GitHub
# Go to Actions tab → Snyk Security → Run workflow → Run
```

**Monitor:**
1. **GitHub Actions tab**: Wait for workflow to complete (2-3 minutes)
2. **Sentry Dashboard**: Go to **Issues** → Should see new event from Snyk
3. **Event details**: Should show Snyk scan results as context

---

## Full Integration Workflow

### What Happens Each Time Snyk Runs

```
GitHub Push/PR
    ↓
GitHub Actions triggered
    ↓
Snyk SAST scan (code analysis)
    ↓
Snyk SCA scan (dependency check)
    ↓
Results saved to snyk-results.json
    ↓
Results sent to Sentry API
    ↓
Sentry creates Issue/Event
    ↓
Sentry sends notifications (Slack, email, etc.)
    ↓
Team reviews in Sentry Dashboard
```

### Real-Time Data Flow

```
Snyk Scan → GitHub Actions → Sentry API → Sentry Dashboard
                                       ↓
                              Slack/Email Alerts
                                       ↓
                              Team Incident Response
```

---

## Verification Checklist

After setup, verify:

- [ ] SNYK_TOKEN is in GitHub Secrets
- [ ] SENTRY_AUTH_TOKEN is in GitHub Secrets
- [ ] SENTRY_ORG is in GitHub Secrets
- [ ] SENTRY_PROJECT is in GitHub Secrets
- [ ] Workflow file contains Sentry integration step
- [ ] Test push completes successfully
- [ ] Snyk results appear in GitHub Actions logs
- [ ] Sentry receives the event (check Sentry Issues)
- [ ] Event shows Snyk data in context
- [ ] Sentry alerts configured and working

---

## What You'll See in Sentry After Integration

### Sentry Issues Tab

**New issues appear with:**
- Title: "Snyk Security Scan - GitHub Actions"
- Source: `ci` environment
- Tags: `source:snyk`, `type:security-scan`, `branch:main`, `commit:[sha]`
- Context: Snyk scan results (JSON)
- GitHub details: Actor, workflow, run ID

### Example Issue

```
Issue: Snyk Security Scan - GitHub Actions

Context:
├─ github:
│  ├─ event: push
│  ├─ actor: varsityhub-dev
│  ├─ workflow: Snyk Security Scanning
│  └─ run_id: 12345678
│
├─ snyk_scan_results:
│  ├─ vulnerabilities: [...]
│  ├─ summary: {
│  │    "critical": 0,
│  │    "high": 0,
│  │    "medium": 4,
│  │    "low": 0
│  │ }
│  └─ remediation: [fix recommendations]
```

---

## Alerts & Notifications

### Configure Sentry Alerts for Snyk Events

**In Sentry Dashboard:**
1. **Alerts** → **Create Alert Rule**
2. Set conditions:
   - Filter: `tag:source=snyk`
   - Severity: Warning or higher
   - Alert when: New issue created
3. Actions:
   - [ ] Send to Slack #security-alerts
   - [ ] Send to security@varsityhub.app
   - [ ] Create PagerDuty incident (if critical)
4. Click **Save**

### Example Alert Rule

```
Name:     Snyk Vulnerability Found
Condition: tag:source = snyk AND level >= warning
Action:    Send Slack message to #security
          → #security-alerts
          → "🔒 Security Alert: {{ error.title }}"
          → Include: severity, vulnerability ID, remediation
```

---

## Troubleshooting

### Snyk Results Not Appearing in Sentry

**Check:**
1. Are all 3 Sentry secrets in GitHub (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)?
2. Are the values correct? (No extra spaces, correct project slug)
3. Check GitHub Actions logs: Look for curl errors
4. Test Sentry token manually:
   ```bash
   curl -I -H "Authorization: Bearer YOUR_TOKEN" https://sentry.io/api/0/organizations/YOUR-ORG/
   # Should return 200 OK
   ```

### GitHub Actions Workflow Fails

**Common issues:**
1. SNYK_TOKEN not set → `snyk test` fails
2. SENTRY_AUTH_TOKEN not set → Sentry send fails (but continues)
3. Syntax error in JSON → curl fails

**Check logs:**
1. GitHub Actions tab → Click workflow run
2. Scroll to "Send Snyk results to Sentry" step
3. Look for error messages
4. Test JSON validity: `cat snyk-results.json | jq .`

### Sentry Auth Token Invalid

**Fix:**
1. Go to Sentry settings
2. Generate new token with correct scopes
3. Update GitHub Secret
4. Re-run workflow

---

## Best Practices

### During Development
- ✅ Snyk blocks PRs with high/critical CVEs (prevents bad merges)
- ✅ Sentry captures test errors (but should be clean before production)
- ✅ Both integrated so all security events visible in one place

### During QA
- ✅ Monitor Sentry for any unexpected errors
- ✅ Run Snyk scans daily
- ✅ Document any false positives
- ✅ Verify alerts are reaching team

### In Production
- ✅ Snyk scans on schedule (daily or weekly)
- ✅ Sentry real-time error monitoring (24/7)
- ✅ Both feed into incident response workflow
- ✅ Weekly security metrics review

### Team Processes
- ✅ On Snyk alert: Review, understand, fix
- ✅ On Sentry alert: Investigate, correlate with Snyk findings, fix
- ✅ Weekly: Review all vulnerabilities and errors
- ✅ Monthly: Security metrics and trends

---

## Next Steps After Setup

### Immediate (Today)
- [ ] Add 3 Sentry secrets to GitHub
- [ ] Verify workflow has integration steps
- [ ] Test with empty commit
- [ ] Confirm Sentry receives events

### Short Term (This week)
- [ ] Configure Sentry alert rules
- [ ] Train team on response workflow
- [ ] Document incident response procedures
- [ ] Set up Slack #security-alerts channel

### Medium Term (This month)
- [ ] Review first month of data
- [ ] Tune alert sensitivity
- [ ] Create security dashboard
- [ ] Monthly metrics review

---

## Resources

- **Sentry API Docs**: https://docs.sentry.io/api/
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Snyk Docs**: https://docs.snyk.io/
- **Sentry Integration Guide**: https://docs.sentry.io/integrations/

---

## Questions?

Both systems working together creates **defense in depth**:
- Snyk = Prevents vulnerabilities from being deployed
- Sentry = Catches vulnerabilities that made it to production
- Integration = Unified view + faster response

You now have complete security + error monitoring! 🛡️
