# Production Readiness Checklist

**Current Status:** Pre-Production (Staging/Beta Ready)
**Target:** Full Production Launch

## ✅ Completed (Staging Ready)

### Core Infrastructure
- [x] Railway deployment working
- [x] Database connected and migrated
- [x] Apple Sign-In integration
- [x] JWT authentication flow
- [x] SMTP email configured
- [x] Request-in-flight guards on profile screen
- [x] Centralized 401 handling in HTTP client
- [x] Avatar upload using shared HTTP client
- [x] Error state cleared before refetches

### Recent Fixes (Just Completed)
- [x] Consolidated profile fetch logic (removed duplicate calls)
- [x] Deferred organization loading to unblock core profile
- [x] Aligned user-profile error handling with profile screen
- [x] Added token cleanup on 401 responses

---

## 🚧 Required for Production

### 1. Authentication & Error Handling
**Priority: CRITICAL**

- [ ] **Unified 401 flow with user feedback**
  - Add Toast/Alert on token expiration
  - Auto-redirect to sign-in on 401
  - Location: `api/http.ts` needs toast integration

- [ ] **Token refresh mechanism**
  - Implement refresh token flow
  - Handle token expiration gracefully
  - Files: `api/auth.ts`, `api/http.ts`

- [ ] **Consistent error boundaries**
  - Add React Error Boundaries to main screens
  - Graceful fallback UI for crashes
  - Location: Wrap key routes in `app/_layout.tsx`

### 2. Code Architecture & Maintainability
**Priority: HIGH**

- [ ] **Extract profile screen logic into hooks**
  - `useProfileData` - user/me fetching
  - `useProfilePosts` - posts pagination
  - `useProfileInteractions` - interactions pagination
  - `useProfileOrganizations` - org hydration
  - `useProfileTheme` - theme gradient logic
  - Target: Reduce `app/profile.tsx` from 1,100+ lines to <400

- [ ] **Extract user-profile screen logic**
  - Similar hook extraction as profile
  - Target: Reduce `app/user-profile.tsx` from 680+ lines to <300

- [ ] **Centralize business logic**
  - Move org extraction heuristics to `utils/organizations.ts`
  - Move theme gradient logic to `utils/theme.ts`
  - Move post normalization to `utils/posts.ts`

### 3. Data Fetching & Performance
**Priority: HIGH**

- [ ] **Optimize profile data loading**
  - Batch counts endpoint instead of inferring from pages
  - Parallel fetch user + posts (currently sequential)
  - Add stale-while-revalidate pattern

- [ ] **Add loading states for all async operations**
  - Organization loading indicator
  - Team list loading state
  - Post interaction feedback

- [ ] **Implement proper cache invalidation**
  - Clear relevant caches on post creation
  - Invalidate user cache on profile update
  - Add cache keys for different data types

### 4. Testing & Quality Assurance
**Priority: HIGH**

- [ ] **End-to-end testing against Railway**
  - Login flow (Apple, email)
  - Profile loading and tab switching
  - Post creation and deletion
  - Team management
  - Follow/unfollow flows

- [ ] **Race condition testing**
  - Rapid tab switching
  - Multiple simultaneous requests
  - Background/foreground transitions
  - Network interruptions

- [ ] **Edge case handling**
  - Empty states (no posts, no teams, etc.)
  - Rate limit recovery
  - Network timeout recovery
  - Malformed API responses

### 5. Missing Infrastructure
**Priority: MEDIUM**

- [ ] **Configure Cloudinary**
  - Get production credentials
  - Test image/video uploads
  - Set up CDN caching

- [ ] **Configure Twilio (Optional)**
  - SMS verification for phone auth
  - Alternative: Email-only for MVP

- [ ] **Configure Sentry**
  - Error tracking in production
  - Performance monitoring
  - User feedback integration

### 6. User Experience Polish
**Priority: MEDIUM**

- [ ] **Offline support**
  - Show offline banner
  - Queue actions for when online
  - Cache critical data locally

- [ ] **Loading skeleton screens**
  - Replace spinners with skeletons
  - Better perceived performance

- [ ] **Pull-to-refresh everywhere**
  - All list screens
  - Profile screen
  - Feed screen

### 7. Security & Compliance
**Priority: CRITICAL**

- [ ] **Environment variable audit**
  - No secrets in code
  - Railway variables properly set
  - Production vs staging separation

- [ ] **API rate limiting client-side**
  - Throttle rapid requests
  - Show user-friendly rate limit messages
  - Retry with exponential backoff

- [ ] **Data privacy compliance**
  - Privacy policy in app
  - Terms of service acceptance
  - User data export/deletion

---

## 🎯 Next Immediate Actions

### Week 1: Architecture Cleanup
1. Extract profile hooks (`useProfileData`, etc.)
2. Extract user-profile hooks
3. Move business logic to utils
4. Add error boundaries

### Week 2: Testing & Stabilization
1. E2E testing against Railway (all critical flows)
2. Race condition testing (rapid interactions)
3. Edge case testing (empty states, errors)
4. Performance profiling

### Week 3: Infrastructure & Polish
1. Configure Cloudinary/Sentry
2. Add offline support basics
3. Implement loading skeletons
4. Security audit

### Week 4: Beta Testing
1. Limited user testing (10-20 users)
2. Monitor Railway logs for errors
3. Track API performance/rate limits
4. Gather feedback and iterate

---

## 📊 Production Launch Criteria

### Must Have (Blocking)
- [ ] Zero crashes in critical flows (login, profile, feed)
- [ ] Graceful 401 handling with user feedback
- [ ] All monolithic screens refactored (<500 lines)
- [ ] E2E tests passing for all core features
- [ ] Rate limit errors eliminated
- [ ] Error boundaries on all routes

### Should Have (High Priority)
- [ ] Cloudinary configured for uploads
- [ ] Sentry error tracking active
- [ ] Loading skeletons instead of spinners
- [ ] Offline detection and messaging
- [ ] Response time <2s for all API calls

### Nice to Have (Can Launch Without)
- [ ] Twilio SMS verification
- [ ] Advanced caching strategies
- [ ] Prefetching/optimistic updates
- [ ] Full offline mode with sync

---

## 🐛 Known Issues to Address

1. **Profile screen still triggers double loads**
   - Fixed mount duplicate, but useFocusEffect fires on tab switch too
   - Need to track if already loaded in current session

2. **Organization loading blocks render**
   - Moved to separate effect but still synchronous
   - Should be fully async/lazy

3. **No retry mechanism for failed requests**
   - HTTP client needs exponential backoff
   - User should see "Retry" button on failures

4. **Stale cache from 304 responses**
   - HTTP client handles 304 but screens don't refresh properly
   - Need cache invalidation strategy

5. **No feedback for background operations**
   - Avatar upload, post creation, etc.
   - Need optimistic updates + rollback

---

## 📝 Notes

- Current Railway status: ✅ API healthy, ⚠️ Optional services not configured
- App successfully connects to production backend
- Auth flow working with Apple Sign-In
- Main bottleneck: Architecture cleanup needed before scaling
- Estimated time to production ready: **2-4 weeks** with focused effort

**Last Updated:** November 27, 2025
**Next Review:** After Week 1 architecture cleanup
