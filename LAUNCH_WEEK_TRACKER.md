# VarsityHub Launch Week Tracker (7-Day Plan)

**Launch Window:** December 3-9, 2025  
**Status:** Ready to execute  
**Owner:** Engineering & QA Leadership  

---

## Day 1 – Kickoff & Config Prep (Today)

**Owner:** DevOps Lead + Product

### Tasks
- [ ] Share PHASE_1_RUNBOOK.md + README_LAUNCH_READY.md with team
- [ ] Confirm Railway access for all stakeholders
- [ ] Verify SendGrid, Stripe, Google Cloud, Cloudinary, Twilio credentials
- [ ] Run `railway variables list` and audit current config
- [ ] Document any missing secrets in shared tracker

### Success Criteria
- ✅ Team can access Railway dashboard
- ✅ All credentials validated
- ✅ Env gaps documented
- ✅ Go/No-Go decision for Day 2

**Reference Docs:** PHASE_1_RUNBOOK.md, README_LAUNCH_READY.md

---

## Day 2 – Phase 1 Configuration (45–60 min)

**Owner:** DevOps Lead

### Tasks
- [ ] Follow RAILWAY_SECRETS_SETUP.md step-by-step
- [ ] Set SendGrid (API key + 4 template IDs)
- [ ] Set Stripe keys (public + secret)
- [ ] Set JWT_SECRET (generate new)
- [ ] Set Cloudinary, Google Maps, Google OAuth IDs
- [ ] Set Twilio (optional but recommended)
- [ ] Redeploy Railway API service
- [ ] Hit `/health` endpoint until all required integrations = true
- [ ] Run `scripts/email-verification-test.sh` (proves SendGrid delivery)

### Health Check Expected Result
```json
{
  "status": "ok",
  "integrations": {
    "database": true,
    "jwt": true,
    "cloudinary": true,
    "stripe": true,
    "sendgrid": true,
    "googleOAuth": true,
    "googleMaps": true,
    "twilio": true,
    "sentry": true
  },
  "ready": true
}
```

### Success Criteria
- ✅ `/health` returns all required integrations = true
- ✅ Test email delivered successfully
- ✅ Phase 1 boxes checked in LAUNCH_CHECKLIST.md
- ✅ Notify QA to proceed

**Reference Docs:** PHASE_1_RUNBOOK.md, RAILWAY_SECRETS_SETUP.md, server/src/routes/health.ts

---

## Day 3 – Automated & Critical Flow Testing (Phase 2 Start)

**Owner:** Engineering + QA

### Tasks
- [ ] Dev runs `./verify-production-ready.sh` (15 min)
  - Checks Docker, Dockerfile, compose prod
  - Validates healthcheck
  - Tests critical endpoints
  - Stores report artifact
- [ ] QA executes 6 critical flows (CRITICAL_FLOWS_TEST.md, ~60 min)
  1. Register → Email Verify → Login (Fan)
  2. Register → Onboarding → Payment (Coach)
  3. Create Post with Event Attachment
  4. Stripe Payment Charge
  5. Team Creation → Invitation
  6. Push/Email Notifications
- [ ] Capture results in AUTH_ROLES_EXECUTION_LOG.md
- [ ] Document any blockers or regressions

### Success Criteria
- ✅ verify-production-ready.sh passes
- ✅ All 6 critical flows work end-to-end
- ✅ First-pass notes for regressions captured
- ✅ No critical blockers found

**Reference Docs:** CRITICAL_FLOWS_TEST.md, AUTH_ROLES_EXECUTION_LOG.md, verify-production-ready.sh

---

## Day 4 – Deep QA Sweep (Comprehensive Testing)

**Owner:** QA Team

### Tasks
- [ ] Execute AUTH_ROLES_TEST_PLAN.md (19 procedures, ~2-2.5 hours)
  - Part 1: Accounts & Roles (7 tests, 1 hour)
  - Part 2: Coach-Only Surfaces (5 tests, 1.5 hours)
  - Part 3: Organization Pages (4 tests, 1 hour)
  - Part 4: Events & Posts (3 tests, 1 hour)
