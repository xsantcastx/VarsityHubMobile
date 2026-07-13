# Web Testing Change Log

**Session Date:** December 7, 2025  
**Purpose:** Track all UI/UX changes and backend requirements during live web testing

---

## Changes Implemented

### 1. **Username Field Added to Onboarding** ✅

- **Location:** `app/onboarding/step-7-profile.tsx`
- **What Changed:**
  - Added username input field between profile picture and bio
  - Auto-capitalizes to lowercase
  - Saves to both context and backend
- **Backend Status:** ✅ Already supported by `User.patchMe()` API
- **Files Modified:**
  - `app/onboarding/step-7-profile.tsx`

### 2. **Dark Mode Theme Update** ✅

- **What Changed:**
  - Updated all dark mode backgrounds from pure black (#000000) to navy blue (#0f172a)
  - Applied consistently across entire app
- **Files Modified:**
  - `constants/Colors.ts` (already had navy blue)
  - `app/onboarding/components/OnboardingLayout.tsx`
  - `components/ui/TabBarBackground.ios.tsx`
  - `components/CollageView.tsx`
  - `app/post-detail.tsx`
  - `app/game-details/GameDetailsScreen.tsx`
- **Backend Status:** ✅ No backend changes needed (UI only)

---

## Testing Notes

### Current Status

- ✅ Web app running at http://localhost:8081
- ✅ Railway backend live with CORS fix
- ⏳ Ready for user testing

### Test Checklist

- [ ] Sign up / Login flow
- [ ] Onboarding steps (especially new username field)
- [ ] Dark mode appearance
- [ ] Feed browsing
- [ ] Post creation
- [ ] Comments
- [ ] Profile editing
- [ ] Search functionality
- [ ] Team pages

---

## Issues Found During Testing

### 1. **react-native-maps Import Error on Web** ✅ FIXED

- **Error:** "Importing native-only module react-native-maps on web"
- **Root Cause:** Maps library uses native modules incompatible with web
- **Fix Applied:**
  - Created web-specific versions: `ReachMapPreview.web.tsx` and `EventMap.web.tsx`
  - Both show placeholder UI explaining maps are available on mobile app
  - React Native automatically uses `.web.tsx` files on web platform
- **Status:** ✅ FIXED - Web app now loading successfully
- **Files Created:**
  - `components/ReachMapPreview.web.tsx`
- **Files Modified:**
  - `metro.config.js` (added maps alias)
  - `webpack.config.js` (created for web bundler config)

### 2. **Date Picker Not Working on Web** ✅ FIXED

- **Issue:** "Select date" button not responding on onboarding Step 2
- **Root Cause:** `@react-native-community/datetimepicker` doesn't support web platform
- **Fix Applied:**
  - Created `components/ui/DateField.web.tsx` using HTML5 date input
  - Styled to match app theme (navy dark mode, proper colors)
  - Validates max date (today) to prevent future dates
  - Auto-focused border styling for better UX
- **Status:** ✅ FIXED - Date picker now works on web
- **Files Created:**
  - `components/ui/DateField.web.tsx`
- **Files Modified:**
  - `app/onboarding/step-2-basic.tsx` (fixed import path)
- **Backend Status:** ✅ No changes needed - existing API supports date format

---

## Backend Requirements

_Track any new API endpoints or modifications needed..._

---

## Monitoring & Error Tracking

### Error Monitoring Setup ✅ **ACTIVE**

**Production Error Tracking (Sentry):**

- Frontend: `@sentry/react-native` v7.7.0
- Backend: `@sentry/node` v7.91.0
- **Status:** Configured but disabled in development (`__DEV__` mode)
- **When Active:** Production builds only (when `EXPO_PUBLIC_SENTRY_DSN` is set and valid)
- Auto-initialized in `app/_layout.tsx`

**Development Error Monitor (Web Testing Only):**

- **File:** `utils/testingMonitor.web.ts` (✅ Created this session, not yet committed)
- **Status:** ✅ ACTIVE - Running now in browser
- **Integration:** Imported in `app/_layout.tsx` for web platform only
- **Captures:**
  - ❌ Console errors (`console.error`)
  - ⚠️ Console warnings (`console.warn`)
  - 🌐 Network request failures (via fetch wrapper)
  - 🔥 Unhandled exceptions (`window.error`)
  - 🔥 Unhandled promise rejections

**Helper Script:**

- **File:** `check-web-errors.sh` (✅ Created this session, not yet committed)
- **Purpose:** Quick health check of web app and backend
- **Usage:** `./check-web-errors.sh`

### How to Access Error Logs (Browser Console)

**During web testing, open Chrome DevTools Console and run:**

```javascript
// Get summary of all errors
window.testingMonitor.getErrorReport();

// Get raw error list
window.testingMonitor.getErrors();

// Clear error log
window.testingMonitor.clear();
```

### What's Currently Logging

**Standard Development:**

- Regular `console.error` and `console.warn` output in Chrome DevTools
- React error boundaries catch component errors
- Network errors visible in Network tab

**Enhanced (This Session Only):**

- Custom testing monitor wraps console methods
- Stores errors in memory and localStorage
- Available via `window.testingMonitor` global object
- Auto-starts on web platform in development mode

---

## Security Notes

- All code changes will be scanned with Snyk before deployment
- Username validation should be added (alphanumeric + underscore only)
- Consider adding username uniqueness check
- Sentry error tracking active in production only
- Testing monitor only runs in development mode

---

**Last Updated:** December 7, 2025 - Testing session started
