# Coach Onboarding End-to-End Test Checklist

## Overview

This document outlines the complete test checklist for coach onboarding flow. All 9 steps must work seamlessly from start to finish.

## Pre-Test Setup

- [ ] Fresh user account (or account with `onboarding_completed` not set/undefined/null)
- [ ] Email verified (or verified during flow)
- [ ] Dev environment running (`npm run dev`)
- [ ] Simulator/device ready

## Test Flow: Coach Onboarding (9 Steps)

### Step 1: Role Selection ✅

**Screen:** "Choose Your Role"  
**Actions:**

- [ ] Select "Coach / Organizer" option
- [ ] Verify "Continue" button appears
- [ ] Click "Continue"

**Expected Result:**

- [ ] Role saved to server
- [ ] Navigates to Step 2 (Basic Info)
- [ ] Progress set to 1
- [ ] NO redirect to main app

**Verification:**

- Check logs for: "Coach selected, navigating to step-2"
- Check AuthProvider logs show: `needsOnboarding: true`

---

### Step 2: Basic Information ✅

**Screen:** "Tell Us About Yourself"  
**Actions:**

- [ ] Enter username (3+ chars, lowercase)
- [ ] Select affiliation (School/Independent)
- [ ] Enter date of birth
- [ ] Enter zip code (optional)
- [ ] Click "Continue"

**Expected Result:**

- [ ] Username saved to server
- [ ] Navigates to Step 3 (Plan Selection)
- [ ] Progress set to 2
- [ ] All fields persist if going back

**Verification:**

- Username availability checked
- Form validation works correctly

---

### Step 3: Plan Selection ✅

**Screen:** "Choose Your Plan"  
**Actions:**

- [ ] Select a plan (Rookie/Veteran/Legend)
- [ ] For Veteran: Enter team count if prompted
- [ ] Complete payment flow if applicable
- [ ] Click "Continue"

**Expected Result:**

- [ ] Plan saved to onboarding context
- [ ] Payment processed (if paid plan)
- [ ] Navigates to Step 4 (Organization)
- [ ] Progress set to 3

**Verification:**

- Rookie plan: No payment, immediate navigation
- Paid plans: Stripe checkout opens (if applicable)
- Plan persists in state

---

### Step 4: Organization Setup ✅

**Screen:** "Set Up Your Organization"  
**Actions:**

- [ ] Option A: Create new organization
  - [ ] Enter organization name
  - [ ] Select organization type
  - [ ] Enter location
  - [ ] Click "Continue"
- [ ] Option B: Join existing organization
  - [ ] Click "Search Organizations"
  - [ ] Select organization
  - [ ] Send join request
  - [ ] Click "Continue"

**Expected Result:**

- [ ] Organization created/joined successfully
- [ ] Navigates to Step 6 (Authorized Users)
- [ ] Progress set to 5
- [ ] Organization info saved

**Verification:**

- Email verification required for creating org
- Duplicate org handling works
- Join request flow works

---

### Step 5: Authorized Users (Step 6) ✅

**Screen:** "Add Authorized Users"  
**Actions:**

- [ ] Option A: Add authorized users
  - [ ] Click "Add User"
  - [ ] Enter email/select user
  - [ ] Assign role
  - [ ] Click "Continue"
- [ ] Option B: Skip (if optional)
  - [ ] Click "Skip" or "Continue" with none added

**Expected Result:**

- [ ] Authorized users saved
- [ ] Navigates to Step 7 (Profile)
- [ ] Progress set to 5 (same as before - correct)
- [ ] Can skip if optional

---

### Step 6: Create Profile (Step 7) ✅

**Screen:** "Create Your Profile" (Step 6/9)  
**Actions:**

- [ ] Option A: Upload profile picture
  - [ ] Click "Add Profile Picture"
  - [ ] Select image
  - [ ] Verify upload
- [ ] Enter username (if not pre-filled)
- [ ] Enter bio (optional)
- [ ] Select sports interests (up to 3)
- [ ] Click "Continue"

**Expected Result:**

- [ ] Profile picture uploaded
- [ ] Username saved (validated for availability)
- [ ] Bio saved
- [ ] Sports interests saved
- [ ] Navigates to Step 8 (Interests)
- [ ] Progress set to 6

**Verification:**

- Username validation works
- Image upload doesn't fail
- Sports interests limit enforced (3 max)

---

### Step 7: Interests (Step 8) ✅

**Screen:** "What interests you most?" (Step 7/9)  
**Actions:**

- [ ] Select one or more interests:
  - Find Local Games
  - View Moments
  - Post Reviews and Highlights
  - Support Local Creators
  - Claim My Team
  - Follow Teams/Players
