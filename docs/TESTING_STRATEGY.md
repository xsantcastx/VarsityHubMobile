# VarsityHub Testing Strategy

**Last Updated**: December 2024  
**Status**: Active

---

## Overview

This document outlines the comprehensive testing strategy for VarsityHub, including E2E tests, smoke tests, and integration tests.

---

## Test Types

### 1. Smoke Tests

**Purpose**: Quick validation that core functionality works  
**Duration**: 2-5 minutes  
**Frequency**: Before every deployment, on every PR

**What They Test**:

- App loads without crashes
- Health endpoints respond
- Critical API endpoints are accessible
- No console errors on startup

### 2. E2E Tests (End-to-End)

**Purpose**: Test complete user flows from start to finish  
**Duration**: 10-30 minutes per flow  
**Frequency**: Before releases, nightly builds

**What They Test**:

- Complete user journeys (signup → onboarding → feature use)
- Cross-feature interactions
- Real-world scenarios

### 3. Integration Tests

**Purpose**: Test API endpoints and backend logic  
**Duration**: 5-15 minutes  
**Frequency**: On every commit, before deployments

**What They Test**:

- API request/response correctness
- Authentication/authorization
- Data validation
- Error handling

---

## Test Infrastructure

### Tools Used

1. **Playwright** - E2E testing for web version
   - Location: `tests/*.spec.ts`
   - Config: `playwright.config.ts`
   - Run: `npm run test:smoke`

2. **Jest** - Unit and integration tests
   - Location: `server/src/__tests__/`
   - Config: `server/jest.config.js`
   - Run: `npm run test:server`

3. **API Tests** - Direct HTTP requests
   - Location: `tests/api/`
   - Run: `npm run test:api`

---

## Critical Test Flows

### Priority 1: Critical Paths (Must Pass)

1. **Authentication Flow**
   - Sign up → Email verification → Login → Logout
   - Password reset flow
   - OAuth (Google/Apple) login

2. **Onboarding Flow**
   - Fan onboarding (minimal steps)
   - Coach onboarding (full flow with payment)

3. **Core Features**
   - Post creation and viewing
   - Game discovery and RSVP
   - Team creation (coach only)

4. **Payment Flow**
   - Subscription checkout
   - Ad reservation payment
   - Webhook processing

### Priority 2: Important Features

5. **Social Features**
   - Following/unfollowing
   - Messaging
   - Notifications

6. **Content Management**
   - Media uploads
   - Event creation
   - Team management

### Priority 3: Edge Cases

7. **Error Handling**
   - Network failures
   - Invalid inputs
   - Permission denials
   - Rate limiting

---

## Running Tests

### Quick Smoke Test

```bash
npm run test:smoke
```

### Full E2E Suite

```bash
npm run test:smoke:ui  # Interactive mode
npm run test:smoke:headed  # With browser visible
```

### API Integration Tests

```bash
npm run test:api
```

### Backend Unit Tests

```bash
npm run test:server
```

### All Tests

```bash
npm run test:server && npm run test:smoke
```

---

## Test Environment Setup

### Prerequisites

1. Backend server running on `http://localhost:4000`
2. Frontend web app running on `http://localhost:8081`
3. Database accessible (test database recommended)
4. Environment variables configured

### Test Data

- Use dedicated test accounts
- Clean up test data after runs
- Use factories for consistent test data

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Pull requests
- Pushes to main branch
- Scheduled nightly runs

### Test Reports

- HTML reports: `playwright-report/`
- JSON results: `test-results/smoke-results.json`
- JUnit XML: `test-results/smoke-results.xml`

---

## Maintenance

### Regular Updates

- Update tests when features change
- Add tests for new features
- Remove obsolete tests
- Keep test data fresh

### Test Coverage Goals

- Critical paths: 100%
- Important features: 80%
- Edge cases: 60%

---

## Troubleshooting

### Common Issues

**Tests fail on CI but pass locally**

- Check environment variables
- Verify database state
- Check network timeouts

**Playwright can't find elements**

- Verify selectors are correct
- Check if app structure changed
- Add wait conditions

**API tests fail**

- Verify backend is running
- Check authentication tokens
- Verify test data exists

---

## Next Steps

1. ✅ Basic smoke tests implemented
2. ✅ E2E auth flow test
3. ⏳ Expand E2E coverage
4. ⏳ Add API integration tests
5. ⏳ Add mobile-specific tests (Detox/Maestro)
