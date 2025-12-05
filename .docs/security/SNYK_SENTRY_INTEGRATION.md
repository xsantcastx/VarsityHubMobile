# Snyk + Sentry Integration Guide

## Why Together?

**Snyk** = Proactive security (finds vulnerabilities before they're exploited)
**Sentry** = Reactive error tracking (catches problems in production)

Together they create a **complete security + error monitoring system**:

```
Code Changes
    ↓
Snyk SAST/SCA → Finds vulnerability in code/deps
    ↓
Snyk Workflow → Blocks PR or sends alert
    ↓
If merged, App runs in production
    ↓
Security issue manifests → Sentry captures error
    ↓
Sentry Alert → Notifies team
    ↓
Root cause: Vulnerability found by Snyk earlier
    ↓
Fix deployed → Both systems confirm resolution
```

---

## How They Work Together

### 1. **Snyk = Upstream Prevention** 🛡️
- Runs on every PR and daily scheduled scans
- Scans dependencies (SCA) for known vulnerabilities
- Scans code (SAST) for security issues
- Blocks PRs with high/critical CVEs
- Creates fix PRs automatically

### 2. **Sentry = Downstream Detection** 📊
- Runs in production
- Captures actual errors, exceptions, and crashes
- Groups similar issues
- Sends alerts to team
- Links stack traces to source code

### 3. **Integration = Intelligence** 🧠
- Snyk finds vulnerability in code
- If it slips through → Sentry catches the error
- Sentry error context links back to Snyk vulnerability ID
- Team fixes with full context

---

## Complete Setup (20 minutes)

### Step 1: Enable Snyk Webhook in Sentry (5 minutes)

**In Sentry Dashboard:**
1. Go to **Settings** → **Project Settings** → **Integrations**
2. Search for "Snyk" (should be pre-configured)
3. If available, click **Configure**
4. Enable the integration and save

**Alternatively, via GitHub Integration:**
1. Go to **Settings** → **Integrations** → **GitHub**
2. Look for "Send issue updates to GitHub"
3. This allows Snyk PR status checks to link to Sentry

### Step 2: Update GitHub Actions Workflow (5 minutes)

The `.github/workflows/snyk-security.yml` workflow needs to post results to Sentry.

**Add to workflow after Snyk test step:**
```yaml
- name: Send Snyk results to Sentry
  if: always()
  run: |
    SNYK_RESULTS=$(snyk test --json 2>/dev/null || echo '{}')
    curl -X POST https://sentry.io/api/0/projects/YOUR-ORG/YOUR-PROJECT/events/ \
      -H "Authorization: Bearer ${{ secrets.SENTRY_AUTH_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d "{
        \"message\": \"Snyk Security Scan Results\",
        \"level\": \"info\",
        \"tags\": {\"source\": \"snyk\", \"type\": \"security-scan\"},
        \"extra\": $SNYK_RESULTS
      }"
```

### Step 3: Add Sentry Auth Token to GitHub Secrets (5 minutes)

**Get Sentry Token:**
1. In Sentry Dashboard: **Settings** → **Auth Tokens**
2. Click **Create New Token**
3. Name: `Snyk Integration Token`
4. Scopes: `project:read`, `project:write`, `event:read`
5. Copy the token

**Add to GitHub:**
1. Go to **GitHub Repo Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `SENTRY_AUTH_TOKEN`
4. Value: [paste token from Sentry]
5. Save

### Step 4: Add Snyk Webhook to Sentry (5 minutes)

**Configure Snyk to send alerts to Sentry:**

**In Sentry Dashboard:**
1. Go to **Settings** → **Integrations**
2. Look for **Webhooks**
3. Click **Add Integration**
4. Create a new webhook with:
   ```
   URL: https://sentry.io/api/0/organizations/YOUR-ORG/events/
   Events: Issues, Deployments
   Active: Yes
   ```

**In Snyk Dashboard:**
1. Go to **Settings** → **Integrations** → **Sentry**
2. Click **Connect Sentry Account**
3. Authorize Sentry access
4. Select project and severity threshold
5. Save

---

## Integration Workflows

### Workflow 1: Snyk finds vulnerability → Blocks PR

```
1. Developer pushes code with vulnerable dependency
2. GitHub Actions triggers Snyk scan
3. Snyk finds CVE in package
4. Workflow fails (PR blocked)
5. Snyk creates fix PR automatically
6. Developer reviews and merges fix
7. GitHub logs security event to Sentry (optional)
```

### Workflow 2: Vulnerability slips through → Sentry catches it

```
1. Vulnerable code merged to production (shouldn't happen)
2. User triggers the vulnerable code path
3. Error occurs in production
4. Sentry captures the error
5. Sentry error includes:
   - Stack trace
   - User/session info
   - System context
6. Team notified immediately
7. Correlate with Snyk finding if known
```

### Workflow 3: Production issue → Root cause analysis

```
1. Sentry alert: High error rate in user auth flow
2. Team investigates stack trace
3. Identifies vulnerable dependency in call stack
4. Cross-reference with Snyk dashboard
5. Find: Known CVE in auth library (identified by Snyk earlier)
6. Verify: Snyk already has fix available
7. Deploy fix and monitor with Sentry
```

---

## Real-World Example

### Scenario: Prototype Pollution Vulnerability

**Timeline:**

**Day 1 - Development**
- Developer adds `lodash@4.17.15` to handle deep object merges
- Snyk detects: CVE-2021-23337 (Prototype Pollution in lodash)
- PR check fails with: "High severity vulnerability - requires upgrade to 4.17.21"
- Developer upgrades to `lodash@4.17.21`
- Snyk passes, PR merges

**Day 2 - Production (if vulnerability slipped through)**
- User sends crafted JSON payload to API
- API uses vulnerable lodash to merge data
- Prototype Pollution exploit executed
- Error occurs: TypeError or unexpected behavior
- Sentry captures: Full stack trace, user data, payload
- Alert to team: "Unexpected error in /api/data handler"
- Investigation finds: Call to `lodash.merge()` in stack
- Cross-reference Snyk: "This CVE was identified on Day 1"
- Root cause confirmed, fix deployed

---

## Dashboard Views

### Sentry Dashboard

**What to see:**
- **Issues**: Grouped by error type, severity, frequency
- **Tags**: `source:snyk` for security-related issues
- **Timeline**: When errors occurred relative to deployments
- **Context**: Stack traces linked to vulnerable code

**Custom View for Security:**
```
Filter: tag:source=snyk AND level=error OR warning
Group by: Exception
Time range: Last 24 hours
```

### Snyk Dashboard

**What to see:**
- **Vulnerabilities**: Grouped by severity, package, project
- **Compliance**: OWASP Top 10, CWE, CVSS scores
- **Metrics**: Trends over time
- **Remediation**: Fix recommendations, fix PRs created

**Custom View for Production Issues:**
```
Status: Open
Severity: Critical, High
Types: Dynamic (runtime), Static (code)
Sort by: Date discovered
```

---

## Alerts Configuration

### Set Up Snyk Alerts

**In Snyk Dashboard:**
1. **Settings** → **Notifications**
2. Enable:
   - Email notifications for new vulnerabilities
   - Slack integration (send to #security channel)
   - Weekly digest
3. Severity threshold: High and above

### Set Up Sentry Alerts

**In Sentry Dashboard:**
1. **Alerts** → **Create Alert Rule**
2. Rule name: "Production Security Issues"
3. Filter: `tag:source=snyk`
4. Alert when: Issue frequency > 5 in 1 hour
5. Notify: #security-alerts Slack channel
6. Also notify: security@varsityhub.app email

### Set Up GitHub Notifications

**In GitHub Repo:**
1. **Settings** → **Branches** → **main**
2. Require status check: `snyk/snyk-security`
3. Require status checks to pass before merging
4. Dismiss stale PR approvals when new commits pushed

---

## Security + Error Monitoring Checklist

### Before Launch

- [ ] Snyk authentication verified (`snyk test` runs successfully)
- [ ] Sentry project created and DSN configured in code
- [ ] GitHub Actions workflow has both Snyk and Sentry steps
- [ ] SNYK_TOKEN in GitHub Secrets
- [ ] SENTRY_AUTH_TOKEN in GitHub Secrets
- [ ] Snyk webhook configured to send to Sentry
- [ ] Sentry alerts configured for team notification
- [ ] Test: Make a code change, trigger workflow, verify both systems process it
- [ ] Documentation linked in team wiki/runbook
- [ ] Team trained on alert response procedures

### During QA

- [ ] Monitor Sentry for any errors (should be clean)
- [ ] Run Snyk scans regularly (daily or before each release)
- [ ] Verify alerts are reaching team (test alert)
- [ ] Document any false positives or issues

### Post-Launch

- [ ] Daily review of Sentry errors (especially security-related)
- [ ] Weekly Snyk vulnerability review
- [ ] Monthly security metrics report
- [ ] Quarterly security training
- [ ] Annual penetration test + full audit

---

## Troubleshooting

### Snyk Tests Fail But Should Pass

**Check:**
1. Is SNYK_TOKEN set in GitHub Secrets?
2. Has `snyk auth` been run locally?
3. Is `.snyk` policy file present and valid?
4. Run locally: `snyk test --debug` for verbose output

### Sentry Not Receiving Snyk Events

**Check:**
1. Is SENTRY_AUTH_TOKEN set in GitHub Secrets?
2. Is Sentry integration enabled in Snyk settings?
3. Check GitHub Actions logs for curl failures
4. Verify Sentry project DSN is correct
5. Test webhook manually: `curl -X POST [url] -H "Authorization: Bearer [token]"`

### False Positives in Snyk

**Solution:**
1. Review issue in Snyk dashboard
2. If accepted risk, add to `.snyk` ignore list with expiration
3. Document reason in ignore rule
4. Set up review schedule to re-evaluate

### Missing Context in Sentry

**Enhancement:**
1. Add custom tags to Sentry events: `environment`, `deployment`, `version`
2. Add breadcrumbs for Snyk scan timing
3. Link Snyk CVE IDs to Sentry issue context
4. Use source maps for better stack traces

---

## Integration Benefits

### For Security Team
- ✅ Unified view of vulnerabilities + errors
- ✅ Automated alerts for both proactive and reactive issues
- ✅ Faster incident response with full context
- ✅ Metrics for security posture tracking
- ✅ Audit trail of all security events

### For Developers
- ✅ Real-time feedback on security issues
- ✅ Clear remediation paths from Snyk
- ✅ Context in Sentry when investigating errors
- ✅ Reduced surprise incidents in production
- ✅ Learning opportunities from security issues

### For Organization
- ✅ Reduced time-to-detect for vulnerabilities
- ✅ Reduced time-to-remediate for issues
- ✅ Better compliance documentation
- ✅ Risk metrics for stakeholders
- ✅ Improved security culture

---

## Next Steps

1. **Configure Snyk Webhook** (5 min)
   - Snyk Dashboard → Integrations → Enable Sentry

2. **Add Sentry Token to GitHub Secrets** (5 min)
   - GitHub Repo Settings → Secrets → Add SENTRY_AUTH_TOKEN

3. **Update GitHub Actions Workflow** (5 min)
   - Modify `.github/workflows/snyk-security.yml` to post to Sentry

4. **Test Integration** (10 min)
   - Push test commit
   - Verify Snyk runs
   - Verify Sentry receives event
   - Check both dashboards

5. **Configure Alerts** (10 min)
   - Set up Sentry alert rules
   - Set up Snyk notifications
   - Test alert delivery

6. **Train Team** (15 min)
   - Share this guide with team
   - Walk through dashboards
   - Demonstrate alert response flow
   - Document runbook for incident response

---

## Resources

- **Snyk Docs**: https://docs.snyk.io/
- **Sentry Docs**: https://docs.sentry.io/
- **Snyk + Sentry Integration**: https://docs.snyk.io/integrations/sentry-integration
- **GitHub Actions + Snyk**: https://github.com/snyk/actions
- **OWASP Security Testing Guide**: https://owasp.org/www-project-web-security-testing-guide/

---

## Questions?

This integration is essential for:
- **Preventing** vulnerabilities (Snyk)
- **Catching** errors early (Sentry)
- **Responding** faster to incidents (both)
- **Learning** from security issues (analysis)

When both systems work together, you have defense in depth! 🛡️
