# 🚀 Production Deployment Checklist - Geofencing QA Infrastructure

**Created:** December 19, 2025  
**Deploy To:** Staging → Production  
**Timeline:** This week → Next week

---

## ✅ Pre-Deployment Validation

### Code Quality
- [ ] All 5 TypeScript files compile without errors
- [ ] No console.log spam in production build
- [ ] Error handling covers all edge cases
- [ ] No hardcoded test data in production code
- [ ] Telemetry doesn't expose sensitive user data

### Test Coverage
- [ ] Edge-case matrix runs successfully (212 tests)
- [ ] QA automation tests pass locally (30+ tests)
- [ ] No test data persists after runs
- [ ] Mock GPS coordinates are clearly marked

### Database Safety
- [ ] Backup created before running any script
- [ ] EventPostAccess table verified to be safe for deletion
- [ ] No foreign key violations found
- [ ] Migration rollback plan documented

---

## 📋 Staging Deployment Checklist

### Phase 1: Telemetry Logging (No Database Changes)
```
Deploy: server/src/lib/geofence-telemetry.ts
Timeline: Day 1
Risk: Low (logging only)
```

**Validation:**
- [ ] Deploy to staging
- [ ] Restart server
- [ ] Check logs for telemetry output
- [ ] Verify metrics collection works
- [ ] Monitor for 4 hours
- [ ] Check error rates (should be 0)

### Phase 2: Edge-Case Matrix Testing
```
Deploy: server/scripts/edge-case-matrix-runner.ts
Timeline: Day 2
Risk: Low (testing script only)
```

**Validation:**
- [ ] Run matrix on staging data
- [ ] Verify 212 tests execute
- [ ] Check boundary analysis output
- [ ] Document any unexpected failures
- [ ] Compare results to baseline

### Phase 3: Auto-Cleanup Job
```
Deploy: server/scripts/geofence-cleanup-job.ts
Timeline: Day 2-3
Risk: Medium (reads database, no writes in dry-run)
```

**Validation:**
- [ ] Run in dry-run mode first
- [ ] Review what would be deleted
- [ ] Verify no false positives
- [ ] Test with subset of data
- [ ] Plan actual cleanup window

### Phase 4: QA Automation Tests
```
Deploy: app/__tests__/geofencing-qa.test.ts
Timeline: Day 3-4
Risk: Low (testing framework only)
```

**Validation:**
- [ ] Run Jest test suite
- [ ] Verify all 30+ tests pass
- [ ] Check coverage metrics
- [ ] Review failure messages
- [ ] Add to CI/CD pipeline

### Phase 5: Migration Preparation
```
Deploy: server/prisma/migrations/drop-event-post-access.sql
Timeline: Day 5 (prepared, not executed)
Risk: High (destructive database change)
```

**Validation:**
- [ ] Code review by DBA
- [ ] Run verification script
- [ ] No references to EventPostAccess found
- [ ] Backup system tested
- [ ] Rollback plan confirmed
- [ ] Maintenance window scheduled

---

## 🎯 Production Rollout Sequence

### Stage 1: Enable Telemetry (Safe, Logging Only)
```bash
# 1. Deploy telemetry module
git checkout BRANCH
npm run build
npm run deploy:prod

# 2. Monitor for 24 hours
# Check: error rates, memory usage, rejection counts

# 3. Review metrics
curl https://api.varsityhub.com/admin/metrics/geofencing
```

### Stage 2: Run Edge-Case Validation
```bash
# Run on production-like data
cd server
npx ts-node scripts/edge-case-matrix-runner.ts

# Verify: 212/212 tests pass
# If any fail: Investigate regression before proceeding
```

### Stage 3: Deploy Cleanup Job (Optional)
```bash
# Schedule as daily cron job
# 0 2 * * * /path/to/geofence-cleanup-job.ts

# First run: Dry-run only
# Review: What would be deleted
# Second run: Enable deletion if safe
```

### Stage 4: Deploy QA Tests
```bash
# Add to CI/CD
# Run on every deployment
# Fail deployment if any test fails
npm test -- geofencing-qa.test.ts
```

