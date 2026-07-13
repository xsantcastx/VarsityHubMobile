# Quick Profile Pages Test Checklist

## 🚀 Run These Tests Now

### 1. Automated Test Suite (5 minutes)

```bash
npx tsx scripts/test-profile-pages.ts
```

**Expected**: All tests pass (or most pass if server/data not available)

### 2. Manual Visual Test (10 minutes)

#### User Profile

- [ ] Open app → Navigate to Profile tab
- [ ] Verify header banner displays
- [ ] Verify settings icon (top-right)
- [ ] Verify profile picture overlay (circular, overlapping)
- [ ] Verify username and "Edit profile" button
- [ ] Verify @handle, bio, join date, following/followers
- [ ] Tap "Posts" tab → Verify posts display
- [ ] Tap "Replies" tab → Verify replies or empty state
- [ ] Tap "Upvotes" tab → Verify upvotes or empty state
- [ ] Switch to dark mode → Verify all text readable

#### Team Profile

- [ ] Navigate to a team profile
- [ ] Verify header banner displays
- [ ] Verify settings icon (if admin) or hidden (if not admin)
- [ ] Verify "Edit profile" button (if admin) or hidden (if not admin)
- [ ] Verify team logo overlay
- [ ] Verify team details (handle, description, created date, stats)
- [ ] Test all three tabs
- [ ] Switch to dark mode → Verify all text readable

#### Organization Profile

- [ ] Navigate to an organization profile
- [ ] Verify header banner displays
- [ ] Verify settings icon (if admin) or hidden (if not admin)
- [ ] Verify "Edit profile" button (if admin) or hidden (if not admin)
- [ ] Verify org avatar overlay
- [ ] Verify org details (handle, description, created date, stats)
- [ ] Test all three tabs
- [ ] Switch to dark mode → Verify all text readable

### 3. Navigation Test (5 minutes)

- [ ] User profile → Team profile → Organization profile
- [ ] Use back button to navigate back
- [ ] Verify no crashes or errors

### 4. Permission Test (5 minutes)

- [ ] As team admin: Verify settings/edit buttons appear
- [ ] As non-admin: Verify settings/edit buttons hidden
- [ ] As org admin: Verify settings/edit buttons appear
- [ ] As non-admin: Verify settings/edit buttons hidden

---

## ✅ Success Criteria

- ✅ All profile pages match design
- ✅ Tabs work correctly
- ✅ Admin permissions work
- ✅ Dark mode readable
- ✅ Navigation smooth
- ✅ No crashes or errors

---

## 📝 Notes

- Automated tests require server running and user authenticated
- Some manual tests require specific user roles (admin vs non-admin)
- Dark mode testing requires system dark mode enabled
