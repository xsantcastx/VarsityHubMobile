# VarsityHub Manual QA Testing Checklist

**Use this checklist on a real device** (iPhone XR or older, mid-range Android). Test with slow/unreliable network and Airplane mode mid-flow.

---

## Test Accounts to Create First

| Account Type | How to Create | Notes |
|--------------|---------------|-------|
| Fresh fan (no onboarding) | Sign up, close app before completing onboarding | Use unique email |
| Completed fan | Sign up, finish full fan onboarding | |
| Coach with team | Sign up as coach, create/join a team | |
| Coach without team | Sign up as coach, skip team creation | |
| Admin | Requires backend flag or admin invite | |

---

## Edge Case Questions (Run on Every Screen)

Before or after each flow, verify:

- [ ] **No internet:** Turn on Airplane mode. What happens? Crash, blank screen, or graceful error?
- [ ] **Double tap:** Tap submit/post buttons twice fast. Duplicate submissions?
- [ ] **Blank required field:** Leave required fields empty and submit. Error shown?
- [ ] **Back mid-flow:** Press back or swipe back mid-action. Data lost? State corrupted?
- [ ] **5‑minute idle:** Leave screen open 5 minutes, come back. Session expired? UI frozen?

---

## 1. Sign Up Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Open app (logged out) | Redirects to Sign In |
| 1.2 | Tap "Create an account" / "Sign up" | Sign Up screen loads |
| 1.3 | Enter display name (optional), email, password (min 8 chars) | Fields accept input, no validation error |
| 1.4 | Tap "Create Account" | Loading state, then redirect to verify or feed |
| 1.5 | Enter invalid email (e.g. "test") | Error: "Please enter a valid email address" |
| 1.6 | Enter short password (6 chars) | Error: "Password must be at least 8 characters" |
| 1.7 | Leave email blank, tap Create | Error: "Enter your email address" |
| 1.8 | Tap "Continue with Google" | Google OAuth flow or account picker |
| 1.9 | Tap "Continue with Apple" (iOS only) | Apple Sign In sheet |
| 1.10 | Submit with existing email | Error: "This email is already registered" |
| 1.11 | **Edge:** Double tap "Create Account" | Only one registration attempt |
| 1.12 | **Edge:** Turn Airplane mode on, then submit | Network error, no crash |

---

## 2. Sign In Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Enter valid email + password | Signs in, redirects to feed or onboarding |
| 2.2 | Enter wrong password | Error: "Invalid email or password" |
| 2.3 | Enter non-existent email | Error: "Invalid email or password" |
| 2.4 | Leave password blank | Error: "Password must be at least 6 characters" |
| 2.5 | Tap "Forgot password?" | Navigates to Forgot Password |
| 2.6 | Tap "Create an account" | Navigates to Sign Up |
| 2.7 | **Edge:** Double tap "Sign In" | Only one login attempt |
| 2.8 | **Edge:** Airplane mode on, submit | Network error, no crash |

---

## 3. Forgot Password / Reset Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | From Sign In, tap "Forgot password?" | Forgot Password screen |
| 3.2 | Enter email, tap "Send reset code" | Success message or generic "If that email is registered..." |
| 3.3 | Enter invalid email | Validation error or generic message |
| 3.4 | Leave email blank | Error |
| 3.5 | Tap "Already have a code? Reset now" | Navigates to Reset screen (with email param if entered) |
| 3.6 | Enter email, 6‑digit code, new password, confirm password | Password reset, redirect to Sign In |
| 3.7 | Enter mismatched passwords | Error: "Passwords do not match" |
| 3.8 | Enter invalid/expired code | Error message from API |

---

## 4. Verify Email Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | After sign up (if verification required) | Verify screen with code input |
| 4.2 | Enter valid 6‑digit code | Success, redirect to onboarding or feed |
| 4.3 | Enter invalid code | Error: "Invalid verification code" |
| 4.4 | Enter code < 4 digits | Verify button disabled or error |
| 4.5 | Tap "Resend Code" | New code sent, feedback shown |
| 4.6 | Tap "Skip for now" | Navigates to onboarding (if applicable) |