### Stage 5: Execute Migration (Requires Downtime)
```bash
# ONLY after all above are validated in production

# 1. Announce maintenance window (24 hours notice)
# 2. Backup database
# 3. Execute migration
# 4. Verify no errors
# 5. Monitor for 48 hours
# 6. Announce completion
```

---

## 📊 Success Criteria

### Telemetry (Phase 1)
- ✅ Zero deployment errors
- ✅ Rejection logs appearing in real-time
- ✅ No performance degradation (< 2% CPU increase)
- ✅ Memory usage stable

### Edge-Case Matrix (Phase 2)
- ✅ All 212 tests pass
- ✅ Boundary analysis matches expected values
- ✅ No regressions vs baseline
- ✅ Execution time < 2 minutes

### Cleanup Job (Phase 3)
- ✅ Dry-run identifies all violations
- ✅ False positive rate < 1%
- ✅ Job completes in < 5 minutes
- ✅ No impact on running application

### QA Tests (Phase 4)
- ✅ 30+ tests execute successfully
- ✅ Code coverage > 85% for geofencing
- ✅ All mocked locations work correctly
- ✅ Tests run in < 30 seconds

### Migration (Phase 5)
- ✅ EventPostAccess table removed
- ✅ Zero error logs related to table
- ✅ Post creation performance unchanged
- ✅ Database size reduced 1-5%

---

## 🚨 Rollback Triggers

### Immediate Rollback If:
- [ ] Telemetry causes > 10% error rate
- [ ] Edge-case tests > 5% failures
- [ ] Cleanup job deletes >10% of data unexpectedly
- [ ] QA tests can't execute
- [ ] Migration causes post creation failures

### Rollback Procedure:
```bash
# If Phase 1-4 fail:
1. Revert code deployment
2. Restart services
3. Monitor error rates
4. Investigate failure

# If Phase 5 fails:
1. Restore database from backup
2. Re-run migration on test environment
3. Fix identified issues
4. Replan migration window
```

---

## 📈 Post-Deployment Monitoring

### First 24 Hours:
- [ ] Error rates stable or decreasing
- [ ] No "EventPostAccess" errors in logs
- [ ] Telemetry metrics appearing
- [ ] User complaints: 0
- [ ] Performance: Within baseline

### First Week:
- [ ] Rejection distribution matches expectations
- [ ] Cleanup job running without issues
- [ ] QA tests passing in CI/CD
- [ ] Database queries performing well
- [ ] No memory leaks detected

### First Month:
- [ ] 30-day rejection trends analyzed
- [ ] Migration prepared and communicated
- [ ] Data quality improvements verified
- [ ] Performance metrics baseline established
- [ ] Team trained on new monitoring tools

---

## 🔑 Key Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|-----------------|
| DevOps Lead | [Name] | [Phone/Email] | Deployment, Rollback |
| DBA | [Name] | [Phone/Email] | Database Changes, Backup |
| QA Lead | [Name] | [Phone/Email] | Testing Validation |
| Product Owner | [Name] | [Phone/Email] | Business Approval |
| On-Call Engineer | [Rotation] | [Phone] | 24h Monitoring |

---

## 📝 Documentation Links

- [Geofencing Rules Documentation](./GEOFENCING_RULES_COMPLETE.md)
- [Edge-Case Matrix Details](./OVERNIGHT_QA_INFRASTRUCTURE.md)
- [API Changes & Breaking Changes](./API_DEPLOYMENT_GUIDE.md)
- [Rollback Procedures](./DISASTER_RECOVERY.md)

---

## ✅ Final Sign-Off

**Ready for Staging Deployment:** [ ] Yes [ ] No

**Approved By:**
- [ ] Engineering Lead
- [ ] Product Manager
- [ ] DevOps/Infrastructure
- [ ] QA Lead

**Date Approved:** ___________

**Planned Deployment Date:** ___________

**Expected Production Go-Live:** ___________

---

*Keep this checklist updated as phases complete. Update with actual names, dates, and sign-offs before deployment.*
