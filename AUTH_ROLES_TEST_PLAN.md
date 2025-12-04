# 🔐 Authentication, Roles & Coach Features - Test Plan

**Status:** Ready for Phase 2 Comprehensive Testing  
**Date:** December 3, 2025  
**Scope:** Auth pipeline, role-based access, coach-only features, organization flows  
**Owner:** QA Team + Backend Team  

---

## 📋 Test Overview

This document provides detailed test procedures for:
1. **Authentication & Role Detection** - Full auth pipeline with role persistence
2. **Coach-Only Access Controls** - Guards and deep link bypasses
3. **Organization & Team Management** - Creation, editing, member management
4. **Events & Posts** - Game creation with role validation
5. **Role-Based Navigation** - Account switching between fan/coach

**Total Time Estimate:** 4-5 hours  
**Prerequisite:** Phase 1 complete (production secrets configured)

---

## 🔑 Part 1: Accounts & Roles

### Test 1.1: Register → Email Verification → Login (Fan Account)

**Objective:** Verify complete registration flow for fan users

**Setup:** 
- App in fresh state or logged out
- Network access available

**Test Steps:**
1. Tap "Sign Up"
2. Enter email: `fan-test-001@varsityhub.test`
3. Enter password: `SecureTest123!`
4. Tap "Register"
5. **EXPECT:** 
   - User created in database
   - Email verification email sent
   - Page redirects to "Verify Email"
   - `pendingVerificationEmail` state active
   
6. Check email inbox for verification code
7. Copy code from email
8. Return to app, enter verification code
9. Tap "Verify"
10. **EXPECT:**
    - `email_verified` = true in database
    - User automatically logged in
    - Redirects to onboarding/step-1-role
    - `pendingVerificationEmail` cleared

11. On step-1-role, select "Fan"
12. Complete onboarding quickly (skip photos, skip payment)
13. **EXPECT:**
    - `preferences.role` = "fan"
    - `preferences.onboarding_completed` = true
    - Navigates to main tab screen (/(tabs))

**Success Criteria:**
- ✅ Registration succeeds without duplicate
- ✅ Email verification code works and expires after 30 min
- ✅ Role "fan" persists across login
- ✅ No redirect loops or stuck states

**Reference Code:**
- `server/src/routes/auth.ts` line 48 (register endpoint)
- `context/AuthProvider.tsx` line 166 (pendingVerificationEmail routing)
- `QA_CHECKLIST.md` line 11-15 (Sign-In/Sign-Up section)

---

### Test 1.2: Register → Email Verification → Login (Coach Account)

**Objective:** Verify role selection persists for coach accounts

**Setup:**
- Same as Test 1.1

**Test Steps:**
1-10. Repeat Test 1.1 steps with email: `coach-test-001@varsityhub.test`

11. On step-1-role, select "Coach"
12. Complete onboarding:
    - Step 2: Upload photo (can skip)
    - Step 3: Select "Rookie" plan (free)
    - Tap "Continue"
13. **EXPECT:**
    - `preferences.role` = "coach"
    - `preferences.onboarding_completed` = true
    - No payment dialog (Rookie is free)
    - Navigates to /(tabs)

14. Go to Settings → Scroll to "Manage Teams"
15. **EXPECT:**
    - "Manage Teams" option visible
    - Tap opens manage-teams screen
    - Team list loads (may be empty initially)

**Success Criteria:**
- ✅ Coach role persists after login
- ✅ Coach-only screens accessible (Manage Teams)
- ✅ Rookie plan checkout skipped

**Reference Code:**
- `server/src/routes/auth.ts` line 65 (role assignment)
- `context/AuthProvider.tsx` line 207 (role metadata exposure)
- `app/manage-teams.tsx` line 69-81 (coach guard)

---

### Test 1.3: Role Detection & Metadata After Login

**Objective:** Verify `useAuth()` exposes correct role for downstream screens

**Setup:**
- Coach account created and verified (Test 1.2)
- Logged in at main tabs

