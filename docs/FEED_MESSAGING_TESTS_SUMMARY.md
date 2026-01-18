# Feed & Messaging E2E Tests - Summary

**Date**: December 2024  
**Status**: ✅ **TESTS CREATED & READY**

---

## What Was Created

Comprehensive E2E tests for the **feed page** and **messaging** functionality to ensure everything works correctly in real-world scenarios.

---

## Test Coverage

### Feed Page Tests (4 tests)

1. ✅ **Feed page loads and displays content**
   - Creates user and post via API
   - Navigates to feed page
   - Verifies content is displayed

2. ✅ **Feed page shows games and events**
   - Creates a test game via API
   - Verifies game appears in feed
   - Tests game display functionality

3. ✅ **Feed page supports pull-to-refresh**
   - Tests refresh functionality
   - Creates new content after initial load
   - Verifies content updates

4. ✅ **Feed page handles empty state**
   - Tests feed with no content
   - Verifies empty state handling
   - Ensures page doesn't crash

### Messaging Tests (6 tests)

1. ✅ **Messages page loads and displays conversations**
   - Creates two users
   - Sends message between users
   - Verifies messages page loads

2. ✅ **Can send a message**
   - Tests message composition UI
   - Verifies message sending
   - Checks message appears after sending

3. ✅ **Can view message thread**
   - Opens conversation thread
   - Verifies messages are displayed
   - Tests thread navigation

4. ✅ **Can reply to a message**
   - Tests replying to existing messages
   - Verifies replies appear in thread
   - Tests conversation flow

5. ✅ **Messages page handles empty state**
   - Tests messages page with no conversations
   - Verifies empty state handling
   - Ensures page doesn't crash

6. ✅ **Message blocking prevents messaging**
   - Tests blocking functionality via API
   - Verifies blocked users cannot message
   - Tests API-level blocking enforcement

### Integration Tests (1 test)

1. ✅ **Can share post to message**
   - Tests sharing a post via message
   - Verifies share functionality
   - Tests integration between feed and messaging

---

## Test Features

### Helper Functions

- `generateTestData()` - Creates unique test user data
- `createUser()` - Creates user via API
- `loginUser()` - Logs in user via API  
- `createPost()` - Creates a post via API
- `createGame()` - Creates a game/event via API
- `sendMessage()` - Sends a message via API

### Test Data

Each test generates unique data:
- Unique email addresses (timestamp + random)
- Unique display names
- Test passwords

### Resilient Selectors

Tests use flexible selectors that work even if UI changes:
- Text-based selectors with regex
- Aria-label selectors
- Multiple fallback options
- Graceful handling of missing elements

---

## Running the Tests

### Run All Feed & Messaging Tests
```bash
npm run test:e2e
# or specifically:
npx playwright test tests/e2e/feed-messaging.spec.ts
```

### Run Specific Test Suite
```bash
# Feed tests only
npx playwright test tests/e2e/feed-messaging.spec.ts -g "Feed Page"

# Messaging tests only
npx playwright test tests/e2e/feed-messaging.spec.ts -g "Messaging"
```

### Run with UI Mode (Recommended for debugging)
```bash
npx playwright test tests/e2e/feed-messaging.spec.ts --ui
```

### Run in Debug Mode
```bash
npx playwright test tests/e2e/feed-messaging.spec.ts --debug
```

### Run in Headed Mode (See browser)
```bash
npx playwright test tests/e2e/feed-messaging.spec.ts --headed
```

---

## Prerequisites

Before running tests:

1. **Start the server**:
   ```bash
   npm run server:dev
   ```

2. **Start the web app** (in another terminal):
   ```bash
   npm run web:playwright
   ```

3. **Or use the test runner** (starts both automatically):
   ```bash
   npm run test:run
   ```

---

## Test Scenarios Covered

### Feed Page

✅ User views feed with content  
✅ User sees games and events in feed  
✅ User refreshes feed to see new content  
✅ User sees empty state when no content  

### Messaging

✅ User views messages/conversations list  
✅ User sends a new message  
✅ User views a message thread  
✅ User replies to a message  
✅ User sees empty state when no messages  
✅ User cannot message blocked users  

### Integration

✅ User shares a post via message  

---

## Expected Behavior

### Feed Page

- ✅ Loads without errors
- ✅ Displays games, events, and posts
- ✅ Supports pull-to-refresh
- ✅ Handles empty state gracefully
- ✅ Shows loading states
- ✅ Handles network errors

### Messaging

- ✅ Loads conversations list
- ✅ Allows sending messages
- ✅ Displays message threads
- ✅ Supports replies
- ✅ Enforces blocking
- ✅ Handles empty state
- ✅ Shows real-time updates (3-second polling)

---

## Known Limitations

1. **Pull-to-Refresh**
   - Simplified test (scroll to top)
   - Actual pull-to-refresh requires touch events
   - May need mobile device or touch simulation for full test

2. **Real-time Updates**
   - Tests account for 3-second polling interval
   - May need to wait for updates
   - WebSocket tests would be more accurate (future improvement)

3. **UI Selectors**
   - Uses flexible selectors (text, aria-labels)
   - May need adjustment if UI changes significantly
   - Tests are resilient to minor UI changes

4. **Age Policy**
   - Tests don't cover under-18 messaging restrictions
   - Would need to set DOB in preferences
   - Can be added as future test

---

## Troubleshooting

### Tests Fail to Find Elements

**Solution**:
- Check if app is running: `npm run web:playwright`
- Verify API is running: `npm run server:dev`
- Check browser console for errors
- Increase timeout if needed: `await expect(...).toBeVisible({ timeout: 15000 })`

### Authentication Issues

**Solution**:
- Verify token is set in localStorage
- Check token format and expiration
- Ensure user is created and verified
- Check API health: `curl http://localhost:4000/health`

### Message Sending Fails

**Solution**:
- Check recipient exists
- Verify blocking status
- Check age policy restrictions (under-18 must follow recipient)
- Verify message content format
- Check API response for error details

### Feed Not Loading

**Solution**:
- Verify posts/games exist in database
- Check API endpoints: `GET /posts`, `GET /games`
- Verify authentication token is valid
- Check network tab for failed requests

---

## Files Created

1. `tests/e2e/feed-messaging.spec.ts` - Main test file (612 lines)
2. `docs/FEED_MESSAGING_TESTS.md` - Detailed documentation
3. `docs/FEED_MESSAGING_TESTS_SUMMARY.md` - This summary

---

## Next Steps

1. **Run the tests** to verify they work:
   ```bash
   npm run test:e2e
   ```

2. **Review test results** and fix any issues

3. **Add more test scenarios** if needed:
   - Media messages (images, videos)
   - Group messages
   - Feed interactions (upvote, comment, bookmark)
   - Real-time updates with WebSocket

4. **Integrate into CI/CD**:
   - Add to GitHub Actions
   - Run on every PR
   - Block merges if tests fail

---

## Test Statistics

- **Total Tests**: 11
- **Feed Tests**: 4
- **Messaging Tests**: 6
- **Integration Tests**: 1
- **Helper Functions**: 6
- **Lines of Code**: ~612

---

**Status**: ✅ **TESTS READY TO RUN**  
**Next Steps**: Run tests to verify functionality, adjust selectors if needed, add to CI/CD
