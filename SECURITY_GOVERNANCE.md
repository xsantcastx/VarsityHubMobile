# Security Governance & Policies

## Document Overview

This document establishes the security governance framework, incident response procedures, and ongoing monitoring policies for VarsityHub Mobile.

---

## 1. Security Roles & Responsibilities

### Security Owner
- **Role:** Emil Mancero (Inventor/Owner)
- **Responsibilities:**
  - Final approval on security decisions
  - Budget for security tools & audits
  - Incident escalation & customer communication
  - Annual security strategy review

### Engineering Lead
- **Role:** Lead Developer / DevOps Lead
- **Responsibilities:**
  - Implement security controls
  - Review & approve PRs with security implications
  - Monitor security dashboards (Snyk, Sentry, GitHub Security)
  - Drive quarterly security reviews
  - Maintain security documentation

### Development Team
- **Responsibilities:**
  - Follow security checklist before commits
  - Review security alerts in PRs
  - Merge Snyk fix PRs promptly
  - Report security issues immediately
  - Attend quarterly security training

### DevOps/Infrastructure
- **Responsibilities:**
  - Manage secrets (GitHub Actions, EAS)
  - Configure CI/CD security gates
  - Monitor API server security
  - Maintain backup & disaster recovery
  - Handle infrastructure incidents

---

## 2. Security Standards & Framework

### Standards We Follow
- **OWASP Top 10 Mobile** - Application security
- **GDPR** - Data privacy (EU users)
- **CCPA** - Data privacy (California users)
- **PCI DSS** - Payment card handling (Stripe integration)
- **NIST Cybersecurity Framework** - Risk management

### Our Baseline Requirements
1. **All dependencies scanned** with Snyk (SCA)
2. **All code reviewed** for security issues (SAST)
3. **PR gating** - blocks merges with critical/high CVEs
4. **Secrets management** - no hardcoded credentials
5. **Logging & monitoring** - Sentry for error tracking
6. **Incident response** - 24-hour incident response plan
7. **Data protection** - TLS 1.2+, secure storage, auth controls
8. **Compliance checks** - quarterly reviews

---

## 3. Vulnerability Management

### Severity Levels

| Severity | CVSS Score | Response Time | Examples |
|----------|-----------|---|----------|
| Critical | 9.0-10.0 | 24 hours | RCE, Auth bypass, data theft |
| High | 7.0-8.9 | 7 days | Privilege escalation, XSS, SQL injection |
| Medium | 4.0-6.9 | 30 days | Information disclosure, DoS |
| Low | 0.1-3.9 | 90 days | Deprecations, minor bugs |

### Vulnerability Lifecycle

```
1. DISCOVERED (Snyk alert)
   ↓
2. ASSESSED (Security lead evaluates exploitability)
   ↓
3. REMEDIATED (Patch applied, tested, merged)
   ↓
4. VERIFIED (Rescan confirms fix)
   ↓
5. DOCUMENTED (Issue tracker updated)
```

### Remediation Paths
1. **Patch:** Upgrade to patched version
   ```bash
   npm install vulnerable-package@latest
   ```

2. **Workaround:** Disable vulnerable feature temporarily
   ```typescript
   // Comment out: this.unsafeFeature()
   // TODO: Re-enable after CVE-2025-xxx is patched
   ```

3. **Accept Risk:** Document & monitor (if no patch available)
   ```
   snyk ignore CVE-xxxx --reason "Unmaintained package, 
   not used in critical path. Monitor for updates."
   ```

---

## 4. Incident Response Plan

### Incident Definition
An incident is:
- Unauthorized access to systems or data
- Data breach (personal info leaked)
- Service outage > 1 hour
- Confirmed security vulnerability in production
- Malware or malicious code detected

### Response Steps

#### Phase 1: Detection & Assessment (1 hour)
1. **Identify** the incident type & severity
2. **Confirm** the issue is real (not false positive)
3. **Assess** impact:
   - How many users affected?
   - What data at risk?
   - Service outage?
4. **Notify** security team & engineering lead
5. **Create** incident ticket

**Owners:** Security lead, on-call engineer

#### Phase 2: Containment (2-4 hours)
1. **Isolate** affected systems (if needed)
   - Revoke compromised credentials
   - Block suspicious IPs
   - Kill compromised sessions

2. **Reduce** impact
   - Disable vulnerable feature
   - Redirect traffic away
   - Increase logging

3. **Gather** evidence
   - Save logs
   - Screenshot errors
   - Document timeline

**Owners:** DevOps, Engineering