- [ ] Execute EMAIL_SMS_REGRESSION_CHECKLIST.md (~1 hour)
  - Email verification + password reset + team invites
  - SMS rate limiting + Twilio delivery
- [ ] Execute full QA_CHECKLIST.md (8 sections, ~2-3 hours)
  - Auth & Onboarding (lines 11-47)
  - Payments (lines 49-70)
  - Team Management (lines 63-92)
  - Games & Events (lines 94-118)
  - Posts & Media (lines 119-193)
  - Settings & Profile (lines 194-220)
- [ ] Log bugs with checklist line references
- [ ] Prioritize critical/high fixes for same-day resolution

### Success Criteria
- ✅ 19/19 auth/role tests executed
- ✅ All email/SMS flows verified
- ✅ 8 QA sections signed off
- ✅ Known issues documented with priority
- ✅ QA Lead sign-off pending

**Reference Docs:** AUTH_ROLES_TEST_PLAN.md, EMAIL_SMS_REGRESSION_CHECKLIST.md, QA_CHECKLIST.md, AUTH_ROLES_EXECUTION_LOG.md

---

## Day 5 – Fixes & Regression Loop

**Owner:** Engineering + QA

### Tasks
- [ ] Engineers fix all critical/high bugs from Day 4
- [ ] Code review + merge to main
- [ ] Redeploy to staging/Railway
- [ ] QA re-tests only affected procedures
- [ ] Re-run `./verify-production-ready.sh` to confirm no regressions
- [ ] Prepare store metadata + build settings
  - Verify app.json matches production bundle IDs
  - Confirm eas.json signing setup
  - Finalize Play Store descriptions/screenshots
- [ ] Update VERIFICATION_PLAN_EXECUTION.md with retest results

### Success Criteria
- ✅ Zero open critical bugs
- ✅ All affected tests re-passing
- ✅ verify-production-ready.sh green
- ✅ Store metadata finalized
- ✅ Engineering sign-off ready

**Reference Docs:** VERIFICATION_PLAN_EXECUTION.md, verify-production-ready.sh

---

## Day 6 – Launch Readiness Review (Phase 3 Prep)

**Owner:** QA Lead + Engineering Lead + Product Owner

### Tasks
- [ ] Final run of `./verify-production-ready.sh` (15 min)
- [ ] Final run of `scripts/email-verification-test.sh` (5 min)
- [ ] Gather sign-offs per LAUNCH_CHECKLIST.md
  - [ ] QA Lead: All tests passing, no critical bugs
  - [ ] Engineering Lead: Code quality, security, performance
  - [ ] Product Owner: Feature completeness, market readiness
- [ ] Queue EAS builds for iOS + Android
- [ ] Verify Docker prod stack (server/docker-compose.yml.prod)
- [ ] Conduct go/no-go meeting
- [ ] Document any launch conditions/caveats

### Success Criteria
- ✅ Final verify-production-ready.sh passes
- ✅ 3/3 approvals obtained and recorded
- ✅ iOS + Android builds queued
- ✅ Docker stack verified
- ✅ Go/No-Go decision documented
- ✅ Ready for Day 7 deployment

**Reference Docs:** LAUNCH_CHECKLIST.md, verify-production-ready.sh, server/docker-compose.yml.prod

---

## Day 7 – Deploy & Monitor (Launch Day)

**Owner:** DevOps + Engineering + On-Call Team

