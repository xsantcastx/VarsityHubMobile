# Test Fixtures Reference

## Overview
Test fixtures provide mock data for frontend and integration tests, allowing you to stub API responses without hitting the real backend.

## Location
```
server/tests/fixtures/
├── organizations.json      # 7 CT organizations with metadata
└── api_responses.json      # Mock API responses for org endpoints
```

## Usage Examples

### Frontend Tests (Jest + React Testing Library)

```typescript
import organizations from '@/server/tests/fixtures/organizations.json';
import apiResponses from '@/server/tests/fixtures/api_responses.json';

// Mock organization list
jest.mock('@/api/http', () => ({
  httpGet: jest.fn((url) => {
    if (url.includes('/organizations')) {
      return Promise.resolve(organizations.organizations);
    }
  }),
}));

// Mock autocomplete success
jest.mock('@/api/geocoding', () => ({
  autocompleteLocations: jest.fn(() => 
    Promise.resolve(apiResponses.autocomplete.success.suggestions)
  ),
}));

// Mock duplicate check
jest.mock('@/api/http', () => ({
  httpPost: jest.fn((url, body) => {
    if (url.includes('/check-duplicate')) {
      if (body.place_id === 'ChIJWesthillPlace123') {
        return Promise.resolve(apiResponses.check_duplicate.exists_by_place_id);
      }
      return Promise.resolve(apiResponses.check_duplicate.no_duplicate);
    }
  }),
}));
```

### Playwright Tests

```typescript
await page.route('**/organizations?*', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(organizations.organizations)
  });
});

await page.route('**/geocoding/autocomplete*', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(apiResponses.autocomplete.success)
  });
});

await page.route('**/organizations/check-duplicate', (route) => {
  const body = route.request().postDataJSON();
  if (body.place_id === 'ChIJWesthillPlace123') {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiResponses.check_duplicate.exists_by_place_id)
    });
  } else {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiResponses.check_duplicate.no_duplicate)
    });
  }
});
```

## Fixture Data

### Organizations (`organizations.json`)
7 Connecticut organizations for testing:
- **Westhill High School** (Stamford, 06902) - Featured org
- **Greenwich High School** (Greenwich, 06830)
- **Stamford Youth Soccer Club** (Stamford, 06901)
- **Darien High School** (Darien, 06820)
- **New Canaan Baseball League** (New Canaan, 06840)
- **Fairfield College Preparatory School** (Fairfield, 06824)
- **Norwalk Youth Hockey Association** (Norwalk, 06850)

Each includes:
- `id`, `name`, `description`
- `sport`, `org_type` (school/club/league)
- `location`, `formatted_address`, `place_id`, `zip_code`
- `_count` (teams, memberships)

### API Responses (`api_responses.json`)

#### Autocomplete Responses
- `autocomplete.success`: 3 Stamford-area suggestions
- `autocomplete.empty`: No results
- `autocomplete.error`: Quota exceeded

#### Check Duplicate Responses
- `check_duplicate.exists_by_place_id`: Westhill duplicate
- `check_duplicate.exists_by_name_zip`: Greenwich duplicate
- `check_duplicate.no_duplicate`: Unique org

#### Create Organization Responses
- `create_organization.success`: New org created
- `create_organization.duplicate_error`: 409 conflict
- `create_organization.unauthorized`: Email verification required

## Maintenance

When adding new organizations:
1. Update `seed.ts` with real data
2. Mirror in `organizations.json` for tests
3. Add corresponding API responses in `api_responses.json`

When adding new endpoints:
1. Create fixture in `api_responses.json`
2. Document usage in this guide
3. Update relevant test files

## Related Files
- `server/prisma/seed.ts` - Real seed data for local dev
- `tests/step-4-organization.spec.ts` - Playwright E2E tests
- `server/tests/organizations.test.ts` - Backend unit tests
- `server/tests/middleware.test.ts` - Middleware unit tests