---

## 5. Fan Onboarding Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Sign up as new user (fan) | Redirected to onboarding |
| 5.2 | **Step 1 – Role:** Select "Fan" | Proceeds to next step |
| 5.3 | **Step 2 – Basic:** Enter name, zip (if required) | Validates and proceeds |
| 5.4 | **Step 3 – Plan:** Select interests / plan options | Proceeds |
| 5.5 | **Step 4 – Organization:** Search/select org (if shown) | Proceeds |
| 5.6 | **Step 6 – Authorized users:** Add email (if coach flow) | N/A for fan |
| 5.7 | **Step 7 – Profile:** Complete profile fields | Proceeds |
| 5.8 | **Step 8 – Interests:** Select teams/sports | Proceeds |
| 5.9 | **Step 9 – Features:** Toggle location, notifications | Proceeds |
| 5.10 | **Step 10 – Confirmation / Finish** | Onboarding complete, redirect to feed |
| 5.11 | **Edge:** Back at any step | Can go back without crash |
| 5.12 | **Edge:** Airplane mode mid-onboarding | Error or retry, no crash |
| 5.13 | **Edge:** Leave required field blank | Validation error before proceeding |

---

## 6. Coach Onboarding Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Sign up, select "Coach" on Step 1 | Coach onboarding path |
| 6.2 | Complete basic info (name, school, etc.) | Proceeds |
| 6.3 | Create or select team | Team created/selected |
| 6.4 | Add authorized users (emails) | Users added, can remove |
| 6.5 | Complete profile, interests, features | Proceeds through steps |
| 6.6 | Finish | Redirect to feed/tabs |
| 6.7 | Coach without team: Skip team creation (if allowed) | Can proceed, no crash |
| 6.8 | **Edge:** Invalid email in authorized users | Validation error |

---

## 7. Create Post Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1 | Tap center + button or "Create Post" | Create Post screen |
| 7.2 | Type text content | Input accepts text |
| 7.3 | Tap "Add photo/video" | Media picker opens |
| 7.4 | Select image or video | Media preview shown |
| 7.5 | Optionally attach event/game | Event picker, selection shown |
| 7.6 | Tap "Post" | Loading state, post created, success feedback |
| 7.7 | Post with content only (no media) | Post creates successfully |
| 7.8 | Post with media only | Post creates successfully |
| 7.9 | Leave content and media both empty | Error: "Either content or media_url required" |
| 7.10 | **Edge:** Double tap Post | Only one post created |
| 7.11 | **Edge:** Airplane mode, tap Post | Network error, no crash |
| 7.12 | **Edge:** Back mid-upload | Graceful cancel or draft saved |

---

## 8. Upload to Event / Game Page (Stories & Posts)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8.1 | Navigate to game/event detail | Event page loads |
| 8.2 | Tap "Add Story" (camera icon) | Location permission requested (if needed) |
| 8.3 | Grant location, take photo/video | Story uploads, appears in media |
| 8.4 | Deny location (for real game) | Alert: "Location required", option to Open Settings |
| 8.5 | Create post from event page (if available) | Post attaches to event |
| 8.6 | Upload story outside 2km of venue | Server rejects with distance message |
| 8.7 | **Edge:** Airplane mode during upload | Error, no crash |
| 8.8 | **Edge:** Double tap Add Story | Single story created |

---

## 9. Feed Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 9.1 | Open app (signed in) | Feed loads with posts |
| 9.2 | Pull to refresh | Feed refreshes |
| 9.3 | Scroll down | More posts load (infinite scroll) |
| 9.4 | Tap a post | Post detail opens |
| 9.5 | Tap "View Nearby Games on Map" | Map opens (location requested if needed) |
| 9.6 | **Edge:** Airplane mode on open | Offline banner, cached or error state |
| 9.7 | **Edge:** Idle 5 min, pull to refresh | Refresh works or shows session/network error |

