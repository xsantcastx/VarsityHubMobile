# Production Readiness Prompts for AI Code Assistants

This document contains the best prompts you can give to AI code assistants (like Cursor, ChatGPT, Claude, etc.) to ensure your VarsityHub Mobile app is ready for real-world use.

---

## 🚨 Critical: Error Handling & Resilience

### Prompt 1: Comprehensive Error Handling Audit
```
Review all error handling in this codebase. For each file:
1. Identify any empty catch blocks or catch blocks without error parameters
2. Check if network errors are properly handled with retries and user-friendly messages
3. Verify that all async operations have proper error handling
4. Ensure error messages don't expose sensitive information to users
5. Confirm errors are logged to Sentry with proper context
6. Check for unhandled promise rejections
7. Verify ErrorBoundary components are in place for React components

Fix any issues found and provide a summary of changes.
```

### Prompt 2: Network Resilience Check
```
Analyze all network requests in this app. For each API call:
1. Verify retry logic with exponential backoff for transient failures
2. Check timeout handling (should be reasonable, e.g., 30s for normal requests)
3. Ensure proper handling of 502/503/504 errors (infrastructure failures)
4. Verify offline detection and user feedback
5. Check that rate limiting (429) errors are handled gracefully
6. Ensure network errors show user-friendly messages, not technical details
7. Verify that failed requests don't leave UI in broken states

Fix any gaps and add retry logic where missing.
```

### Prompt 3: Edge Case Handling
```
Review this codebase for edge cases that could crash the app:
1. Null/undefined checks for all API responses
2. Empty array/object handling
3. Missing required fields in API responses
4. Invalid data types (e.g., expecting number but getting string)
5. File upload failures (network, size limits, format issues)
6. Permission denials (camera, photo library, location)
7. Deep link handling with invalid/malformed URLs
8. State management edge cases (race conditions, stale data)

Add defensive checks and fallbacks for all identified issues.
```

---

## 🔒 Security & Data Protection

### Prompt 4: Security Audit
```
Perform a security audit of this React Native app:
1. Check for hardcoded API keys or secrets (should be in env vars)
2. Verify sensitive data is not logged to console in production
3. Check for SQL injection risks (if any raw queries exist)
4. Verify input validation on all user inputs (forms, file uploads)
5. Check for XSS vulnerabilities in user-generated content display
6. Verify authentication tokens are stored securely
7. Check for proper permission handling (camera, location, etc.)
8. Verify rate limiting is in place for sensitive endpoints
9. Check that error messages don't leak sensitive information

Fix any security issues found.
```

### Prompt 5: Data Validation
```
Review all data validation in this app:
1. Form inputs: email format, phone numbers, required fields
2. File uploads: size limits, MIME type validation, image dimensions
3. API request payloads: required fields, data types, length limits
4. API response validation: handle unexpected structures gracefully
5. URL validation for deep links and external links
6. Date/time validation and timezone handling
7. Numeric input validation (prevent NaN, Infinity, negative where invalid)

Add validation where missing and improve error messages.
```

---

## ⚡ Performance & Optimization

### Prompt 6: Performance Optimization
```
Analyze this React Native app for performance issues:
1. Check for unnecessary re-renders (use React.memo, useMemo, useCallback)
2. Identify large images that should be optimized or lazy-loaded
3. Check for memory leaks (unsubscribed listeners, uncleaned timers)
4. Verify list virtualization for long lists (FlatList with proper optimization)
5. Check bundle size and identify opportunities for code splitting
6. Verify images are properly cached
7. Check for blocking operations on main thread
8. Identify slow API calls that could be optimized or cached

Provide specific recommendations and implement critical fixes.
```

### Prompt 7: Loading States & UX
```
Review all loading states and user feedback:
1. Verify loading indicators for all async operations
2. Check that buttons are disabled during operations to prevent double-submission
3. Ensure skeleton screens or placeholders for content loading
4. Verify pull-to-refresh works correctly
5. Check that infinite scroll/pagination works smoothly
6. Ensure error states are clear and actionable
7. Verify empty states are helpful and guide users

Improve loading UX where needed.
```