### Tasks
- [ ] **8:00 AM:** Start war-room Slack channel (#launch-day)
- [ ] **8:15 AM:** Final health check on production
- [ ] **8:30 AM:** Push backend updates
  - Deploy Railway (redeploy main branch)
  - Verify `/health` endpoint green
- [ ] **9:00 AM:** Submit mobile builds
  - iOS to App Store (TestFlight → Production)
  - Android to Play Console
- [ ] **9:30 AM:** Flip any feature flags (if applicable)
- [ ] **10:00 AM – 10:00 AM (next day):** 24-hour monitoring
  - Monitor `curl /health` every 30 min
  - Watch Sentry dashboard for errors
  - Monitor SendGrid/Stripe/Twilio delivery
  - Track App Store & Play Store review queues
  - Respond to user issues in real-time
- [ ] Update VERIFICATION_READY.txt with hourly status
- [ ] Keep war-room channel active for fixes

### Success Criteria
- ✅ Backend deployed successfully
- ✅ Mobile builds submitted and reviewed
- ✅ Zero critical errors in Sentry (first 4 hours)
- ✅ All integrations passing health checks
- ✅ User-facing flows working end-to-end
- ✅ 24-hour monitoring window complete
- ✅ Post-launch postmortem scheduled

**Reference Docs:** VERIFICATION_READY.txt, Sentry dashboard, health endpoint, server logs

---

## Quick Status Template

Use this daily to track progress:

```
📊 LAUNCH WEEK STATUS – Day X

✅ COMPLETED (Day X)
- [List completed tasks]

🟡 IN PROGRESS (Day X)
- [Current work]

🔴 BLOCKERS
- [Any issues preventing progress]

📈 METRICS
- Health endpoint: [status]
- Critical tests passing: [X/X]
- Known bugs: [Count by severity]

👥 NEXT OWNER
- [Person/team for next phase]
```

---

## Reference Timeline at a Glance

| Day | Phase | Owner | Time | Outcome |
|-----|-------|-------|------|---------|
| 1 | Kickoff | Product + DevOps | 2 hrs | Team aligned, access confirmed |
| 2 | Phase 1 Config | DevOps | 1 hr | Health endpoint green, secrets loaded |
| 3 | Auto + Critical | Eng + QA | 2 hrs | Scripts pass, 6 flows work |
| 4 | Deep QA | QA | 4-5 hrs | 19 tests + 8 sections + email verified |
| 5 | Fixes & Regression | Eng + QA | 3-4 hrs | All bugs fixed, no regressions |
| 6 | Readiness Review | Leads | 1.5 hrs | 3 sign-offs, builds queued, go/no-go |
| 7 | Deploy & Monitor | DevOps + On-Call | 26 hrs | Live to public, 24h monitoring |

---

## Checkpoint Meetings

- **Day 1 EOD:** Team kickoff + access audit
- **Day 2 EOD:** Phase 1 complete, health endpoint green
- **Day 3 EOD:** Scripts pass, critical flows validated
- **Day 4 EOD:** QA sweep complete, issues triaged
- **Day 5 EOD:** All fixes merged, regressions clear
- **Day 6 EOD:** Go/no-go decision + launch readiness
- **Day 7 + 24h:** Post-launch postmortem + handoff to support

---

## Key Documents by Day

- **Day 1:** README_LAUNCH_READY.md, PHASE_1_RUNBOOK.md
- **Day 2:** RAILWAY_SECRETS_SETUP.md, health.ts
- **Day 3:** CRITICAL_FLOWS_TEST.md, verify-production-ready.sh
- **Day 4:** AUTH_ROLES_TEST_PLAN.md, QA_CHECKLIST.md, EMAIL_SMS_REGRESSION_CHECKLIST.md
- **Day 5:** VERIFICATION_PLAN_EXECUTION.md, verify-production-ready.sh
- **Day 6:** LAUNCH_CHECKLIST.md, docker-compose.yml.prod
- **Day 7:** VERIFICATION_READY.txt, Sentry, health endpoint

---

## Notes

- All time estimates include breaks; adjust for team size
- If a blocker surfaces, escalate immediately to engineering lead
- Use shared tracker (Slack/Jira) to log daily status
- Keep LAUNCH_CHECKLIST.md updated in real-time
- Archive this tracker + execution logs post-launch for retrospective

