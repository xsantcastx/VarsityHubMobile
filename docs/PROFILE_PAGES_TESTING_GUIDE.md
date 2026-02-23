# Profile Pages Real-World Testing Guide

This guide provides comprehensive testing scenarios for the User, Team, and Organization profile pages to ensure they work correctly in real-world use cases.

## 🎯 Overview

All profile pages (User, Team, Organization) now follow a consistent design pattern:
- **Header Banner** with gradient/background image
- **Settings Icon** (top-right, admin-only for teams/orgs)
- **Profile Picture Overlay** (circular, overlapping banner)
- **Name/Title** displayed prominently
- **Edit Profile Button** (for own profile or admin)
- **Bio/Description** in details section
- **Join/Created Date** with calendar icon
- **Stats** (Following/Followers or Members/Games) as inline text
- **Tabs**: Posts, Replies, Upvotes

---

## 🧪 Automated Test Suite

Run the automated test suite to verify API endpoints and data structures:

```bash
npx tsx scripts/test-profile-pages.ts
```

This script tests:
- Server health
- User profile data loading
- Posts/Replies/Upvotes tabs
- Team profile data and permissions
- Organization profile data and permissions
- Navigation between profiles
- Dark mode compatibility
- Empty states handling
- Tab switching
- Profile picture loading
- Bio text rendering
- Following/Followers counts

---

## 📱 Manual Testing Scenarios

### Scenario 1: User Profile - Complete Flow

**Objective**: Verify user profile displays correctly with all tabs and data

**Steps**:
1. **Sign in** to the app
2. **Navigate to Profile** (tap profile icon in bottom nav)
3. **Verify Header**:
   - [ ] Header banner displays (gradient or background image)
   - [ ] Settings icon visible in top-right
   - [ ] Profile picture overlay (circular, overlapping banner)
   - [ ] Username displayed prominently
   - [ ] "Edit profile" button visible
4. **Verify Details Section**:
   - [ ] @handle displayed
   - [ ] Bio text displayed (if exists)
   - [ ] Calendar icon + "Joined [Month Year]" displayed
   - [ ] "X Following Y Followers" inline text displayed
5. **Verify Tabs**:
   - [ ] Three tabs: "Posts", "Replies", "Upvotes"
   - [ ] Active tab highlighted (blue underline)
   - [ ] Tab text color changes on selection
6. **Test Posts Tab**:
   - [ ] Tap "Posts" tab
   - [ ] Posts grid/list displays
   - [ ] Empty state shows "No posts yet" if no posts
   - [ ] Posts load correctly
7. **Test Replies Tab**:
   - [ ] Tap "Replies" tab
   - [ ] Replies display (or empty state)
   - [ ] Empty state shows "No replies yet" if no replies
8. **Test Upvotes Tab**:
   - [ ] Tap "Upvotes" tab
   - [ ] Upvoted posts display (or empty state)
   - [ ] Empty state shows "No upvotes yet" if no upvotes
9. **Test Dark Mode**:
   - [ ] Switch to dark mode
   - [ ] All text is readable (white/light colors)
   - [ ] Header banner still visible
   - [ ] Profile picture border visible
   - [ ] Tabs are readable

**Expected Results**:
- ✅ All elements display correctly
- ✅ Tabs switch smoothly
- ✅ Data loads without errors
- ✅ Dark mode is fully readable
- ✅ Empty states display appropriately

---

### Scenario 2: Team Profile - Admin vs Non-Admin

**Objective**: Verify team profile shows correct UI based on user permissions

**Steps**:
1. **As Team Admin/Owner**:
   - [ ] Navigate to a team you own/manage
   - [ ] Verify Settings icon appears in top-right
   - [ ] Verify "Edit profile" button appears
   - [ ] Tap Settings icon → Should navigate to settings
   - [ ] Tap "Edit profile" → Should navigate to team edit page
2. **As Regular User**:
   - [ ] Navigate to a team you don't manage
   - [ ] Verify Settings icon does NOT appear
   - [ ] Verify "Edit profile" button does NOT appear
   - [ ] Profile displays read-only
