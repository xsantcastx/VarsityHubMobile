# ⚡ Quick Reference - QA Infrastructure

## Files & Commands

### 1. Edge-Case Matrix (212 Tests)
```bash
cd server && npx ts-node scripts/edge-case-matrix-runner.ts
# Expected: 212/212 ✅ pass
# Time: ~2-5 minutes
```

### 2. Cleanup Job (Dry-Run)
```bash
cd server && npx ts-node scripts/geofence-cleanup-job.ts
# Shows violations, no deletion
# Time: ~1-5 minutes
```

### 3. Telemetry Integration
```typescript
import { logRejection, getMetrics } from '../lib/geofence-telemetry';

// Log rejection
logRejection({
  timestamp: new Date().toISOString(),
  userId, eventId, contentType, reason,
  distance_km, max_distance_km, message
});

// Get metrics
const metrics = getMetrics({ hoursBack: 24 });
```

### 4. QA Tests
```bash
npm test -- app/__tests__/geofencing-qa.test.ts
# Expected: 30+ tests pass
# Coverage: >85%
# Time: <30 seconds
```

### 5. Migration Safety Check
```bash
chmod +x server/scripts/verify-event-post-access-removal.sh
./server/scripts/verify-event-post-access-removal.sh
# Shows any references to EventPostAccess
# Safe to proceed if: ✅ No references found
```

---

## Rejection Reasons

| Code | Meaning | Fix |
|------|---------|-----|
| `OUTSIDE_DISTANCE_RADIUS` | Too far from venue | Move closer |
| `OUTSIDE_TIME_WINDOW` | Not posting time | Wait for window |
| `NOT_POSTED_DURING_EVENT` | Didn't post during event | Post during event |
| `MISSING_LOCATION` | No GPS data | Enable location |
| `WRONG_CALENDAR_DAY` | Story on wrong day | Post on event day |
| `EVENT_NOT_FOUND` | Invalid event ID | Check event ID |
| `GRACE_PERIOD_EXPIRED` | Legacy (use above instead) | N/A |

---

## Rules Summary

### Stories
- **Radius:** 2km from venue
- **Time:** Event calendar day only (00:00-23:59)
- **Example:** ✅ Can post on 12/19 from 9:00 AM to 11:59 PM if at venue

### Posts
- **Radius:** 15km from venue
- **Time:** -48h to +72h from event (120h window)
- **Grace Rule:** After event ends, must have posted during event to continue
- **Example:** ✅ Can post from 48h before until 72h after if within 15km

---

## Deployment Order (Staging)

1. ✅ **Day 1:** Deploy `geofence-telemetry.ts` (logging only, safe)
2. ✅ **Day 2:** Run `edge-case-matrix-runner.ts` (validate rules)
3. ✅ **Day 2:** Run `geofence-cleanup-job.ts` in dry-run (see violations)
4. ✅ **Day 3:** Deploy `geofencing-qa.test.ts` (add to CI/CD)
5. ✅ **Day 5:** Plan migration (review with DBA, backup, window)

---

## Monitoring Metrics

```typescript
// Get daily metrics
const metrics = getMetrics({ hoursBack: 24 });
console.log('Total rejections:', metrics.total);
console.log('Top reasons:', metrics.topFailures);
console.log('By user:', metrics.byUser);
```

**Key Numbers to Watch:**
- Total rejections per day (baseline)
- Distance vs time rejections ratio
- Top failing users (investigate if >10)
- False positives (should be 0-1%)

---

## Documentation

| Doc | Purpose |
|-----|---------|
| `OVERNIGHT_QA_INFRASTRUCTURE.md` | Full implementation guide |
| `DEPLOYMENT_CHECKLIST_QA_INFRASTRUCTURE.md` | Phased rollout checklist |
| `QA_INFRASTRUCTURE_DELIVERY_SUMMARY.md` | This delivery summary |
| `GEOFENCING_RULES_COMPLETE.md` | Business rules reference |

---

## Emergency Contacts

- 🔥 **Critical Issue:** Alert DevOps + Engineering Lead
- 🐛 **Bug in Tests:** Reach out to QA
- 📊 **Metrics Question:** Check `getMetrics()` output
- 🚨 **Rollback Needed:** Run rollback script immediately

---

## Commit Details

```
Commit: ce4d8247
Message: feat: add comprehensive QA & testing infrastructure for geofencing
Branch: chore/deploy-checklist
Files: 12 changed, 1,752 insertions, 131 deletions
```

---

## Status: ✅ READY FOR STAGING

All systems built, tested, and documented. Proceed with code review → staging deployment.
