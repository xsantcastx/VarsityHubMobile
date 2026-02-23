# Real-World Functionality Overnight Tests

## Overview

Automated end-to-end tests that verify the app's core functionality works as real users would experience it. These tests exercise actual API endpoints and user flows to catch regressions in business logic and features.

**What it tests:**
- User authentication (registration, login, email verification)
- Post creation and feed retrieval
- Team creation and management (coach features)
- Game/Event creation
- Direct messaging between users
- API health and integration status
- User profile management

---

## Quick Start

### Prerequisites
- API server running (or accessible API URL)
- Database accessible to API
- Test email service configured (for verification tests)

### Run Now (Manual)
```bash
cd /Users/varsityhub/VarsityHubMobile

# With local API
API_URL=http://localhost:4000 ./scripts/overnight-functionality.sh

# With production/staging API
API_URL=https://api-production-8ac3.up.railway.app ./scripts/overnight-functionality.sh
```

Takes ~5-10 minutes. Results saved to `overnight-results/`.

---

## Test Coverage

### 1. User Registration and Email Verification
- **Tests:** POST `/auth/register`
- **Validates:** User can register, receives access token, verification code provided
- **Expected:** 201 status, access_token in response

### 2. User Login Flow
- **Tests:** POST `/auth/login`
- **Validates:** Registered users can log in successfully
- **Expected:** 200 status, access_token and user data

### 3. Post Creation
- **Tests:** POST `/posts`
- **Validates:** Authenticated users can create posts
- **Expected:** 201 status, post ID returned

### 4. Posts Feed Retrieval
- **Tests:** GET `/posts`
- **Validates:** Users can retrieve posts feed
- **Expected:** 200 status, array of posts

### 5. Team Creation (Coach Role)
- **Tests:** POST `/teams` with coach user
- **Validates:** Coaches can create teams
- **Expected:** 201 status OR 403 if verification required (both valid)

### 6. Teams List Retrieval
- **Tests:** GET `/teams`
- **Validates:** Users can view teams list
- **Expected:** 200 status, array of teams

### 7. Game/Event Creation
- **Tests:** POST `/games`
- **Validates:** Coaches can create games/events
- **Expected:** 201 status OR 403 if permissions required

### 8. Direct Messaging
- **Tests:** POST `/messages`
- **Validates:** Users can send direct messages
- **Expected:** 201 status OR 403 if messaging restricted (age policies, blocks)

### 9. Messages List Retrieval
- **Tests:** GET `/messages`
- **Validates:** Users can view their messages
- **Expected:** 200 status, array of messages

### 10. API Health Check
- **Tests:** GET `/health`
- **Validates:** API is healthy, integrations working
- **Expected:** 200 status, integrations (stripe, smtp, sentry, database) reported

### 11. User Profile Retrieval
- **Tests:** GET `/users/me`
- **Validates:** Authenticated users can view their profile
- **Expected:** 200 status, user data returned

### 12. Events List Retrieval
- **Tests:** GET `/events`
- **Validates:** Users can view events list
- **Expected:** 200 status, array of events

---

## Output Files

All results are saved in `overnight-results/`:

### Test Results
- `functionality-TIMESTAMP.log` - Full test execution log
- `functionality-results-TIMESTAMP.json` - Playwright JSON results
- `functionality-summary-TIMESTAMP.json` - Test summary with pass/fail counts

### Sample Summary Output
```json
{
  "timestamp": "2025-12-10T11:23:45.123Z",
  "totalTests": 12,
  "passed": 11,
  "failed": 1,
  "passRate": "91.67%",
  "apiUrl": "http://localhost:4000",
  "results": [
    {
      "test": "User Registration Flow",
      "passed": true,
      "apiStatus": 201,
      "details": "User registered successfully. Email verified: true"
    },
    {
      "test": "Team Creation (Coach)",
      "passed": false,
      "apiStatus": 403,
      "details": "Team creation failed: 403"
    }
  ]
}
```

---

## Morning Review

When you wake up, check the results:

```bash
cd /Users/varsityhub/VarsityHubMobile

# View latest summary
ls -t overnight-results/functionality-summary-*.json | head -1 | xargs cat | jq .

# View test log
ls -t overnight-results/functionality-*.log | head -1 | xargs tail -50

# Check for failed tests
ls -t overnight-results/functionality-summary-*.json | head -1 | xargs jq '.results[] | select(.passed == false)'
```

### What to Look For

1. **All Tests Passing** ✅
   - Core functionality working
   - No regressions introduced

2. **Some Tests Failing** ⚠️
   - Check which endpoints failed
   - Review API status codes
   - Some failures might be expected (e.g., 403 for unverified users)

3. **API Health Check Failing** 🚨
   - **Critical** - API might be down or misconfigured
   - Check API server status
   - Review integration health (Stripe, SMTP, Sentry, Database)

---

## Understanding Test Results

### Expected Failures (Not Blockers)

Some tests may "fail" but represent expected behavior:

1. **Team Creation (403)** - Expected if user not verified
2. **Game Creation (403)** - Expected if user lacks permissions
3. **Messaging (403)** - Expected if messaging restricted (age policies, blocks)

### Critical Failures (Blockers)

These indicate serious issues:

1. **Registration/Login failing** - Core auth broken
2. **Health check failing** - API down or misconfigured
3. **All tests failing** - API unreachable or wrong URL

---

## Integration with Nightly Sweeps

### Option 1: Add to Existing Nightly Sweeps
Edit your nightly automation to include functionality tests:

```bash
# In nightly-sweeps.sh
echo "🔍 Running functionality tests..."
API_URL=https://api-production.example.com ./scripts/overnight-functionality.sh &
FUNCTIONALITY_PID=$!
```

### Option 2: Run Separately (Recommended)
Keep functionality tests separate since they require API access:

```bash
# In cron (separate schedule)
0 2 * * * cd /path/to/project && API_URL=https://api.example.com ./scripts/overnight-functionality.sh >> overnight-results/cron.log 2>&1
```

### Option 3: CI/CD Integration
Add to GitHub Actions workflow:

```yaml
- name: Run Functionality Tests
  run: |
    API_URL=${{ secrets.API_URL }} ./scripts/overnight-functionality.sh
  env:
    API_URL: ${{ secrets.API_URL }}
```

---

## Troubleshooting

### API Not Accessible
**Error:** `API is not accessible at http://localhost:4000`

**Solution:**
```bash
# Start API server
cd server
npm run dev

# Or use production API
API_URL=https://api-production-8ac3.up.railway.app ./scripts/overnight-functionality.sh
```

### Tests Timing Out
**Error:** Tests hang or timeout

**Solution:**
- Check API response times
- Verify database is responsive
- Check network connectivity
- Increase Playwright timeout in test file

### False Positives
**Issue:** Tests fail but functionality works

**Solution:**
1. Check API status codes - some 403s are expected
2. Review test logs for actual error messages
3. Verify API URL is correct
4. Check if test data conflicts (email already exists, etc.)

### Database Conflicts
**Issue:** Tests fail due to duplicate emails/users

**Solution:**
- Tests use unique timestamps to avoid conflicts
- If persistent, clean test data:
  ```sql
  DELETE FROM users WHERE email LIKE 'overnight-test-%';
  ```

---

## Customizing Tests

### Add New Functionality Test

Edit `tests/overnight-functionality.spec.ts`:

```typescript
test('13. New Feature Test', async ({ request }) => {
  const testName = 'New Feature';
  
  try {
    const user = await createVerifiedUser(request);
    
    const response = await authRequest(request, user.token, 'get', '/new-endpoint');
    const status = response.status();
    
    if (status === 200) {
      logResult(testName, true, 'Feature working', status);
      expect(true).toBeTruthy();
    } else {
      logResult(testName, false, `Feature failed: ${status}`, status);
    }
  } catch (error) {
    logResult(testName, false, `Error: ${error.message}`, undefined, String(error));
  }
});
```

### Test Different Environments

```bash
# Test staging
API_URL=https://staging-api.example.com ./scripts/overnight-functionality.sh

# Test production
API_URL=https://api-production.example.com ./scripts/overnight-functionality.sh

# Test local
API_URL=http://localhost:4000 ./scripts/overnight-functionality.sh
```

---

## Best Practices

1. **Run Regularly** - Nightly is ideal for catching regressions
2. **Review Failures** - Not all failures are blockers (check status codes)
3. **Monitor Trends** - Track pass rate over time
4. **API Health First** - If health check fails, investigate immediately
5. **Clean Test Data** - Periodically clean up test users/data

---

## Expected Results

### Successful Run
- All 12 tests pass
- API health check reports all integrations working
- Summary shows 100% pass rate (or near 100% with expected 403s)

### Typical Results
- **10-12 tests passing** - Normal (some 403s expected for permission checks)
- **8-9 tests passing** - Minor issues, review failed endpoints
- **< 8 tests passing** - Critical issues, investigate API health

### Action Items
- **Any failures** - Review test logs, check API status
- **Health check fails** - **CRITICAL** - API down or misconfigured
- **Consistent failures** - Likely regression, investigate immediately

---

## Files Reference

| File | Purpose |
|------|---------|
| `tests/overnight-functionality.spec.ts` | Playwright test suite |
| `scripts/overnight-functionality.sh` | Execution script |
| `overnight-results/functionality-*.json` | Test results |
| `overnight-results/functionality-summary-*.json` | Test summaries |

---

## Next Steps

1. **First Run:** Execute script to establish baseline
2. **Review:** Check all test results, verify API health
3. **Automate:** Add to nightly cron or CI/CD pipeline
4. **Monitor:** Review results daily, catch regressions early
5. **Expand:** Add more functionality tests as features grow

This gives you **automated functional QA** running every night while you sleep! 🌙