3. **Verify Team Details**:
   - [ ] Team name displayed prominently
   - [ ] @handle displayed
   - [ ] Team description displayed (if exists)
   - [ ] Calendar icon + "Created [Month Year]" displayed
   - [ ] "X Members Y Games" inline text displayed
4. **Verify Tabs**:
   - [ ] Three tabs: "Posts", "Replies", "Upvotes"
   - [ ] Posts tab shows team-related posts
   - [ ] Replies/Upvotes tabs show empty states (or data if implemented)

**Expected Results**:
- ✅ Admin features only visible to admins
- ✅ Non-admins see read-only profile
- ✅ All data displays correctly
- ✅ Permissions work as expected

---

### Scenario 3: Organization Profile - Admin vs Non-Admin

**Objective**: Verify organization profile shows correct UI based on user permissions

**Steps**:
1. **As Organization Admin/Owner**:
   - [ ] Navigate to an organization you manage
   - [ ] Verify Settings icon appears in top-right
   - [ ] Verify "Edit profile" button appears
   - [ ] Tap Settings icon → Should navigate to settings
   - [ ] Tap "Edit profile" → Should navigate to org edit page
2. **As Regular User**:
   - [ ] Navigate to an organization you don't manage
   - [ ] Verify Settings icon does NOT appear
   - [ ] Verify "Edit profile" button does NOT appear
   - [ ] Profile displays read-only
3. **Verify Organization Details**:
   - [ ] Organization name displayed prominently
   - [ ] @handle displayed
   - [ ] Organization description displayed (if exists)
   - [ ] Calendar icon + "Created [Month Year]" displayed
   - [ ] "X Teams Y Games" inline text displayed
4. **Verify Tabs**:
   - [ ] Three tabs: "Posts", "Replies", "Upvotes"
   - [ ] Posts tab shows org-related posts
   - [ ] Replies/Upvotes tabs show empty states (or data if implemented)

**Expected Results**:
- ✅ Admin features only visible to admins
- ✅ Non-admins see read-only profile
- ✅ All data displays correctly
- ✅ Permissions work as expected

---

### Scenario 4: Navigation Between Profiles

**Objective**: Verify navigation between different profile types works smoothly

**Steps**:
1. **User → Team**:
   - [ ] From user profile, find a team link/mention
   - [ ] Tap to navigate to team profile
   - [ ] Team profile loads correctly
   - [ ] Back button works
2. **Team → Organization**:
   - [ ] From team profile, find organization link
   - [ ] Tap to navigate to organization profile
   - [ ] Organization profile loads correctly
   - [ ] Back button works
3. **Organization → Team**:
   - [ ] From organization profile, find a team
   - [ ] Tap to navigate to team profile
   - [ ] Team profile loads correctly
   - [ ] Back button works
4. **Deep Linking**:
   - [ ] Test deep link to user profile: `/profile`
   - [ ] Test deep link to team: `/team-page?id=...`
   - [ ] Test deep link to org: `/organization?id=...`
   - [ ] All deep links work correctly

**Expected Results**:
- ✅ Navigation is smooth
- ✅ No crashes or errors
- ✅ Back button works correctly
- ✅ Deep links work

---

### Scenario 5: Edge Cases and Error Handling

**Objective**: Verify app handles edge cases gracefully

**Steps**:
1. **Missing Data**:
   - [ ] Profile with no avatar → Placeholder displays
   - [ ] Profile with no bio → Bio section hidden
   - [ ] Profile with no posts → Empty state displays
   - [ ] Profile with no join date → Date section hidden
2. **Network Errors**:
   - [ ] Turn off network
   - [ ] Navigate to profile
   - [ ] Error message displays
   - [ ] Retry button works
3. **Slow Network**:
   - [ ] Throttle network (DevTools)
   - [ ] Navigate to profile
   - [ ] Loading indicator displays
   - [ ] Data loads eventually
4. **Large Data Sets**:
   - [ ] Profile with 100+ posts
   - [ ] Scroll through posts
   - [ ] Pagination works
   - [ ] No performance issues
