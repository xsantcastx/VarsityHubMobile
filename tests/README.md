# VarsityHub Test Suite

This directory contains all E2E tests, smoke tests, and API integration tests for VarsityHub.

## Test Structure

```
tests/
├── api/                    # API integration tests
│   ├── health.spec.ts      # Health check tests
│   └── auth-api.spec.ts    # Authentication API tests
├── e2e/                    # End-to-end user flow tests
│   ├── critical-flows.spec.ts  # Critical user journeys
│   ├── feed-messaging.spec.ts  # Feed page and messaging tests
│   ├── highlights.spec.ts      # Highlights page tests
│   ├── upload.spec.ts          # Upload page and file upload tests
│   └── discover.spec.ts         # Discover page tests
├── smoke-comprehensive.spec.ts  # Quick smoke tests
├── smoke.spec.ts           # Basic smoke tests
├── auth-flow.spec.ts       # Auth E2E tests
└── onboarding-flow.spec.ts # Onboarding E2E tests
```

## Running Tests

### Quick Smoke Tests (2-5 minutes)
```bash
npm run test:smoke
```

### API Integration Tests (5-10 minutes)
```bash
npm run test:api
```

### Runtime Onboarding Contract (real API payload)
```bash
API_URL=https://api-production-8ac3.up.railway.app npm run test:runtime:onboarding
```

### Runtime User Boundary Suite (privacy + isolation)
```bash
API_URL=https://api-production-8ac3.up.railway.app npm run test:runtime:boundaries
```

### E2E Tests (10-30 minutes)
```bash
npm run test:e2e
```

### Feed & Messaging Tests (5-15 minutes)
```bash
npm run test:feed-messaging
# or
npx playwright test tests/e2e/feed-messaging.spec.ts
```

### Highlights Tests (5-15 minutes)
```bash
npm run test:highlights
# or
npx playwright test tests/e2e/highlights.spec.ts
```

### Upload Tests (5-15 minutes)
```bash
npm run test:upload
# or
npx playwright test tests/e2e/upload.spec.ts
```

### Discover Page Tests (5-15 minutes)
```bash
npm run test:discover
# or
npx playwright test tests/e2e/discover.spec.ts
```

### All Tests
```bash
npm run test:all
```

### Interactive Mode
```bash
npm run test:smoke:ui
```

### Debug Mode
```bash
npm run test:smoke:debug
```

## Test Types

### Smoke Tests
- **Purpose**: Quick validation that core functionality works
- **Duration**: 2-5 minutes
- **When**: Before every deployment, on every PR
- **Files**: `smoke-comprehensive.spec.ts`, `smoke.spec.ts`

### API Tests
- **Purpose**: Test backend API endpoints directly
- **Duration**: 5-10 minutes
- **When**: On every commit, before deployments
- **Files**: `tests/api/*.spec.ts`

### Runtime Contract & Boundary Tests
- **Purpose**: Validate real client payloads and cross-user isolation on a live server
- **Duration**: 5-15 minutes
- **When**: Before OTA/TestFlight rollout and before production release
- **Files**: `tests/api/onboarding-runtime-contract.spec.ts`, `tests/api/user-boundaries-runtime.spec.ts`

### E2E Tests
- **Purpose**: Test complete user flows
- **Duration**: 10-30 minutes per flow
- **When**: Before releases, nightly builds
- **Files**: `tests/e2e/*.spec.ts`, `auth-flow.spec.ts`, `onboarding-flow.spec.ts`

## Prerequisites

1. **Backend Server**: Must be running on `http://localhost:4000`
   ```bash
   cd server && npm run dev
   ```

2. **Frontend App**: Must be running on `http://localhost:8081`
   ```bash
   npm run web:playwright
   ```

3. **Environment Variables**: Set in `.env` or environment
   - `API_URL` (default: `http://localhost:4000`)
   - `APP_URL` (default: `http://localhost:8081`)

## Test Data

Tests use dynamically generated test data to avoid conflicts:
- Email addresses: `test-{timestamp}-{random}@varsityhub-test.app`
- Passwords: Meet minimum requirements
- Display names: Unique per test run

## Writing New Tests

### API Test Example
```typescript
import { test, expect } from '@playwright/test';

test('My API endpoint test', async ({ request }) => {
  const response = await request.get('http://localhost:4000/my-endpoint');
  expect(response.ok()).toBeTruthy();
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('My user flow test', async ({ page }) => {
  await page.goto('http://localhost:8081');
  await page.click('text=My Button');
  await expect(page.locator('text=Success')).toBeVisible();
});
```

## Test Reports

After running tests, reports are generated in:
- **HTML Report**: `playwright-report/index.html`
- **JSON Results**: `test-results/smoke-results.json`
- **JUnit XML**: `test-results/smoke-results.xml`

View HTML report:
```bash
npx playwright show-report
```

## CI/CD Integration

Tests run automatically in GitHub Actions on:
- Pull requests
- Pushes to main branch
- Scheduled nightly runs

## Troubleshooting

### Tests fail locally but pass in CI
- Check environment variables
- Verify database state
- Check network timeouts

### Playwright can't find elements
- Verify selectors are correct
- Check if app structure changed
- Add wait conditions: `await page.waitForSelector(...)`

### API tests fail
- Verify backend is running: `curl http://localhost:4000/health`
- Check authentication tokens
- Verify test data exists

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if services are running
- Verify network connectivity

## Best Practices

1. **Use unique test data** - Generate unique emails/names per test
2. **Clean up after tests** - Remove test data when possible
3. **Test one thing** - Each test should verify one behavior
4. **Use descriptive names** - Test names should explain what they test
5. **Handle async properly** - Use `await` for all async operations
6. **Wait for elements** - Don't assume elements are immediately available
7. **Check for errors** - Verify no console errors in E2E tests

## Coverage Goals

- **Critical paths**: 100% coverage
- **Important features**: 80% coverage
- **Edge cases**: 60% coverage

## Next Steps

- [ ] Add mobile-specific tests (Detox/Maestro)
- [ ] Add visual regression tests
- [ ] Add performance tests
- [ ] Add accessibility tests
- [ ] Expand E2E coverage for all user roles