- [ ] Click "Continue"

**Expected Result:**

- [ ] At least one interest selected
- [ ] Interests saved to preferences
- [ ] Navigates to Step 9 (Features)
- [ ] Progress set to 7

**Verification:**

- Cannot continue without selecting at least one
- Selections persist

---

### Step 8: Features (Step 9) ✅

**Screen:** "Configure App Features" (Step 8/9)  
**Actions:**

- [ ] Enable/disable location services
- [ ] Enable/disable push notifications
- [ ] Accept messaging policy
- [ ] Click "Continue"

**Expected Result:**

- [ ] Preferences saved
- [ ] Navigates to Step 10 (Confirmation)
- [ ] Progress set to 8
- [ ] For fans: Completes onboarding and goes to feed (skips confirmation)

**Verification:**

- Location permission requested (if enabled)
- Push notification permission requested (if enabled)

---

### Step 9: Confirmation (Step 10) ✅

**Screen:** "Review and Complete" (Step 9/9)  
**Actions:**

- [ ] Review all completed steps
- [ ] Verify all required fields are complete
- [ ] Click "Complete Onboarding"

**Expected Result:**

- [ ] All data submitted to server
- [ ] `onboarding_completed` set to `true` on server
- [ ] Navigates to main app (/(tabs))
- [ ] User can now access full app features

**Verification:**

- Server confirms `onboarding_completed: true`
- AuthProvider no longer redirects to onboarding
- User profile complete

---

## Edge Cases & Error Handling

### Navigation Backward

- [ ] Can go back from any step
- [ ] Data persists when going back
- [ ] Progress updates correctly
- [ ] No infinite loops

### API Failures

- [ ] Network timeout handled gracefully
- [ ] 502 Bad Gateway retries work
- [ ] Errors display user-friendly messages
- [ ] Can retry failed operations

### State Management

- [ ] Progress persists across app restarts
- [ ] Can resume from saved progress
- [ ] State syncs with server correctly

### Email Verification

- [ ] Verification required for org creation
- [ ] Clear messaging about verification requirement
- [ ] Easy path to verify email

---

## Regression Tests

### AuthProvider Redirect Logic

- [ ] New user (undefined onboarding_completed) → Goes to onboarding ✅
- [ ] User with onboarding_completed: false → Goes to onboarding ✅
- [ ] User with onboarding_completed: true → Goes to main app ✅
- [ ] User on onboarding route with completed: true → Redirects to main app ✅

### Progress Persistence

- [ ] Start onboarding, close app, reopen → Resumes from last step
- [ ] Complete step 3, navigate back, complete again → Works correctly

### Role Persistence

- [ ] Select coach, complete steps → Role persists
- [ ] Server reflects role correctly
- [ ] Can't skip role selection

---

## Performance Checks

- [ ] No excessive API calls
- [ ] Navigation is smooth (no jank)
- [ ] Images load efficiently
- [ ] No memory leaks during flow

---

## Security Audit Results

- [ ] All API calls authenticated
- [ ] No sensitive data logged
- [ ] Input validation on all fields
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention (React Native auto-escapes)

---

## Fixes Applied ✅

1. **Navigation Consistency**: All onboarding steps now use `router.replace()` instead of `router.push()` to prevent back button issues
2. **AuthProvider Logic**: Fixed to treat `undefined/null` onboarding_completed as incomplete (needs onboarding)
3. **Progress Tracking**: Fixed step indices in step-7, step-8, step-9 to match stepRoutes array
4. **Navigation Blocking**: Fixed index.tsx to allow re-navigation when progress changes
5. **Error Handling**: Added comprehensive error logging throughout flow
6. **Username Normalization**: Added consistent username normalization across steps

---

## Known Issues / Notes

- Email verification template needs manual update in SendGrid dashboard (local file is correct)
- Dev verification codes work in simulator for testing
- Notifications endpoint has improved error handling

---

## Success Criteria

✅ All 9 steps complete without errors  
✅ No skipped steps  
✅ All data persists to server  
✅ Can complete flow from start to finish  
✅ AuthProvider correctly manages onboarding state  
✅ Navigation is smooth and consistent

---

## Post-Test Verification

After completing onboarding:

- [ ] Check user.preferences.onboarding_completed === true
- [ ] Check user.preferences.role === 'coach'
- [ ] Check user.username is set
- [ ] Check organization/team associations are correct
- [ ] Verify user can access main app features
- [ ] Verify user can create/manage teams (coach features)

---

**Last Updated:** Now  
**Status:** Ready for testing