5. **Special Characters**:
   - [ ] Profile with special characters in name/bio
   - [ ] All characters display correctly
   - [ ] No layout breaks

**Expected Results**:
- ✅ All edge cases handled gracefully
- ✅ Error messages are clear
- ✅ Loading states work
- ✅ Performance is acceptable

---

### Scenario 6: Dark Mode Compatibility

**Objective**: Verify all profile pages are readable in dark mode

**Steps**:
1. **Switch to Dark Mode**:
   - [ ] Enable dark mode in system settings
   - [ ] Navigate to user profile
   - [ ] Verify all text is readable (white/light colors)
   - [ ] Verify header banner is visible
   - [ ] Verify profile picture border is visible
2. **Check Each Element**:
   - [ ] Header text (username/name) is white
   - [ ] @handle is readable
   - [ ] Bio text is readable
   - [ ] Meta text (dates, counts) is readable
   - [ ] Tab text is readable
   - [ ] Empty state text is readable
3. **Test All Profile Types**:
   - [ ] User profile in dark mode
   - [ ] Team profile in dark mode
   - [ ] Organization profile in dark mode
   - [ ] All are readable

**Expected Results**:
- ✅ All text is readable in dark mode
- ✅ No hardcoded dark colors
- ✅ Contrast is sufficient
- ✅ All profile types work

---

## 🔍 Code Verification Checklist

### User Profile (`app/profile.tsx`)
- [ ] Tabs: "Posts", "Replies", "Upvotes" (not "Interactions")
- [ ] Join date with calendar icon
- [ ] Following/Followers as inline text
- [ ] Bio in header overlay area
- [ ] Header text colors are white for dark mode
- [ ] Settings icon in top-right
- [ ] Profile picture overlay positioned correctly

### Team Profile (`app/team-page.tsx`)
- [ ] Header banner with gradient
- [ ] Settings icon (admin-only)
- [ ] Profile picture overlay (team logo)
- [ ] "Edit profile" button (admin-only)
- [ ] Created date with calendar icon
- [ ] Members/Games count as inline text
- [ ] Tabs: "Posts", "Replies", "Upvotes"

### Organization Profile (`app/organization.tsx`)
- [ ] Header banner with gradient
- [ ] Settings icon (admin-only)
- [ ] Profile picture overlay (org avatar)
- [ ] "Edit profile" button (admin-only)
- [ ] Created date with calendar icon
- [ ] Teams/Games count as inline text
- [ ] Tabs: "Posts", "Replies", "Upvotes"

---

## 🚀 Quick Test Commands

```bash
# Run automated test suite
npx tsx scripts/test-profile-pages.ts

# Check for linting errors
npx expo lint app/profile.tsx app/team-page.tsx app/organization.tsx

# Type check
npm run typecheck

# Start development server
npx expo start
```

---

## 📊 Success Criteria

All tests should pass:
- ✅ Automated test suite: 100% pass rate
- ✅ Manual testing: All scenarios pass
- ✅ No linting errors
- ✅ No TypeScript errors
- ✅ Dark mode fully readable
- ✅ All navigation works
- ✅ Permissions work correctly
- ✅ Edge cases handled gracefully

---

## 🐛 Common Issues and Fixes

### Issue: Settings icon not appearing for admin
**Fix**: Check `isTeamAdmin` or `isOrgAdmin` state is set correctly based on membership check

### Issue: Tabs not switching
**Fix**: Verify `activeTab` state is updated correctly in `onPress` handlers

### Issue: Dark mode text not readable
**Fix**: Ensure all text colors use `theme.text` or `theme.mutedText`, not hardcoded colors

### Issue: Profile picture not displaying
**Fix**: Check `avatar_url` or `logo_url` is valid and image component handles errors

### Issue: Join date not showing
**Fix**: Verify `created_at` field exists in user/team/org data and date parsing works

---

## 📝 Notes

- All profile pages now follow the same design pattern
- Admin features are conditionally rendered based on permissions
- Dark mode support is built-in via theme colors
- Empty states are handled gracefully
- Navigation between profiles works smoothly
