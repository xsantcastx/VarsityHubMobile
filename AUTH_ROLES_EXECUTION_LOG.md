# 🧪 Auth & Roles Testing - Execution Log

**Date:** December 3, 2025  
**Tester:** [Your Name]  
**Platform:** iOS / Android  
**Build Version:** [Build #]  

---

## 📋 Quick Reference

**Documents to Use:**
- Primary Plan: `AUTH_ROLES_TEST_PLAN.md` (detailed test procedures)
- Acceptance Criteria: `QA_CHECKLIST.md` (lines 11-220)
- Reference Implementation: Code files linked in plan

**Key File Locations:**
- Auth Backend: `server/src/routes/auth.ts`
- Auth Context: `context/AuthProvider.tsx`
- Team Guards: `app/manage-teams.tsx`
- Post Creation: `app/create-post.tsx`
- Location Hook: `hooks/useDeviceLocation.ts`

---

## ✅ Part 1: Accounts & Roles

### Test 1.1: Register → Email Verification → Login (Fan)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Email/password registration succeeds
- [ ] Email verification email arrives within 30 sec
- [ ] Verification code works
- [ ] Redirects to onboarding after verification
- [ ] Fan role selectable on step-1
- [ ] Role persists after login

**Issues Found:** None / List below
```
Issue #1:
- Expected: [description]
- Actual: [what happened]
- Steps: [how to reproduce]
- Priority: Critical/High/Medium/Low
```

**Notes:**
```
[Any additional observations]
```

---

### Test 1.2: Register → Email Verification → Login (Coach)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Email/password registration succeeds
- [ ] Coach role selectable on step-1
- [ ] Step 2 (Profile) works
- [ ] Step 3 (Plan) shows subscription options
- [ ] Rookie plan skips payment
- [ ] Onboarding completes successfully
- [ ] Coach role persists after login
- [ ] Manage Teams accessible in Settings

**Issues Found:** None / List below
```
Issue #1:
```

**Notes:**
```
[Any additional observations]
```

---

### Test 1.3: Role Detection & Metadata After Login

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] `useAuth()` returns correct user object
- [ ] `user.preferences.role` = 'coach' (coach account)
- [ ] `user.preferences.role` = 'fan' (fan account)
- [ ] Profile page displays role correctly
- [ ] Role accessible to all downstream screens

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 1.4: Password Reset Flow

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Forgot password email sent
- [ ] Reset code received in email
- [ ] Password reset succeeds with new password
- [ ] Old password rejected after reset
- [ ] Role preserved after password reset
- [ ] All account data intact after reset

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 1.5: OAuth Attachment to Email Account

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] OAuth (Google/Apple) account linkable
- [ ] No duplicate account created on OAuth attach
- [ ] Can sign in with OAuth to same account
- [ ] Role and preferences preserved

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 1.6: Role Switching (Fan → Coach)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Role switch available in Settings
- [ ] Can change from fan to coach
- [ ] Role persists across logout/login
- [ ] Coach features unlock after switch
- [ ] No duplicate accounts created

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 1.7: Rate Limiting & Email Throttling

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Initial verification email sent within 30 sec
- [ ] Resend throttled (1/30s, 5/hour)
- [ ] Codes expire after 30 minutes
- [ ] Clear error messages for throttling
- [ ] Can verify with new code after expiry

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

**Part 1 Overall Status:** ▢ PASS ▢ FAIL ▢ SOME ISSUES  
**Part 1 Sign-Off:** _________________ Date: _______

---

## 👮 Part 2: Coach-Only Surfaces

### Test 2.1: Manage Teams Guard & Non-Coach Redirect

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Fan gets "Restricted" alert when accessing manage-teams
- [ ] Fan redirected to /(tabs) after alert
- [ ] No "Manage Teams" option in Settings for fans
- [ ] Coach can access manage-teams without errors
- [ ] Team list loads for coach

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 2.2: Deep Link Access Control (Discover → Manage Teams)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Fan Account):**
- [ ] No "Manage" button on team cards in Discover
- [ ] Deep link `app://manage-teams` redirects to /(tabs)
- [ ] No bypass to editing teams

**Results (Coach Account):**
- [ ] "Manage This Team" button visible on own teams
- [ ] Can navigate to team management screen
- [ ] Can edit team details

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 2.3: Deep Link Access (Settings → Manage Teams)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Fan Account):**
- [ ] "Manage Teams" hidden in Settings
- [ ] Deep link blocked with redirect
- [ ] No way to access team management

**Results (Coach Account):**
- [ ] "Manage Teams" visible in Settings
- [ ] Can tap and navigate successfully
- [ ] Team management screen loads

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 2.4: Quick Add Game (Home/Away & Non-Competitive)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Home Game):**
- [ ] Quick Add Game button accessible
- [ ] Date/time/location fields work
- [ ] Type: "Home" selectable
- [ ] Opponent search works
- [ ] Game created with correct metadata
- [ ] Game appears on team calendar

**Results (Away Game):**
- [ ] Type: "Away" selectable
- [ ] Game type reflects "Away"
- [ ] Metadata correct (opponent, team ID)