---

## 🧪 Testing & Quality Assurance

### Prompt 8: Test Coverage Analysis
```
Analyze test coverage for this app:
1. Identify critical user flows that lack tests
2. Check for unit tests for utility functions
3. Verify integration tests for API calls
4. Check for E2E tests for core user journeys (login, signup, posting)
5. Identify edge cases that should be tested
6. Check for test data cleanup and isolation

Create tests for the most critical missing coverage areas.
```

### Prompt 9: Real-World Scenario Testing
```
Create test scenarios that simulate real-world usage:
1. Slow network conditions (3G simulation)
2. Intermittent connectivity (connect/disconnect cycles)
3. Large file uploads (near size limits)
4. Rapid user interactions (button mashing, rapid scrolling)
5. App backgrounding/foregrounding during operations
6. Multiple devices/sessions for same user
7. Expired authentication tokens
8. Server errors (500, 502, 503)
9. Invalid API responses (malformed JSON, missing fields)

Add tests or manual test cases for these scenarios.
```

---

## 📱 Mobile-Specific Concerns

### Prompt 10: Mobile Platform Issues
```
Check for mobile-specific issues:
1. Keyboard handling (dismissal, avoiding input overlap)
2. Safe area handling for notched devices
3. Orientation changes (portrait/landscape)
4. Deep linking: handle invalid URLs, missing params gracefully
5. Push notification handling when app is closed/backgrounded
6. App state changes (background/foreground) during operations
7. Permission flows: handle denial gracefully, provide re-request flow
8. File picker: handle cancellation, large files, unsupported formats
9. Image picker: handle camera vs library, permissions, errors

Fix any mobile-specific issues found.
```

### Prompt 11: Offline Functionality
```
Review offline functionality:
1. Verify offline detection and user notification
2. Check that critical data is cached appropriately
3. Ensure failed operations can be retried when back online
4. Verify that cached data doesn't become stale indefinitely
5. Check for queueing of actions when offline (if applicable)
6. Ensure error messages clearly indicate offline status

Improve offline handling where needed.
```

---

## 🎯 User Experience

### Prompt 12: User Experience Audit
```
Review UX for production readiness:
1. Verify all error messages are user-friendly (no technical jargon)
2. Check that loading states don't leave users confused
3. Ensure empty states are helpful and guide next actions
4. Verify that form validation errors are clear and actionable
5. Check that success feedback is provided for user actions
6. Ensure navigation flows are intuitive and don't trap users
7. Verify that destructive actions have confirmation dialogs
8. Check accessibility: screen reader support, color contrast, touch targets

Improve UX issues identified.
```

### Prompt 13: Accessibility Check
```
Audit accessibility in this React Native app:
1. Verify all interactive elements have accessibility labels
2. Check color contrast meets WCAG AA standards
3. Verify touch targets are at least 44x44 points
4. Check that dynamic content changes are announced to screen readers
5. Verify keyboard navigation works (if applicable)
6. Ensure error messages are accessible
7. Check that images have alt text or are marked decorative

Fix accessibility issues found.
```

---

## 📊 Monitoring & Observability

### Prompt 14: Error Monitoring Setup
```
Verify error monitoring is production-ready:
1. Check Sentry is properly initialized with correct DSN
2. Verify error context includes user info (anonymized), device info
3. Check that breadcrumbs are logged for navigation and key actions
4. Verify source maps are uploaded for symbolication
5. Ensure sensitive data is not sent to error tracking
6. Check that error grouping is working (similar errors grouped)
7. Verify error alerts/notifications are configured

Fix any monitoring gaps.
```

### Prompt 15: Analytics & Metrics
```
Review analytics implementation:
1. Verify key user actions are tracked (signup, login, posts, etc.)
2. Check that conversion funnels are tracked
3. Ensure privacy compliance (GDPR, CCPA) for analytics
4. Verify that analytics don't slow down the app
5. Check that critical errors are tracked separately from analytics

Add missing critical event tracking.
```

