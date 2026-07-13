# Feed & Messaging E2E Tests

**Date**: December 2024  
**Status**: ✅ **TESTS CREATED**

---

## Overview

Comprehensive E2E tests for the feed page and messaging functionality to ensure everything works correctly in real-world scenarios.

---

## Test Coverage

### Feed Page Tests

1. **Feed page loads and displays content**
   - Verifies feed page loads correctly
   - Checks that content (games, events, posts) is displayed
   - Tests authentication integration

2. **Feed page shows games and events**
   - Creates a test game via API
   - Verifies game appears in feed
   - Tests game display functionality

3. **Feed page supports pull-to-refresh**
   - Tests refresh functionality
   - Verifies new content appears after refresh
   - Tests content updates

4. **Feed page handles empty state**
   - Tests feed with no content
   - Verifies empty state is handled gracefully
   - Ensures page doesn't crash

### Messaging Tests

1. **Messages page loads and displays conversations**
   - Creates two users
   - Sends a message between users
   - Verifies messages page loads and shows conversations

2. **Can send a message**
   - Tests message composition
   - Verifies message sending functionality
   - Checks message appears after sending

3. **Can view message thread**
   - Opens a conversation thread
   - Verifies messages are displayed
   - Tests thread navigation

4. **Can reply to a message**
   - Tests replying to existing messages
   - Verifies replies appear in thread
   - Tests conversation flow

5. **Messages page handles empty state**
   - Tests messages page with no conversations
   - Verifies empty state handling
   - Ensures page doesn't crash

6. **Message blocking prevents messaging**
   - Tests blocking functionality
   - Verifies blocked users cannot message
   - Tests API-level blocking enforcement

### Integration Tests

1. **Can share post to message**
   - Tests sharing a post via message
   - Verifies share functionality
   - Tests integration between feed and messaging

---

## Test Structure

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

---

## Running the Tests

### Run All Feed & Messaging Tests

```bash
npx playwright test tests/e2e/feed-messaging.spec.ts
```

### Run Specific Test Suite

```bash
# Feed tests only
npx playwright test tests/e2e/feed-messaging.spec.ts -g "Feed Page"

# Messaging tests only
npx playwright test tests/e2e/feed-messaging.spec.ts -g "Messaging"
```

### Run with UI Mode

```bash
npx playwright test tests/e2e/feed-messaging.spec.ts --ui
```

### Run in Debug Mode

```bash
npx playwright test tests/e2e/feed-messaging.spec.ts --debug
```

---

## Test Scenarios

### Feed Page Scenarios

1. **User views feed**
   - User logs in
   - Navigates to feed
   - Sees games, events, posts

2. **User refreshes feed**
   - User pulls to refresh
   - New content appears
   - Feed updates correctly

3. **User views empty feed**
   - New user with no content
   - Feed shows empty state
   - No errors occur

### Messaging Scenarios

1. **User sends message**
   - User composes message
   - Sends to another user
   - Message appears in thread

2. **User views conversation**
   - User opens conversation
   - Messages are displayed
   - Thread loads correctly

3. **User replies to message**
   - User opens conversation
   - Types reply
   - Reply appears in thread

4. **User blocks another user**
   - User blocks someone
   - Cannot send message to blocked user
   - API enforces blocking

---

## Expected Behavior

### Feed Page

- ✅ Loads without errors
- ✅ Displays games and events
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
- ✅ Shows real-time updates (polling)

---

## Known Limitations

1. **Pull-to-Refresh**
   - Simplified test (scroll to top)
   - Actual pull-to-refresh requires touch events
   - May need mobile device or touch simulation

2. **Real-time Updates**
   - Tests use polling (3-second interval)
   - May need to wait for updates
   - WebSocket tests would be more accurate

3. **UI Selectors**
   - Uses flexible selectors (text, aria-labels)
   - May need adjustment if UI changes
   - Tests are resilient to minor UI changes

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

### Message Sending Fails

- Check recipient exists
- Verify blocking status
- Check age policy restrictions
- Verify message content format

---

## Future Improvements

1. **WebSocket Testing**
   - Test real-time message updates
   - Test typing indicators
   - Test online/offline status

2. **Media Messages**
   - Test sending images
   - Test sending videos
   - Test file attachments

3. **Group Messages**
   - Test group chat creation
   - Test group message sending
   - Test group management

4. **Feed Interactions**
   - Test upvoting posts
   - Test commenting on posts
   - Test bookmarking posts

---

## Files

- `tests/e2e/feed-messaging.spec.ts` - Test file
- `docs/FEED_MESSAGING_TESTS.md` - This documentation

---

**Status**: ✅ **TESTS READY**  
**Next Steps**: Run tests to verify functionality, adjust selectors if needed