#### Phase 3: Remediation (4-24 hours)
1. **Develop** fix:
   - Patch code
   - Update dependencies
   - Reconfigure systems

2. **Test** fix:
   - Verify in staging
   - Confirm no regressions
   - Load test if applicable

3. **Deploy** fix:
   - Release to production
   - Monitor for 2 hours
   - Revert if issues

**Owners:** Engineering, DevOps

#### Phase 4: Recovery (24-48 hours)
1. **Monitor** system health:
   - Error rates normal?
   - Performance acceptable?
   - User complaints decreasing?

2. **Restore** normal operations:
   - Reduce monitoring frequency
   - Re-enable features
   - Clear incident status

**Owners:** DevOps, Engineering Lead

#### Phase 5: Post-Incident Review (1 week)
1. **Timeline:** Document exact sequence of events
2. **Root cause:** Why did this happen?
3. **Impact:** How many users? What data?
4. **Fix:** What was done?
5. **Prevention:** How do we prevent this again?
6. **Lessons learned:** Discuss with team
7. **Documentation:** Update runbooks

**Meeting:** All involved parties + security lead

### Incident Communication

#### To Users (if data breach)
- **When:** Within 24-72 hours
- **What to say:**
  ```
  Dear VarsityHub User,

  We discovered a security issue that may have affected 
  your account. Here's what happened:
  
  WHAT: [Brief description]
  WHEN: [Date/time]
  WHO: [How many users, what data]
  ACTIONS: [What we've done to fix it]
  YOU: [What users should do]
  
  For details, see: [Security blog post link]
  Questions? Contact security@varsityhub.com
  ```

#### To Regulators (if required)
- **GDPR:** Notify supervisory authority + users
- **CCPA:** Notify state attorney general + users
- **HIPAA:** (Not applicable unless health data)

#### To Partners
- **API customers:** Notify of service impact
- **Service providers:** Alert if their data at risk

#### To Press (optional)
- **Major breaches:** Consider transparency
- **Timing:** Coordinate with legal & PR

### Incident Response Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Security Lead | [TBD] | [TBD] | [TBD] |
| Engineering Lead | [TBD] | [TBD] | [TBD] |
| DevOps | [TBD] | [TBD] | [TBD] |
| Owner (Escalation) | Emil Mancero | emilmancero@gmail.com | [TBD] |

---

## 5. Security Training & Awareness

### Onboarding (New Hires)
- [ ] Review MOBILE_SECURITY_HARDENING.md
- [ ] Review this document (SECURITY_GOVERNANCE.md)
- [ ] Complete SNYK_SETUP_GUIDE.md
- [ ] Review incident response plan
- [ ] Get GitHub/Sentry access
- [ ] Attend 1-on-1 security overview

**Duration:** 2-3 hours

### Quarterly Review (All Team)
- [ ] Discuss recent CVEs & lessons learned
- [ ] Update threat model
- [ ] Review compliance status
- [ ] Discuss new security tools/features
- [ ] Training on new security practices

**Duration:** 1 hour per quarter

### Annual Security Workshop
- [ ] Hire external security expert
- [ ] Code review workshop (security focus)
- [ ] Penetration test debrief
- [ ] Update security strategy
- [ ] Plan improvements for next year

**Duration:** 1-2 days

### Knowledge Resources
- **OWASP:** https://owasp.org/
- **Mobile Security:** https://cheatsheetseries.owasp.org/cheatsheets/Mobile_App_Security_Cheat_Sheet.html
- **React Native Security:** https://reactnative.dev/docs/security
- **Expo Security:** https://docs.expo.dev/tutorial/security/

---

## 6. Security Policy Enforcement

### Code Review Requirements

**Security issues block merge:**
```
Critical/High CVEs
├─ Hardcoded secrets
├─ SQL injection risk
├─ Cross-site scripting (XSS)
├─ Insecure crypto
├─ Missing input validation
└─ Known vulnerable library

Medium issues must be documented:
├─ Deprecation warnings
├─ Code complexity
├─ Performance issues
└─ Non-critical bugs
```

**Review checklist:**
- [ ] Snyk PR check passed
- [ ] No hardcoded credentials
- [ ] Input validation present
- [ ] Error handling catches exceptions
- [ ] No sensitive data in logs
- [ ] No deprecated APIs used
- [ ] Authentication/authorization correct

### Automated Enforcement
1. **Pre-commit hook** (local)
   - Scans staged files for secrets
   - Runs linter & type checker
   ```bash
   npm install husky secrets-scanner --save-dev
   ```