**Test Steps:**
1. Open DevTools (or add logging)
2. Check `AuthContext` value:
   ```javascript
   // Expected for coach:
   {
     user: { id, email, preferences: { role: 'coach', onboarding_completed: true } },
     isAdmin: false,
     pendingVerificationEmail: null,
     loading: false
   }
   ```

3. Navigate to Discover tab
4. Open Settings (bottom right icon)
5. Scroll down to "Account Type" display
6. **EXPECT:** Shows "Coach"

7. Go to app/profile.tsx (check your profile)
8. **EXPECT:** Profile page shows role badge or account type indicator

**Success Criteria:**
- ✅ `user.preferences.role` correctly set to 'coach'
- ✅ Role metadata available to all screens via `useAuth()`
- ✅ Profile page displays role correctly

**Reference Code:**
- `context/AuthProvider.tsx` line 207 (role state exposure)
- `app/profile.tsx` line 489 (org/role display)

---

### Test 1.4: Password Reset Flow

**Objective:** Verify password reset doesn't lose role or account state

**Setup:**
- Coach account from Test 1.2
- Logged in

**Test Steps:**
1. Log out
2. On sign-in screen, tap "Forgot Password?"
3. Enter email: `coach-test-001@varsityhub.test`
4. Tap "Send Reset Link"
5. **EXPECT:** Email sent with reset code

6. Check email, copy reset code
7. Return to app (may auto-detect), enter code and new password
8. Tap "Reset Password"
9. **EXPECT:**
    - Password hash updated in database
    - Old password no longer works
    - Can log in with new password

10. Log in with new password
11. **EXPECT:**
    - Same coach account
    - Role still "coach"
    - Teams still accessible
    - `preferences.role` unchanged

**Success Criteria:**
- ✅ Password reset succeeds
- ✅ Role and preferences preserved
- ✅ Old password rejected after reset

**Reference Code:**
- `api/auth.ts` line 78+ (password reset)
- `server/src/routes/auth.ts` (reset handler)
- `QA_CHECKLIST.md` line 15-20 (Password reset section)

---

### Test 1.5: OAuth Attachment to Email Account

**Objective:** Verify OAuth (Google/Apple) can attach to existing email account

**Setup:**
- Fan account created and verified
- Logged in

**Test Steps:**
1. Go to Settings → Linked Accounts
2. Tap "Link Google" (or Apple)
3. Complete OAuth flow in browser/Apple dialog
4. **EXPECT:** OAuth account linked to existing email

5. Log out
6. On sign-in, tap "Sign In with Google"
7. Use same Google account
8. **EXPECT:**
    - Logs in as same fan account
    - Email matches
    - Role still "fan"
    - No duplicate account created

**Success Criteria:**
- ✅ OAuth can attach to email account
- ✅ No duplicate account created
- ✅ Role and preferences preserved

**Reference Code:**
- `api/auth.ts` (OAuth handlers)
- `server/src/routes/auth.ts` (OAuth attachment)

---

### Test 1.6: Role Switching (Fan → Coach)

**Objective:** Verify user can switch from fan to coach role

**Setup:**
- Fan account (Test 1.1)
- Logged in at main tabs

**Test Steps:**
1. Go to Settings → Account Settings
2. Look for "Change Role" or "Become Coach" option
3. Tap option to switch to coach
4. **EXPECT:** May show onboarding dialog or upgrade flow

5. Complete coach setup if required
6. Return to main screen
7. Check account type (should show "Coach")
8. Go to Manage Teams
9. **EXPECT:** 
    - Team list loads
    - Can create teams
    - No "restricted" error

10. Log out and back in
11. **EXPECT:**
    - Still shows as coach
    - Manage Teams still accessible

**Success Criteria:**
- ✅ Role switch persists
- ✅ Coach features unlock after role change
- ✅ No duplicate accounts created

**Reference Code:**
- `context/AuthProvider.tsx` (role update)
- `QA_CHECKLIST.md` line 35-45 (Onboarding Flow - Coach)

---

### Test 1.7: Rate Limiting & Email Throttling