---

## 🔄 State Management & Data Flow

### Prompt 16: State Management Review
```
Review state management patterns:
1. Check for race conditions in async state updates
2. Verify state is properly reset on logout/navigation
3. Check for memory leaks from uncleaned state
4. Verify optimistic updates are handled correctly (rollback on error)
5. Check for stale data issues (cache invalidation)
6. Ensure state updates don't cause unnecessary re-renders

Fix state management issues found.
```

---

## 🌐 API Integration

### Prompt 17: API Integration Robustness
```
Review all API integrations:
1. Verify proper authentication header handling
2. Check for token refresh logic when tokens expire
3. Verify request/response interceptors handle errors globally
4. Check that API versioning is handled (if applicable)
5. Verify that API changes (new fields, removed fields) are handled gracefully
6. Check for proper request cancellation (abort controllers)
7. Ensure API errors are properly typed and handled

Improve API integration robustness.
```

---

## 📦 Build & Deployment

### Prompt 18: Production Build Verification
```
Verify production build configuration:
1. Check that environment variables are correctly set for production
2. Verify that debug code is removed/disabled in production builds
3. Check that source maps are generated for error tracking
4. Verify that bundle size is optimized
5. Check that API endpoints point to production servers
6. Verify that analytics/tracking is enabled for production
7. Check that error reporting is enabled for production

Fix any build configuration issues.
```

---

## 🎬 Quick Production Readiness Checklist Prompt

### Prompt 19: Complete Production Readiness Audit
```
Perform a comprehensive production readiness audit of this React Native app. Check:

CRITICAL (Must Fix):
- [ ] All syntax errors fixed
- [ ] All network requests have error handling
- [ ] No hardcoded secrets or API keys
- [ ] Error boundaries in place
- [ ] Sentry error tracking configured
- [ ] Authentication token refresh working
- [ ] Offline detection and user feedback

HIGH PRIORITY (Should Fix):
- [ ] Input validation on all forms
- [ ] File upload size/type validation
- [ ] Loading states for all async operations
- [ ] User-friendly error messages
- [ ] Permission handling (camera, location, etc.)
- [ ] Deep link error handling
- [ ] Memory leak prevention

MEDIUM PRIORITY (Nice to Have):
- [ ] Performance optimizations (memoization, lazy loading)
- [ ] Comprehensive test coverage
- [ ] Accessibility improvements
- [ ] Analytics tracking
- [ ] Offline data caching

Provide a prioritized list of issues found and fix the critical ones.
```

---

## 💡 Usage Tips

1. **Run these prompts systematically**: Start with critical items (error handling, security) before moving to optimizations.

2. **Iterate**: After fixing issues from one prompt, run it again to verify fixes.

3. **Combine prompts**: You can combine related prompts (e.g., "Run prompts 1, 2, and 3 together").

4. **Focus on user impact**: Prioritize fixes that affect user experience or app stability.

5. **Test after fixes**: Always test the app after AI makes changes to ensure nothing broke.

---

## 🎯 Recommended Order for Production Launch

1. **Prompt 19** (Complete Audit) - Get overview
2. **Prompt 1** (Error Handling) - Fix crashes
3. **Prompt 4** (Security) - Fix vulnerabilities  
4. **Prompt 2** (Network Resilience) - Improve reliability
5. **Prompt 3** (Edge Cases) - Prevent edge case crashes
6. **Prompt 10** (Mobile Issues) - Fix platform-specific bugs
7. **Prompt 12** (UX Audit) - Improve user experience
8. **Prompt 6** (Performance) - Optimize before launch
9. **Prompt 18** (Build Verification) - Final check before deploy

---

## 📝 Notes

- These prompts are designed to work with AI code assistants like Cursor, GitHub Copilot, ChatGPT, Claude, etc.
- Adjust prompts based on your specific app requirements
- Some prompts may take longer to process - be patient
- Always review AI-generated code before committing
- Test thoroughly after each set of changes
