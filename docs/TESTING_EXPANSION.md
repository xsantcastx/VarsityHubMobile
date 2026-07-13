# Testing Suite Expansion

**Date**: December 2024  
**Status**: ✅ Additional Tests Added

---

## New Tests Added

### 1. Posts API Tests

**File**: `tests/api/posts-api.spec.ts`

**Coverage**:

- ✅ Get posts list
- ✅ Create post with content
- ✅ Create post with media URL
- ✅ Validation (requires content or media)
- ✅ Content length validation
- ✅ Authentication required
- ✅ Email verification required
- ✅ Get specific post
- ✅ Upvote post
- ✅ Add comment to post

**Run**: `npm run test:api`

---

### 2. Teams API Tests

**File**: `tests/api/teams-api.spec.ts`

**Coverage**:

- ✅ Get teams list
- ✅ Create team (coach only)
- ✅ Role validation (fans can't create teams)
- ✅ Required fields validation
- ✅ Get team details
- ✅ Team limits enforcement
- ✅ Authentication required

**Run**: `npm run test:api`

---

### 3. Posts E2E Flow Tests

**File**: `tests/e2e/posts-flow.spec.ts`

**Coverage**:

- ✅ Navigate to create post screen
- ✅ Display posts feed
- ✅ Handle post creation form
- ✅ Show validation errors

**Run**: `npm run test:e2e`

---

## Test Runner Script

**File**: `scripts/run-tests.sh`

**Features**:

- ✅ Checks backend health before running
- ✅ Checks frontend availability
- ✅ Interactive menu for test selection
- ✅ Color-coded output
- ✅ Helpful error messages

**Usage**:

```bash
npm run test:run
# or
bash scripts/run-tests.sh
```

**Options**:

1. Smoke tests (fast)
2. API tests (medium)
3. E2E tests (slow)
4. All tests (comprehensive)
5. Backend unit tests

---

## Updated Commands

### New Commands

```bash
# Interactive test runner
npm run test:run

# Run all API tests (includes new posts and teams tests)
npm run test:api

# Run all E2E tests (includes new posts flow)
npm run test:e2e
```

---

## Test Coverage Summary

### API Tests

- ✅ Health checks
- ✅ Authentication
- ✅ Posts (NEW)
- ✅ Teams (NEW)

### E2E Tests

- ✅ Critical flows (auth, onboarding)
- ✅ Posts flow (NEW)

### Smoke Tests

- ✅ App loading
- ✅ Health checks
- ✅ Basic functionality

---

## Next Recommended Tests

### High Priority

- [ ] Games API tests
- [ ] Events API tests
- [ ] Payments API tests
- [ ] Messaging API tests

### Medium Priority

- [ ] Games E2E flow
- [ ] Teams E2E flow
- [ ] Payment E2E flow
- [ ] Onboarding E2E flow (expand existing)

### Low Priority

- [ ] Notifications tests
- [ ] Admin tests
- [ ] Search tests
- [ ] Profile tests

---

## Running the New Tests

### Posts API Tests

```bash
# Make sure backend is running
cd server && npm run dev

# In another terminal
npm run test:api
# or specifically
npx playwright test tests/api/posts-api.spec.ts
```

### Teams API Tests

```bash
npm run test:api
# or specifically
npx playwright test tests/api/teams-api.spec.ts
```

### Posts E2E Tests

```bash
# Start backend and frontend
cd server && npm run dev  # Terminal 1
npm run web:playwright   # Terminal 2

# Run E2E tests
npm run test:e2e
# or specifically
npx playwright test tests/e2e/posts-flow.spec.ts
```

---

## Test Statistics

**Total Test Files**: 8

- Smoke tests: 2 files
- API tests: 4 files (2 new)
- E2E tests: 3 files (1 new)

**Estimated Coverage**:

- Critical paths: ~70%
- Important features: ~50%
- Edge cases: ~30%

---

## Notes

### Posts Tests

- Tests both content and media posts
- Validates authentication and verification requirements
- Tests interaction features (upvotes, comments)

### Teams Tests

- Tests role-based access (coach vs fan)
- Validates team creation limits
- Tests required field validation

### E2E Posts Flow

- Tests UI interactions
- Validates form behavior
- Checks error handling

---

**Status**: ✅ Ready to use  
**Last Updated**: December 2024