---

## 10. Discover / Map Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 10.1 | Tap Discover tab | Discover screen (list or map) |
| 10.2 | Switch to Map view (if toggle exists) | Map loads, location requested |
| 10.3 | Deny location | Alert with "Open Settings" option |
| 10.4 | Grant location | User pin on map, nearby events |
| 10.5 | Tap event/game marker | Detail or bottom sheet |
| 10.6 | Search for team/school | Results shown |
| 10.7 | Tap a game/event from list | Game/event detail screen |
| 10.8 | **Edge:** Airplane mode | Map shows cached data or graceful error |

---

## 11. Event Detail Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 11.1 | Open event from feed or discover | Event detail loads |
| 11.2 | Tap RSVP | RSVP sheet (sign in if needed) |
| 11.3 | Toggle RSVP on/off | Count updates |
| 11.4 | Tap "Share" | Share sheet |
| 11.5 | Tap "Open in Maps" (if location set) | Maps app opens |
| 11.6 | **Edge:** Event not found / 404 | Error message, no blank screen |
| 11.7 | **Edge:** Airplane mode | Error boundary or error message |

---

## 12. Messaging Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 12.1 | Tap Messages (in tab or profile) | Messages list loads |
| 12.2 | Tap a conversation | Thread loads |
| 12.3 | Type message, send | Message appears in thread |
| 12.4 | Send with empty input | Send disabled or no-op |
| 12.5 | **Edge:** Airplane mode, send | Error, message queued or retry |
| 12.6 | **Edge:** Double tap send | Single message sent |

---

## 13. Ads Flow (Submit Ad)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 13.1 | Navigate to Submit Ad | Form loads |
| 13.2 | Enter business name, contact, dates, etc. | Fields accept input |
| 13.3 | Leave required field blank | Validation error on submit |
| 13.4 | Submit valid form | Success, confirmation or redirect |
| 13.5 | **Edge:** Airplane mode, submit | Network error |
| 13.6 | **Edge:** Double tap submit | Single submission |

---

## 14. Profile & Settings Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 14.1 | Open Profile | Profile loads |
| 14.2 | Tap Edit Profile | Edit form |
| 14.3 | Change display name, save | Profile updates |
| 14.4 | Open Settings | Settings list |
| 14.5 | Change ZIP code | Saves, no crash |
| 14.6 | Tap Sign Out | Confirmation, then sign out |
| 14.7 | **Edge:** Airplane mode, save profile | Error or retry |

---

## 15. Airplane Mode Mid-Session

| Step | Action | Expected Result |
|------|--------|-----------------|
| 15.1 | Open app, load feed | Feed visible |
| 15.2 | Turn on Airplane mode | Offline banner appears |
| 15.3 | Try to create post | Error message, no crash |
| 15.4 | Try to load event detail | Error or cached data |
| 15.5 | Turn off Airplane mode | Banner dismisses, retry works |
| 15.6 | Start creating post, turn Airplane on mid-upload | Graceful failure, no crash |

---

## 16. 5-Person Rule (Usability)

**Instruction to tester (no help):** "Find a game near you and post about it."

| Observation | Notes |
|-------------|-------|
| Where did they get stuck? | |
| Did they find the create button? | |
| Did they understand event vs post? | |
| Did location permission make sense? | |
| Any confusion with tabs or navigation? | |

---

## Quick Reference: Critical Paths

- **Sign up → Verify → Fan onboarding → Feed**
- **Sign up → Coach onboarding → Create team**
- **Feed → Create Post → Success**
- **Feed → Game detail → Add Story (with location)**
- **Discover → Map → Event detail**
- **Profile → Settings → Sign out**

---

*Last updated: Manual checklist for pre-launch QA. Run on real devices (iPhone XR or older, mid-range Android).*
