# Testing Quick Reference

Quick commands and tips for running tests.

## Quick Commands

```bash
# Run all smoke tests (fastest)
npm run test:smoke

# Run API integration tests
npm run test:api

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Interactive test runner
npm run test:smoke:ui

# Debug mode
npm run test:smoke:debug
```

## Before Running Tests

1. **Start Backend**:

   ```bash
   cd server && npm run dev
   ```

2. **Start Frontend** (for E2E tests):

   ```bash
   npm run web:playwright
   ```

3. **Verify Services**:
   ```bash
   curl http://localhost:4000/health
   curl http://localhost:8081
   ```

## Test Categories

### Smoke Tests (2-5 min)

- App loads without errors
- Health endpoints work
- Basic navigation works
- API authentication works

**Run**: `npm run test:smoke`

### API Tests (5-10 min)

- Health check endpoints
- Authentication endpoints
- Input validation
- Error handling

**Run**: `npm run test:api`

### E2E Tests (10-30 min)

- Complete signup flow
- Login flow
- User navigation
- Critical user journeys

**Run**: `npm run test:e2e`

## Common Issues

### "Connection refused"

- Backend not running: `cd server && npm run dev`
- Frontend not running: `npm run web:playwright`

### "Element not found"

- App structure changed
- Add wait: `await page.waitForSelector(...)`
- Check selectors in browser DevTools

### "Test timeout"

- Services slow to start
- Increase timeout in config
- Check network connectivity

### "API returns 401"

- Token expired
- Test user not created
- Check authentication flow

## Test Reports

View HTML report:

```bash
npx playwright show-report
```

Reports location:

- HTML: `playwright-report/index.html`
- JSON: `test-results/smoke-results.json`
- XML: `test-results/smoke-results.xml`

## CI/CD

Tests run automatically on:

- Pull requests
- Pushes to main
- Nightly builds

Check GitHub Actions for results.