**Results (Non-Competitive):**
- [ ] Type: "Practice" / "Non-Competitive" selectable
- [ ] Opponent field optional
- [ ] Game created without opponent requirement

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 2.5: Team API Returns Correct Structure

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] API returns organization block (null if unassigned)
- [ ] Organization ID correct
- [ ] Team members array populated
- [ ] Status field correct
- [ ] No undefined fields in response

**Sample Response:**
```json
{
  "id": "______",
  "name": "______",
  "organization": {
    "id": "______",
    "name": "______"
  },
  "status": "active",
  "members": [...]
}
```

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

**Part 2 Overall Status:** ▢ PASS ▢ FAIL ▢ SOME ISSUES  
**Part 2 Sign-Off:** _________________ Date: _______

---

## 🏢 Part 3: Organization Pages

### Test 3.1: Coach Onboarding - Step 4 (Organization)

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Create New):**
- [ ] "Create New Organization" button visible
- [ ] Can enter organization name
- [ ] Duplicate detection works (error on duplicate name)
- [ ] Organization created in database
- [ ] Coach becomes owner
- [ ] Organization persists after onboarding

**Results (Select Existing):**
- [ ] "Select Existing Organization" button visible
- [ ] List of existing organizations shown
- [ ] Can select from list
- [ ] Coach joins as member
- [ ] Status may show "pending"
- [ ] Organization persists after onboarding

**Results ("How It Works"):**
- [ ] "?" or "How it works" link visible
- [ ] Explanation modal appears
- [ ] Text explains org purpose and approval process
- [ ] Can close and continue

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 3.2: Join Organization - Fan Requests → Admin Approves

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Fan Requests):**
- [ ] Fan can find organization in Discover
- [ ] "Request to Join" button visible
- [ ] Request submits successfully
- [ ] Button changes to "Pending..."
- [ ] Toast confirms "Request sent"

**Results (Admin Approves):**
- [ ] Coach/Admin sees "Join Requests" section
- [ ] Pending requests listed with fan info
- [ ] "Approve" button works
- [ ] Request status changes to "approved"
- [ ] Notification sent to fan

**Results (Decline Request):**
- [ ] "Decline" button works
- [ ] Request marked as rejected
- [ ] Notification sent to fan

**Results (Fan Access After Approval):**
- [ ] Fan sees organization in Discover
- [ ] Can view organization's teams
- [ ] Can post against team events
- [ ] Full member access

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 3.3: Organization on User Profile

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Organization name displayed on profile
- [ ] Display format clear (e.g., "Organization: Name")
- [ ] Clickable/tappable to view details
- [ ] Organization details page shows:
  - [ ] Organization name
  - [ ] Teams in org
  - [ ] Member count
  - [ ] Coach list
- [ ] Back navigation works

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 3.4: Team Edit - Organization Changes Persist

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results:**
- [ ] Team edit screen opens
- [ ] Organization dropdown visible
- [ ] Can change to different organization
- [ ] Can set to "Unassigned"
- [ ] Save completes successfully
- [ ] Changes persist after app restart
- [ ] Team appears under new organization

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

**Part 3 Overall Status:** ▢ PASS ▢ FAIL ▢ SOME ISSUES  
**Part 3 Sign-Off:** _________________ Date: _______

---

## 🎮 Part 4: Events & Posts

### Test 4.1: CreatePost Event Attachment Logic

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Post from Game):**
- [ ] Game details page has "Create Post" button
- [ ] Create post screen opens
- [ ] Event auto-filled in post
- [ ] Game name shown in preview
- [ ] Location pre-filled from game
- [ ] Can add caption and photo
- [ ] Post creates successfully
- [ ] Post shows event tag/link in feed

**Results (Nearby Event Suggestion):**
- [ ] Create post screen shows event suggestions
- [ ] Suggestions based on device location
- [ ] Shows event name, team, distance
- [ ] Can select suggested event
- [ ] Event auto-fills in post
- [ ] Post linked correctly to event

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 4.2: Device Location & Permission Handling

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Permission Granted):**
- [ ] Location permission request shown
- [ ] Can grant "While Using App" permission
- [ ] Location captured successfully
- [ ] Event suggestions appear
- [ ] "Location captured" banner shows
- [ ] Caching: 10-minute cache working
- [ ] No repeated permission requests in 10 min

**Results (Permission Denied):**
- [ ] User can deny location permission
- [ ] No error/crash
- [ ] Warning banner shown: "Unable to suggest nearby events"
- [ ] Can still create post without location
- [ ] Post creation succeeds

**Results (Location Timeout):**
- [ ] System waits ~30 seconds for location
- [ ] Timeout message shown (if applicable)
- [ ] Can continue to post
- [ ] Post created without location data

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

### Test 4.3: Create Event → Create Highlight Post → View on Team

**Status:** ▢ PASS ▢ FAIL ▢ BLOCKED  
**Date Executed:** ___________  
**Tester:** ___________