2. **GitHub branch protection**
   - Require Snyk check to pass
   - Require code review (1 approver)
   - Require up-to-date branch
   - Dismiss stale reviews on push

3. **GitHub Actions**
   - Run Snyk scan on every PR
   - Block merge if vulnerabilities
   - Comment with details & fixes

---

## 7. Data Protection & Privacy

### Data Classification

| Level | Examples | Storage | Retention | Encryption |
|-------|----------|---------|-----------|-----------|
| Secret | API keys, passwords | SecureStore | Until revoked | YES |
| Confidential | Auth tokens, emails | SecureStore | Per policy | YES |
| Internal | User profiles, games | Database | Per policy | At rest |
| Public | Team names, leaderboards | Database | Per policy | NO |

### User Data Rights

**Users can:**
- [ ] Access their data (download)
- [ ] Delete their account
- [ ] Export game history
- [ ] Opt-out of analytics
- [ ] Request data deletion

**We will:**
- [ ] Respond within 30 days
- [ ] Provide data in portable format (JSON)
- [ ] Delete within 90 days (account + data)
- [ ] Notify other users of deletion (anonymize)

### Data Retention Schedule

```
Game scores:     2 years (for leaderboards)
Chat messages:   1 year
User activity:   90 days
Error logs:      90 days (Sentry)
API logs:        30 days
Backups:         7 days
```

---

## 8. Compliance Checklist

### Pre-Launch Compliance (Before Release)
- [ ] GDPR privacy policy finalized
- [ ] CCPA privacy policy finalized
- [ ] Terms of Service reviewed by legal
- [ ] Payment processing (Stripe) compliant
- [ ] Data retention policy documented
- [ ] Data handling procedures documented
- [ ] Incident response plan drafted
- [ ] Security audit completed (internal or external)
- [ ] Penetration test scheduled
- [ ] Sentry monitoring configured
- [ ] Snyk scanning enabled
- [ ] Backup & recovery tested

### Annual Compliance Audit
- [ ] GDPR compliance verified (if EU users)
- [ ] CCPA compliance verified (if CA users)
- [ ] Data retention policy enforced
- [ ] Access controls audit
- [ ] Encryption audit
- [ ] Third-party data processor review
- [ ] Penetration test performed
- [ ] Security training completed
- [ ] Incident response drill executed

---

## 9. Third-Party Security

### Vendor Security Review

Before using any third-party service:
1. **Check:** Do they need user data?
2. **Assess:** What data do they get?
3. **Review:** Their security/privacy policies
4. **Document:** Data Processing Agreement (DPA)
5. **Monitor:** Annual re-assessment

### Current Approved Vendors
| Service | Data | Criticality | Last Review |
|---------|------|-------------|------------|
| Stripe | Payments | Critical | 2025-01 |
| SendGrid | Emails | High | 2025-01 |
| Sentry | Errors | High | 2025-01 |
| Railway (Hosting) | Everything | Critical | 2025-01 |
| GitHub | Code | High | 2025-01 |
| Google OAuth | Identity | Critical | 2025-01 |

### Vendor DPA Checklist
- [ ] DPA signed (if required by GDPR)
- [ ] Data location specified
- [ ] Subprocessors listed
- [ ] Security standards required
- [ ] Breach notification SLA defined
- [ ] Data deletion procedures defined

---

## 10. Security Metrics & KPIs

### What We Track
```
Vulnerability Metrics:
├─ New CVEs discovered per month
├─ Average time to remediate (days)
├─ % of high/critical fixed within 7 days
├─ Snyk scan pass rate (%)
└─ Code coverage of security tests

Incident Metrics:
├─ Security incidents per year
├─ Average MTTR (Mean Time To Remediate)
├─ User impact (% affected)
├─ Data exposed (# of users)
└─ Root cause categories

Compliance Metrics:
├─ Security training completion (%)
├─ Code review coverage (%)
├─ Audit findings resolved (%)
└─ Policy compliance (%)
```

### Reporting Schedule
- **Weekly:** To engineering lead (Snyk dashboard)
- **Monthly:** To security team (detailed report)
- **Quarterly:** To leadership (executive summary)
- **Annually:** Full audit report to board

---

## 11. Change Management & Security

### Security Review for Changes

When making changes to:
- **Authentication:** Full security review required
- **Payments:** PCI DSS review required
- **Data storage:** Encryption review required
- **API endpoints:** Authorization review required
- **Dependencies:** Snyk scan required