**Objective:** Verify email verification codes respect rate limits

**Setup:**
- Fan account created but not verified
- Multiple test accounts ready

**Test Steps:**
1. Request verification email (initial registration)
2. **EXPECT:** Email received within 30 sec

3. Immediately request resend (don't wait)
4. **EXPECT:** Either:
   - Throttled with message "Wait 30 seconds before requesting again"
   - OR sent successfully (if no throttling)

5. Wait 30 seconds
6. Request resend again
7. **EXPECT:** New email received

8. Try to verify with old code
9. **EXPECT:** "Code expired" or "Invalid code"

10. Use new code
11. **EXPECT:** Verification succeeds

**Success Criteria:**
- ✅ Rate limit enforced (1/30s, 5/hour)
- ✅ Old codes become invalid
- ✅ Clear error messages for throttling

**Reference Code:**
- `server/src/routes/auth.ts` (rate limiting logic)
- `EMAIL_SMS_REGRESSION_CHECKLIST.md` (rate limit tests)

---

## 👮 Part 2: Coach-Only Surfaces

### Test 2.1: Manage Teams Guard & Non-Coach Redirect

**Objective:** Verify non-coach users cannot access manage-teams

**Setup:**
- Fan account (Test 1.1)
- Logged in

**Test Steps:**
1. Open DevTools or add console logging
2. Manually navigate to `/manage-teams` via deep link
3. **EXPECT:**
   - Alert appears: "Restricted: Only coach accounts can access Manage Teams."
   - Redirects to /(tabs) (main screen)
   - Console shows: `[telemetry] manage-teams: non-coach blocked`

4. Try accessing via Settings (if option appears)
5. **EXPECT:** No "Manage Teams" option visible for fans

6. Switch to coach account (Test 1.2)
7. Navigate to `/manage-teams`
8. **EXPECT:**
   - Page loads successfully
   - Team list visible (may be empty)
   - Create button available

**Success Criteria:**
- ✅ Non-coaches blocked with clear message
- ✅ Deep link bypass prevented
- ✅ Coaches can access without restriction

**Reference Code:**
- `app/manage-teams.tsx` line 69-81 (coach guard implementation)

---

### Test 2.2: Deep Link Access Control (Discover → Manage Teams)

**Objective:** Verify deep links from Discover page respect role guards

**Setup:**
- Two accounts: fan and coach
- Both logged in separately

**Test Steps (Fan Account):**
1. Open app as fan
2. Open Discover tab
3. Tap on a team card (if team visible)
4. **EXPECT:** Team details page shows
5. Look for "Manage This Team" button or link
6. **EXPECT:** Button hidden or disabled for fans

7. Try manual deep link: `app://manage-teams`
8. **EXPECT:** Alert and redirect to /(tabs)

**Test Steps (Coach Account):**
1. Open app as coach
2. Open Discover tab
3. Tap on a team owned by coach
4. **EXPECT:** Team details page shows with edit/manage options
5. Tap "Manage This Team" or similar
6. **EXPECT:** Navigates to manage-teams screen for that team

**Success Criteria:**
- ✅ Fans cannot access manage from Discover
- ✅ Deep links blocked for non-coaches
- ✅ Coaches can navigate freely

**Reference Code:**
- `app/(tabs)/discover/mobile-community.tsx` line 552 (deep links)
- `app/manage-teams.tsx` line 69 (guard)

---

### Test 2.3: Deep Link Access (Settings → Manage Teams)

**Objective:** Verify Settings link guards role properly

**Setup:**
- Fan and coach accounts

**Test Steps (Fan):**
1. Open Settings
2. Scroll to "Manage Teams" or "Coach Settings"
3. **EXPECT:** Hidden or grayed out

4. Try manual deep link: `app://settings/manage-teams`
5. **EXPECT:** Guard redirects to /(tabs)

**Test Steps (Coach):**
1. Open Settings
2. Scroll to "Manage Teams"
3. **EXPECT:** Visible and tappable
4. Tap "Manage Teams"
5. **EXPECT:** Navigates to manage-teams screen successfully

**Success Criteria:**
- ✅ Settings link hidden for fans
- ✅ Deep link attempt blocked for fans
- ✅ Coaches see and can access link

**Reference Code:**
- `app/settings/index.tsx` line 390 (Settings links)
- `app/manage-teams.tsx` line 69 (guard)

---

### Test 2.4: Quick Add Game (Home/Away & Non-Competitive)

**Objective:** Verify game creation payload builder handles role correctly

**Setup:**
- Coach account created and verified (Test 1.2)
- At least one team created (Test 3.1)

**Test Steps (Create Home Game):**
1. Open Manage Teams
2. Select a team
3. Tap "Quick Add Game" or "+" button
4. Fill in:
   - Date: Today or tomorrow
   - Time: 3:00 PM
   - Location: "Test Field"
   - Type: "Home"
   - Opponent: Search for another team (or "Test Opponent")
5. Tap "Create"
6. **EXPECT:**
   - Game appears in team's schedule
   - Game details show:
     - Team ID correct
     - Opponent ID resolved
     - Organization metadata present (if org assigned)
   - Event appears on calendar

7. Navigate to game details
8. **EXPECT:**
   - Date/time/location correct
   - Team and opponent names shown
   - Can create post against this game

**Test Steps (Away Game):**
1. Repeat above with Type: "Away"
2. **EXPECT:** Game type reflects "Away"

**Test Steps (Non-Competitive):**
1. Create game with type "Practice" or "Non-Competitive"
2. **EXPECT:**
   - Game created successfully
   - Opponent field optional/hidden if not applicable
   - Opponent validation skipped

**Success Criteria:**
- ✅ Home/Away games created with correct metadata
- ✅ Opponent/Team IDs resolve properly
- ✅ Organization carried through
- ✅ Non-competitive games created without opponent

**Reference Code:**
- `app/manage-teams.tsx` line 124-200 (Quick Add Game & payload builder)

---

### Test 2.5: Team API Returns Correct Structure

**Objective:** Verify TeamApi.managed() returns organization block

**Setup:**
- Coach account with team(s) in organization
- Backend logging enabled

**Test Steps:**
1. Open manage-teams screen
2. Open browser DevTools (Network tab)
3. Look for API call: `GET /api/teams?filter=managed`
4. **EXPECT:** Response includes:
   ```json
   {
     "id": "team-123",
     "name": "Team Name",
     "organization": {
       "id": "org-456",
       "name": "Organization Name",
       "status": "active"
     },
     "status": "active",
     "members": [...]
   }
   ```

5. If team has NO organization:
   ```json
   {
     "id": "team-123",
     "organization": null
   }
   ```

**Success Criteria:**
- ✅ Organization block always present (null if not assigned)
- ✅ API structure matches mobile expectations
- ✅ No "undefined" fields

**Reference Code:**
- `app/manage-teams.tsx` line 42 (TeamApi.managed() call)
- Backend TeamApi schema

---

## 🏢 Part 3: Organization Pages

### Test 3.1: Coach Onboarding - Step 4 (Organization)

**Objective:** Verify organization creation/selection during coach onboarding

**Setup:**
- New coach account, at onboarding step 4
- Step 1-3 complete

**Test Steps (Create New Organization):**
1. On step 4, see "Select or Create Organization"
2. Tap "Create New Organization"
3. Enter name: "Test Academy"
4. Tap "Create"
5. **EXPECT:**
   - Organization created in database
   - Assigned to coach account
   - Coach becomes "owner" of organization
   - Modal closes

6. See organization selected
7. Tap "Continue" to complete onboarding
8. **EXPECT:**
   - Onboarding completes
   - Organization persists in `user.organization_id`

**Test Steps (Duplicate Detection):**
1. Start new coach account at step 4
2. Try to create organization: "Test Academy" (same name as above)
3. **EXPECT:**
   - Error modal appears (line 349): "Organization name already in use"
   - Can choose different name or select existing

4. Enter "Test Academy 2"
5. Tap "Create"
6. **EXPECT:** Creates successfully

**Test Steps (Select Existing Organization):**
1. Start another coach account at step 4
2. Tap "Select Existing Organization"
3. See list of organizations (includes "Test Academy")
4. Tap "Test Academy"
5. **EXPECT:**
   - Organization selected
   - Coach joins as member
   - Status may be "pending" until approved

6. Continue onboarding
7. **EXPECT:** Coach assigned to organization

**Test Steps ("How It Works" Explanation):**
1. On step 4, look for "?" icon or "How it works" link (line 383)
2. Tap "How it works"
3. **EXPECT:** Modal appears explaining:
   - What organizations are
   - How coaches organize teams
   - Approval process if joining existing

4. Close modal
5. Continue with organization selection

**Success Criteria:**
- ✅ New organizations created with duplicate detection
- ✅ Coaches can join existing organizations
- ✅ "How it works" explanation displays
- ✅ Organization persists after onboarding

**Reference Code:**
- `app/onboarding/step-4-organization.tsx` line 78-607
- Line 349 (duplicate detection modal)
- Line 383 ("How it works" explanation)

---

### Test 3.2: Join Organization - Fan Requests → Admin Approves

**Objective:** Verify complete organization join flow with approval

**Setup:**
- Fan account (Test 1.1)
- Coach account with organization (Test 3.1)
- Both logged in separately

**Test Steps (Fan Requests):**
1. Open fan account
2. Navigate to Discover tab
3. Find "Organizations" or "Browse Teams" section
4. Find organization: "Test Academy"
5. Tap "Request to Join"
6. **EXPECT:**
   - Toast: "Request sent"
   - Button changes to "Pending..."
   - Request stored in database

**Test Steps (Admin Reviews):**
1. Switch to coach/admin account
2. Open Manage Teams or Organization Settings
3. Find "Join Requests" or "Approvals" section
4. See pending request from fan
5. **EXPECT:**
   - Fan's email/name shown
   - "Approve" and "Decline" buttons visible

6. Tap "Approve"
7. **EXPECT:**
   - Request status changes to "approved"
   - Notification sent to fan
   - Fan can now see organization's teams

8. (Optional) Try "Decline" on another request
9. **EXPECT:** Request marked as rejected

**Test Steps (Fan Sees New Access):**
1. Return to fan account
2. Refresh or reopen Discover
3. **EXPECT:** Organization's teams now visible

4. Tap on a team from "Test Academy"
5. **EXPECT:** Can view team details, post against events

**Success Criteria:**
- ✅ Fans can request to join
- ✅ Coaches/admins can approve/decline
- ✅ Approved fans get access to team/org content
- ✅ Notifications sent to both parties

**Reference Code:**
- `app/request-join-organization.tsx` line 27 (join request submission)
- `app/organization-join-requests.tsx` line 26 (admin approval screen)
- `app/league.tsx` line 201-261 (organization view aggregating teams)

---

### Test 3.3: Organization on User Profile

**Objective:** Verify organization links appear on profile

**Setup:**
- Coach account with organization assigned
- Logged in

**Test Steps:**
1. Open Profile tab
2. View own profile
3. **EXPECT:** Organization name displayed
   - Location: Around line 489 in `app/profile.tsx`
   - Format: "Organization: Test Academy" or similar

4. Tap on organization name (if clickable)
5. **EXPECT:** Navigates to organization details page

6. View organization details
7. **EXPECT:**
   - Organization name
   - Teams in organization
   - Member count
   - Coaches listed

8. Go back to profile
9. Verify organization shows correctly

**Success Criteria:**
- ✅ Organization displayed on profile
- ✅ Organization link navigable
- ✅ Organization details accessible

**Reference Code:**
- `app/profile.tsx` line 489 (organization display)

---

### Test 3.4: Team Edit - Organization Changes Persist

**Objective:** Verify team edits propagate organization changes

**Setup:**
- Coach account with team in organization
- Logged in at Manage Teams

**Test Steps:**
1. Select a team to edit
2. Tap "Edit Team" button
3. On edit form, look for "Organization" dropdown (line 159-364)
4. Change organization to different one (or "Unassigned")
5. Tap "Save"
6. **EXPECT:**
   - Changes saved to database
   - Team moved to new organization
   - No errors

7. Navigate away and back to Manage Teams
8. **EXPECT:** Team shows under new organization

9. Check team details (via API or profile)
10. **EXPECT:**
    - `team.organization_id` updated
    - Organization metadata reflects change

**Success Criteria:**
- ✅ Organization field editable on team form
- ✅ Changes persist across app restarts
- ✅ Team appears in correct organization after edit

**Reference Code:**
- `app/edit-team.tsx` line 159-364 (team edit form with org field)

---

## 🎮 Part 4: Events & Posts

### Test 4.1: CreatePost Event Attachment Logic

**Objective:** Verify posting from game page auto-fills event

**Setup:**
- Coach account with team and created game (Test 2.4)
- Logged in

**Test Steps (Post from Game):**
1. Navigate to game details page
2. Tap "Create Post" or "+" button
3. **EXPECT:** Create post screen opens with:
   - `selectedGameId` pre-filled (from game param)
   - Game name shown in header or post preview
   - Location pre-filled from game location

4. Add caption: "Great game!"
5. (Optional) Add photo
6. Tap "Post"
7. **EXPECT:**
   - Post created successfully
   - Post shows game tag/link
   - Appears on team feed with game association

**Test Steps (Post with Event Suggestion):**
1. Open create post normally (not from game)
2. Use device location (Test 4.2 setup)
3. **EXPECT:** System suggests nearby events
   - Based on location from `useDeviceLocation` hook
   - Shows event name, team, distance

4. Tap suggested event
5. **EXPECT:**
   - Event auto-filled in post
   - Post preview updates with event info

6. Post successfully
7. **EXPECT:** Post linked to event

**Success Criteria:**
- ✅ Event auto-filled when posted from game page
- ✅ Event suggestions work when permission granted
- ✅ Event-post association persists

**Reference Code:**
- `app/create-post.tsx` line 57-200 (event attachment logic)
- `hooks/useDeviceLocation.ts` line 1-172 (location hook with caching)

---

### Test 4.2: Device Location & Permission Handling

**Objective:** Verify location permissions gracefully degrade

**Setup:**
- App running on simulator or device
- Coach account logged in

**Test Steps (Permission Granted):**
1. Open create post
2. **EXPECT:** Device location requested
3. Grant location permission (iOS: "While Using App")
4. **EXPECT:**
   - Location captured in `useDeviceLocation` hook
   - Event suggestions appear (if events near location)
   - Banner shows location captured
   - Caching: 10-minute cache active (line 1-172)

5. Wait 5 minutes
6. Create another post
7. **EXPECT:** Uses cached location (no new permission request)

**Test Steps (Permission Denied):**
1. Revoke location permission in phone settings
2. Open create post again
3. **EXPECT:**
   - Permission request shown once
   - User denies
   - No error banner
   - Event suggestions unavailable (graceful)
   - Warning banner: "Unable to suggest nearby events"
   - Can still create post without location

4. Post successfully
5. **EXPECT:** Post created without location data

**Test Steps (Location Permission Timeout):**
1. Set up mock location that times out
2. Create post
3. **EXPECT:**
   - 30-second wait (fallback strategy)
   - Timeout message shown
   - Can continue to post
   - No location data attached

**Success Criteria:**
- ✅ Permission request handled gracefully
- ✅ Non-blocking (can post without location)
- ✅ 10-minute cache reduces repeat requests
- ✅ 30-minute fallback prevents hang
- ✅ Clear messaging for denied/unavailable states

**Reference Code:**
- `hooks/useDeviceLocation.ts` line 1-172 (full hook implementation)
- `app/create-post.tsx` line 57-200 (permission handling in UI)

---

### Test 4.3: Create Event → Create Highlight Post → View on Team

**Objective:** End-to-end flow from event to post visibility

**Setup:**
- Coach account with team
- Team has events/games created

**Test Steps:**
1. **Create Event:** Open Manage Teams → Select Team → Quick Add Game
   - Fill in: name, date/time, location, type
   - Save
   - **EXPECT:** Game appears in team's calendar

2. **Create Highlight Post:**
   - Navigate to game details
   - Tap "Create Post" or "Create Highlight"
   - Add caption: "Game highlight!"
   - Add photo (optional)
   - Tag event/game (auto-filled or select)
   - Post
   - **EXPECT:** Post created with game tag

3. **View on Team:**
   - Go to Team details page
   - Scroll to "Recent Posts" or "Activity"
   - **EXPECT:**
     - Highlight post visible
     - Shows game tag/link
     - Shows coach's name
     - Shows timestamp

4. **View in Feed:**
   - Open Discover tab
   - Scroll to team's feed or event cards
   - **EXPECT:**
     - Event card shows
     - Associated posts visible
     - Photo/video from post shows
     - Engagement metrics (likes) visible

**Success Criteria:**
- ✅ Event created with full metadata
- ✅ Post links to event
- ✅ Post appears on team page
- ✅ Post appears in discovery feed
- ✅ Engagement features work

**Reference Code:**
- `app/manage-teams.tsx` line 124-200 (Quick Add)
- `app/game-details/GameDetailsScreen.tsx` line 1736 (game details + post creation)
- `app/create-post.tsx` line 57-200 (post creation with event)
- `app/(tabs)/discover/mobile-community.tsx` (feed display)

---

## ✅ Part 5: QA Execution & Sign-Off

### Test Matrix: Section Coverage

Run through each section of `QA_CHECKLIST.md` and log results:

| Section | Line | Test Cases | Status |
|---------|------|-----------|--------|
| Authentication & Onboarding | 11-45 | Sign-in, sign-up, password reset, OAuth | ▢ PASS ▢ FAIL |
| Coach Onboarding | 20-35 | Role selection, payment plans, role persistence | ▢ PASS ▢ FAIL |
| Fan Onboarding | 37-42 | Role selection, profile, no payment | ▢ PASS ▢ FAIL |
| Payments & Subscriptions | 49-65 | Stripe, plans, invoices | ▢ PASS ▢ FAIL |
| Team Management | 63-90 | Create, edit, delete, members | ▢ PASS ▢ FAIL |
| Games & Events | 94-120 | Create, edit, approve, quick add | ▢ PASS ▢ FAIL |
| Posts & Media | 119-160 | Create, attach events, engagement | ▢ PASS ▢ FAIL |
| Settings & Profile | 194-220 | Account type, org display, preferences | ▢ PASS ▢ FAIL |

### Test Execution Procedure

**For Each Section:**

1. **Read Section:** Review all test cases (2 min)
2. **Execute Tests:** Run through each step (varies by section)
3. **Log Results:** Mark PASS/FAIL for each test case
4. **Document Issues:** If FAIL, note:
   - Expected behavior
   - Actual behavior
   - Steps to reproduce
   - Error message (if any)
5. **Sign-Off:** QA lead initials when complete

### Documentation Template

Create file: `VERIFICATION_RESULTS_[DATE].md` in project root

```markdown
# Verification Results - [DATE]

**Tester:** [Name]  
**Date:** [Date]  
**Platform:** iOS/Android  
**Build:** [Build #]

## Authentication & Onboarding

### Test 1.1: Register → Email Verification → Login (Fan)
- [x] Registration succeeds
- [x] Email sent within 30 sec
- [x] Code verification works
- [x] Redirects to onboarding
- [x] Role persists
**Result:** ✅ PASS

### Test 1.2: Register → Email Verification → Login (Coach)
- [x] Registration succeeds
- [x] Coach role selectable
- [x] Rookie plan skips payment
- [x] Role persists
**Result:** ✅ PASS

### [Continue for each test...]

## Issues Found

1. **Issue:** [Description]
   - **Steps:** [How to reproduce]
   - **Expected:** [What should happen]
   - **Actual:** [What happened]
   - **Priority:** Critical/High/Medium/Low

## Sign-Off

- [x] QA Lead: [Name] - [Date]
- [ ] Engineering Lead: [Name] - [Date]
- [ ] Product Owner: [Name] - [Date]

```

### Regression Testing

**When to Re-Run Full Auth Tests:**
- After any auth code changes
- After role/permission logic changes
- After database schema changes to `users` or `user_preferences`
- Before every production deployment

**Quick Sanity Check (15 min):**
- Test 1.1: Fan register → verify → login
- Test 1.2: Coach register → verify → login
- Test 2.1: Non-coach blocked from manage-teams
- Test 4.3: Create event → post → view

---

## 🚀 Integration with CI/CD

### Automated Checks

When code changes are pushed:

1. **verify-production-ready.sh** runs (15 min)
   - TypeScript compilation
   - ESLint checks
   - Health endpoint validation

2. **CI workflow** (GitHub Actions) runs
   - Test script stub (20 min)
   - Can be replaced with Jest tests

3. **Manual Auth Tests** (before launch only)
   - Full matrix execution (4-5 hours)
   - Required for production sign-off

### Test Data Setup

To facilitate repeated testing, create test accounts in database:

```bash
# Seed test accounts (run once)
node scripts/seed-test-accounts.js

# Creates:
- fan-test-001@varsityhub.test / password: Test123!
- fan-test-002@varsityhub.test / password: Test123!
- coach-test-001@varsityhub.test / password: Test123!
- coach-test-002@varsityhub.test / password: Test123!
```

(Create this script if not exists)

---

## 📊 Success Metrics

### Phase 2 Testing Success = All Green

| Category | Metric | Target |
|----------|--------|--------|
| Auth Pipeline | Register → Verify → Login works for both roles | 2/2 roles ✅ |
| Role Persistence | Role survives across login/logout cycles | 100% |
| Coach Guards | Non-coaches blocked from manage-teams, deep links blocked | 100% |
| Organization Flow | Create, join, approve flows work end-to-end | 3/3 flows ✅ |
| Event-Post Link | Events auto-fill posts, appear in feeds | 100% |
| Location Services | Permission handling graceful, caching works | 100% |
| QA Coverage | All 8 checklist sections signed off | 8/8 sections ✅ |
| Regression | No auth-related issues after code changes | 0 blockers |

---

## 📚 Reference Files

| Document | Purpose | Owner |
|----------|---------|-------|
| `server/src/routes/auth.ts` | Backend auth endpoints | Backend |
| `api/auth.ts` | Frontend auth API wrapper | Frontend |
| `context/AuthProvider.tsx` | Auth context & routing logic | Frontend |
| `app/manage-teams.tsx` | Coach guards & team management | Frontend |
| `app/create-post.tsx` | Post creation with event binding | Frontend |
| `hooks/useDeviceLocation.ts` | Location permissions & caching | Frontend |
| `QA_CHECKLIST.md` | Acceptance criteria by feature | QA |
| `CRITICAL_FLOWS_TEST.md` | 6 critical user flows | QA |

---

## ⏱️ Time Estimate

- **Total Execution Time:** 4-5 hours
- **Authentication Tests:** 1 hour
- **Coach/Organization Tests:** 1.5 hours
- **Event/Post Tests:** 1 hour
- **QA Checklist Full Run:** 1-1.5 hours
- **Issue Documentation:** As needed

---

## 📝 Next Steps

1. **Phase 1 Complete?** → Proceed to Part 1 (Accounts & Roles)
2. **Test as You Go:** Don't wait to finish Part 1 before starting Part 2
3. **Document Issues:** Log in a shared issue tracker
4. **Daily Standups:** Report progress and blockers
5. **Final Sign-Off:** Get all 3 leads to sign verification results

---

**Version:** 1.0  
**Last Updated:** December 3, 2025  
**Status:** Ready for Execution