**Results (Create Event):**
- [ ] Quick Add Game button accessible
- [ ] Event created with name, date, time, location
- [ ] Event appears on team calendar
- [ ] Event details page accessible

**Results (Create Highlight Post):**
- [ ] "Create Post" button on game details
- [ ] Post screen opens with event pre-filled
- [ ] Can add caption: "Game highlight!"
- [ ] Can add photo/video
- [ ] Post creates successfully
- [ ] Post tagged with game/event

**Results (View on Team):**
- [ ] Team details page shows "Recent Posts"
- [ ] Highlight post visible in list
- [ ] Shows:
  - [ ] Coach name/profile pic
  - [ ] Timestamp
  - [ ] Photo/video
  - [ ] Caption
  - [ ] Event tag/link
  - [ ] Engagement (likes, comments)

**Results (View in Feed):**
- [ ] Discover tab shows event card
- [ ] Associated posts visible under event
- [ ] Photo/video from post displays
- [ ] Can like/comment on post
- [ ] Can tap to view full post

**Issues Found:** None / List below

**Notes:**
```
[Any additional observations]
```

---

**Part 4 Overall Status:** ▢ PASS ▢ FAIL ▢ SOME ISSUES  
**Part 4 Sign-Off:** _________________ Date: _______

---

## ✅ Part 5: QA Checklist Sections

Run through each section of `QA_CHECKLIST.md` and mark completion:

| Section | Lines | Start Date | End Date | Status | Notes |
|---------|-------|-----------|---------|--------|-------|
| Authentication | 11-47 | _______ | _______ | ▢ PASS | |
| Onboarding Coach | 20-35 | _______ | _______ | ▢ PASS | |
| Onboarding Fan | 37-47 | _______ | _______ | ▢ PASS | |
| Payments | 49-70 | _______ | _______ | ▢ PASS | |
| Team Management | 63-92 | _______ | _______ | ▢ PASS | |
| Games & Events | 94-118 | _______ | _______ | ▢ PASS | |
| Posts & Media | 119-193 | _______ | _______ | ▢ PASS | |
| Settings & Profile | 194-220 | _______ | _______ | ▢ PASS | |

---

## 📊 Issues Summary

**Total Issues Found:** _____  
**Critical:** _____ (blocks launch)  
**High:** _____ (must fix before release)  
**Medium:** _____ (should fix)  
**Low:** _____ (nice to fix)

### Critical Issues

```
Issue #1: [Title]
- Severity: Critical
- Description: [what's broken]
- Steps to reproduce: [how to trigger]
- Expected behavior: [what should happen]
- Actual behavior: [what happens instead]
- Related code: [file and line]
- Fix priority: Must fix before launch
- Status: ▢ Open ▢ In Progress ▢ Fixed ▢ Verified

Issue #2: [Title]
[repeat format]
```

### High Priority Issues

```
Issue #N: [Title]
- Severity: High
- Description: [what's broken]
- Status: ▢ Open ▢ In Progress ▢ Fixed ▢ Verified
```

### Medium / Low Priority Issues

```
Issue #N: [Title]
- Severity: Medium/Low
- Description: [what's broken]
- Status: ▢ Open ▢ In Progress ▢ Fixed ▢ Verified
```

---

## 🎯 Overall Test Results

**Date Completed:** ___________  
**Total Duration:** _____ hours  
**Platforms Tested:** ▢ iOS ▢ Android ▢ Web  
**Build Version:** ___________  

### Summary

- **Part 1 (Accounts & Roles):** ▢ PASS ▢ FAIL
- **Part 2 (Coach Surfaces):** ▢ PASS ▢ FAIL
- **Part 3 (Organizations):** ▢ PASS ▢ FAIL
- **Part 4 (Events & Posts):** ▢ PASS ▢ FAIL
- **Part 5 (QA Checklist):** ▢ PASS ▢ FAIL

**Overall Status:** ▢ READY FOR LAUNCH ▢ ISSUES FOUND ▢ BLOCKED

### Recommended Actions

```
- [ ] All critical issues resolved
- [ ] All high priority issues resolved
- [ ] Medium issues accepted/deferred
- [ ] Regression testing passed
- [ ] Ready for production deployment
```

---

## ✍️ Sign-Offs

**QA Lead:**  
Name: _____________________ Date: _______  
Signature: ___________________  
Status: ▢ APPROVED ▢ APPROVED W/ CAVEATS ▢ REJECTED

**Engineering Lead:**  
Name: _____________________ Date: _______  
Signature: ___________________  
Status: ▢ APPROVED ▢ APPROVED W/ CAVEATS ▢ REJECTED

**Product Owner:**  
Name: _____________________ Date: _______  
Signature: ___________________  
Status: ▢ APPROVED ▢ APPROVED W/ CAVEATS ▢ REJECTED

---

## 📝 Notes for Next Test Run

```
[Any findings that should be remembered for future runs]
[Problematic areas to watch]
[Improvements to test procedures]
[Timing observations]
```

---

**Execution Document Version:** 1.0  
**Last Updated:** December 3, 2025  
**Next Review:** [After testing complete]