### Change Process
```
1. Developer proposes change
   ↓
2. Technical review (code quality)
   ↓
3. Security review (if applicable)
   ↓
4. Snyk scan (all changes)
   ↓
5. Approval & merge
   ↓
6. Deploy to staging
   ↓
7. Security validation
   ↓
8. Deploy to production
```

---

## 12. Continuous Improvement

### Quarterly Goals
```
Q1 2025:
- ✅ Set up Snyk scanning
- Reduce CVE count to 0 (critical/high)
- 100% code review coverage
- Security training completed

Q2 2025:
- Implement certificate pinning (optional)
- Add biometric authentication (optional)
- Penetration test first draft
- Update threat model

Q3 2025:
- External penetration test
- Remediate all findings
- Update security strategy
- Plan next year improvements

Q4 2025:
- Annual security audit
- End-of-year review
- Plan Q1 2026 priorities
- Holiday security review
```

### Feedback Loop
1. **Team feedback:** Security issues in dev?
2. **User feedback:** Any security concerns?
3. **Vendor feedback:** Any issues from providers?
4. **Incident review:** What did we learn?
5. **External review:** Auditor recommendations?

---

## 13. Escalation & Contacts

### When to Escalate

**Immediate escalation** (call):
- Confirmed data breach
- Service outage > 15 minutes
- RCE or auth bypass found
- Ransomware detected

**Urgent escalation** (email + meeting):
- Critical CVEs found
- Security incident suspected
- Compliance violation
- Third-party breach affecting us

**Regular escalation** (weekly meeting):
- Medium CVEs
- Code security findings
- Compliance updates
- Monitoring alerts

### Contact Directory

```
SECURITY TEAM:
  Security Lead: [TBD]
  Email: security@varsityhub.com
  Slack: #security

EMERGENCY CONTACTS:
  On-call: [Rotate weekly]
  Owner: Emil Mancero (emilmancero@gmail.com)

EXTERNAL:
  Legal: [TBD]
  Insurance: [TBD]
  Law Enforcement: [Contact as needed]
```

---

## 14. Document Management

### Version History
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-04 | Initial document | Security Team |

### Review Schedule
- **Initial:** Before production launch
- **Quarterly:** Every 3 months (Jan, Apr, Jul, Oct)
- **Major:** After incidents
- **Annual:** Full review & update

### Document Location
```
.github/instructions/
├─ snyk_rules.instructions.md (always apply)
├─ SECURITY_GOVERNANCE.md (this document)
├─ MOBILE_SECURITY_HARDENING.md (technical)
└─ SNYK_SETUP_GUIDE.md (operational)
```

---

## Sign-Off

**Approved By:**
- [ ] Security Owner (Emil Mancero)
- [ ] Engineering Lead
- [ ] DevOps Lead
- [ ] Legal (if compliance required)

**Date Approved:** _______________

**Next Review Date:** December 4, 2025 (Quarterly)

---

## Appendix A: Security Tools Matrix

| Tool | Purpose | Status | Schedule |
|------|---------|--------|----------|
| Snyk | Vulnerability scanning (SCA/SAST) | Active | On every PR + daily |
| Sentry | Error tracking & monitoring | Active | Continuous |
| GitHub Security | Secret scanning, code review | Active | Continuous |
| npm audit | Dependency vulnerability audit | Active | On every install |
| ESLint | Code quality & security rules | Active | On every commit |
| TypeScript | Type safety (catch bugs early) | Active | On every save |
| Watchman | File system monitoring | Active | During dev |

---

## Appendix B: Incident Response Runbook

### Incident: Exposed API Key
```
1. Rotate compromised key immediately
2. Invalidate all old tokens
3. Search Git history for other exposed keys
4. Check Sentry for unauthorized access logs
5. Review API access logs (last 24 hours)
6. Notify affected users
7. Add pre-commit secret scanning
8. Update security training
```

### Incident: Vulnerable Dependency
```
1. Assess if it's in use (search code)
2. Check if exploitable (CVSS, context)
3. Upgrade if patch available
4. Test for regressions
5. If no fix: accept risk or replace package
6. Verify Snyk scan passes
7. Merge fix PR
```

### Incident: Data Breach
```
1. Shut down affected systems
2. Count affected users & data types
3. Preserve evidence (logs)
4. Determine root cause
5. Fix vulnerability
6. Test fix in staging
7. Deploy fix to production
8. Restore normal operations
9. Notify users within 72 hours
10. Notify regulators if required
11. Post-mortem within 1 week
```

---

**END OF DOCUMENT**

For questions or updates, contact the Security Team.
