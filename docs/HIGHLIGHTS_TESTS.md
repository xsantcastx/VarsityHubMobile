# Highlights Page E2E Tests

**Date**: December 2024  
**Status**: ✅ **TESTS CREATED**

---

## Overview

Comprehensive E2E tests for the highlights page to ensure everything works correctly in real-world scenarios.

---

## Test Coverage

### Highlights Page Tests

1. **Highlights page loads and displays content**
   - Verifies highlights page loads correctly
   - Checks that highlights are displayed
   - Tests authentication integration

2. **Highlights page shows tabs (Trending, Recent, Top)**
   - Creates multiple highlights
   - Verifies tab navigation works
   - Tests tab switching functionality

3. **Highlights page supports pull-to-refresh**
   - Tests refresh functionality
   - Verifies new highlights appear after refresh
   - Tests content updates

4. **Highlights page handles empty state**
   - Tests highlights with no content
   - Verifies empty state is handled gracefully
   - Ensures page doesn't crash

5. **Highlights page supports search**
   - Creates highlights with specific content
   - Tests search functionality
   - Verifies search results appear

6. **Can view highlight detail**
   - Creates a highlight
   - Navigates to highlight detail
   - Verifies detail page displays correctly

7. **Can interact with highlights (upvote)**
   - Creates a highlight
   - Tests upvote functionality
   - Verifies interaction works

8. **Highlights API returns correct data structure**
   - Tests API endpoint directly
   - Verifies response structure
   - Checks data format

9. **Highlights page shows different content for different tabs**
   - Creates highlights with different engagement
   - Tests tab-specific content
   - Verifies sorting works

10. **Highlights page handles location-based ranking**
    - Sets user location
    - Creates highlights
    - Verifies location-based ranking works

---

## Test Structure

### Helper Functions

- `generateTestData()` - Creates unique test user data
- `createUser()` - Creates user via API
- `loginUser()` - Logs in user via API
- `createHighlight()` - Creates a highlight (post with media) via API
- `upvotePost()` - Upvotes a post via API
- `fetchHighlights()` - Fetches highlights via API

### Test Data

Each test generates unique data:

- Unique email addresses (timestamp + random)
- Unique display names
- Test passwords
- Test highlights with media URLs

---

## Running the Tests

### Run All Highlights Tests

```bash
npx playwright test tests/e2e/highlights.spec.ts
```

### Run with UI Mode

```bash
npx playwright test tests/e2e/highlights.spec.ts --ui
```

### Run in Debug Mode

```bash
npx playwright test tests/e2e/highlights.spec.ts --debug
```

### Run in Headed Mode

```bash
npx playwright test tests/e2e/highlights.spec.ts --headed
```

---

## Test Scenarios

### Highlights Page Scenarios

1. **User views highlights**
   - User logs in
   - Navigates to highlights
   - Sees highlights displayed

2. **User switches tabs**
   - User clicks Trending tab
   - User clicks Recent tab
   - User clicks Top tab
   - Content changes appropriately

3. **User refreshes highlights**
   - User pulls to refresh
   - New highlights appear
   - Highlights update correctly

4. **User searches highlights**
   - User enters search query
   - Search results appear
   - Results are filtered correctly

5. **User views highlight detail**
   - User clicks on highlight
   - Detail page opens
   - Highlight content is displayed

6. **User interacts with highlights**
   - User upvotes a highlight
   - Upvote count updates
   - Interaction is saved

---

## Expected Behavior

### Highlights Page

- ✅ Loads without errors
- ✅ Displays highlights with media
- ✅ Shows tabs (Trending, Recent, Top)
- ✅ Supports pull-to-refresh
- ✅ Handles empty state gracefully
- ✅ Supports search functionality
- ✅ Shows loading states
- ✅ Handles network errors

### Highlights API

- ✅ Returns `nationalTop` array
- ✅ Returns `ranked` array
- ✅ Includes media URLs
- ✅ Includes upvote counts
- ✅ Includes comment counts
- ✅ Includes author information

---

## Known Limitations

1. **Pull-to-Refresh**
   - Simplified test (scroll to top)
   - Actual pull-to-refresh requires touch events
   - May need mobile device or touch simulation

2. **Media URLs**
   - Tests use placeholder images
   - Real media uploads would require file handling
   - Media display depends on CDN/upload service

3. **Location-Based Ranking**
   - Requires user location in preferences
   - Ranking algorithm is server-side
   - May need multiple highlights to see effect

4. **Tab Content Differences**
   - Content differences depend on algorithm
   - May need more highlights to see clear differences
   - Timing affects trending/recent sorting

---

## Troubleshooting

### Tests Fail to Find Elements

- Check if app is running: `npm run web:playwright`
- Verify API is running: `npm run server:dev`
- Check browser console for errors
- Increase timeout if needed

### Authentication Issues

- Verify token is set in localStorage
- Check token format and expiration
- Ensure user is created and verified

### Highlights Not Loading

- Verify highlights exist in database
- Check API endpoint: `GET /highlights`
- Verify authentication token is valid
- Check network tab for failed requests

### Search Not Working

- Verify search input exists
- Check if search is implemented
- Verify search results are displayed

---

## Files

- `tests/e2e/highlights.spec.ts` - Test file
- `docs/HIGHLIGHTS_TESTS.md` - This documentation

---

**Status**: ✅ **TESTS READY**  
**Next Steps**: Run tests to verify functionality, adjust selectors if needed
