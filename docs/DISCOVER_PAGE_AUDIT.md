# Discover Page Logic Audit

**Date**: December 2024  
**Status**: ✅ **AUDIT COMPLETE - ISSUES IDENTIFIED**

---

## Overview

Comprehensive audit of the Discover page (`app/(tabs)/discover/mobile-community.tsx`) to identify real-world issues, validation gaps, and architectural inconsistencies.

---

## Critical Issues

### 1. **Date Parsing Vulnerability in Quick Game Save**
**Location**: `handleQuickGameSave` (line 239-335)

**Issue**: 
- Date parsing uses `Date.UTC` without proper validation
- If `data.date` is malformed, it creates an invalid date
- Time parsing regex might fail on edge cases (e.g., "1:5 PM" without leading zero)

**Impact**: 
- Invalid dates could be sent to API
- Users might see confusing error messages
- Could cause crashes if date is `Invalid Date`

**Fix Needed**:
- Validate date format before parsing
- Handle time format edge cases
- Validate resulting date is valid

---

### 2. **Nearby People Endpoint Access Issue**
**Location**: `loadPersonalization` (line 192)

**Issue**:
- `User.listAll(zipQ, 30)` is called, but this endpoint is **admin-only** (see `server/src/routes/users.ts:11`)
- For regular users, this will return an empty array (handled in `api/entities.ts:29-32`)
- The fallback is silent, so users never see nearby people

**Impact**:
- Nearby people feature doesn't work for non-admin users
- Poor user experience - feature appears broken
- No error message to explain why

**Fix Needed**:
- Create a public endpoint for listing users by zip code
- Or use a different approach (e.g., team members, followers)
- Add proper error handling and user feedback

---

### 3. **Team.allMembers Endpoint May Not Exist**
**Location**: `loadPersonalization` (line 188)

**Issue**:
- `Team.allMembers(q)` is called, but this method might not exist in the API
- No error handling if the endpoint doesn't exist
- Could cause crashes or silent failures

**Impact**:
- Nearby people feature fails silently for school/league users
- No fallback mechanism

**Fix Needed**:
- Verify `Team.allMembers` exists in API
- Add proper error handling
- Implement fallback to zip code search

---

### 4. **No Date Validation for Past Events**
**Location**: `filtered` useMemo (line 337-345)

**Issue**:
- Calendar date filtering doesn't exclude past events
- Users can select past dates and see old games
- No indication that events are in the past

**Impact**:
- Confusing UX - users see events they can't attend
- Wasted screen space on irrelevant content

**Fix Needed**:
- Filter out past events by default
- Add visual indicator for past events
- Optionally allow viewing past events with a toggle

---

### 5. **Search Query Edge Cases Not Handled**
**Location**: `filtered` useMemo (line 337-345)

**Issue**:
- Search doesn't handle empty strings, special characters, or very long queries
- Zip code regex might match partial numbers in addresses
- No sanitization of user input

**Impact**:
- Potential performance issues with very long queries
- Incorrect search results (e.g., matching "12345" in "12345 Main St" when searching for zip "12345")

**Fix Needed**:
- Add input sanitization
- Limit query length
- Improve zip code matching logic

---

### 6. **Game Creation Validation Missing**
**Location**: `handleQuickGameSave` (line 239-335)

**Issue**:
- No client-side validation before sending to API
- Required fields (title, date) are not validated
- Error messages are generic

**Impact**:
- Users can submit invalid data
- Poor error messages don't help users fix issues
- Wasted API calls

**Fix Needed**:
- Add client-side validation
- Validate required fields
- Provide specific error messages per field

---

### 7. **Error Handling is Too Generic**
**Location**: Multiple locations

**Issue**:
- All errors show generic messages like "Failed to add event"
- No distinction between network errors, validation errors, and server errors
- Users can't understand what went wrong

**Impact**:
- Poor user experience
- Difficult to debug issues
- Users might retry unnecessarily

**Fix Needed**:
- Categorize errors (network, validation, server)
- Show specific error messages
- Add retry logic for transient errors

---

## Medium Priority Issues

### 8. **Zip Code Filtering is Case-Sensitive**
**Location**: `loadGames` (line 151)

**Issue**:
- Zip code matching uses `.toLowerCase()` but might miss variations
- Doesn't handle zip codes with dashes (e.g., "12345-6789")

**Impact**:
- Some zip codes might not match correctly
- Inconsistent results

**Fix Needed**:
- Normalize zip codes (remove dashes, spaces)
- Improve matching logic

---

### 9. **No Loading State for Quick Game Save**
**Location**: `handleQuickGameSave` (line 239-335)

**Issue**:
- No loading indicator while creating game
- Users might click multiple times
- No feedback during API call

**Impact**:
- Duplicate game creation
- Poor UX - users don't know if action is processing

**Fix Needed**:
- Add loading state
- Disable button during submission
- Show progress indicator

---

### 10. **Calendar Doesn't Filter Past Events**
**Location**: Calendar component (line 458-500)

**Issue**:
- Calendar marks all dates with games, including past events
- No visual distinction between past and future events
- Users can select past dates

**Impact**:
- Confusing UX
- Users might try to RSVP to past events

**Fix Needed**:
- Filter out past events from calendar
- Disable past dates
- Add visual indicator for past vs future

---

### 11. **Pull-to-Refresh Doesn't Show Loading State**
**Location**: `onRefresh` (line 234-237)

**Issue**:
- `refreshing` state is set but might not be visible
- No visual feedback during refresh

**Impact**:
- Users might not know refresh is happening
- Might trigger multiple refreshes

**Fix Needed**:
- Ensure loading indicator is visible
- Disable pull-to-refresh during refresh

---

### 12. **No Pagination for Games List**
**Location**: `loadGames` (line 141-163)

**Issue**:
- All games are loaded at once
- No pagination or infinite scroll
- Could be slow with many games

**Impact**:
- Performance issues with large datasets
- Slow initial load
- High memory usage

**Fix Needed**:
- Implement pagination
- Add infinite scroll
- Limit initial load

---

## Low Priority Issues

### 13. **Team Label Derivation is Fragile**
**Location**: `deriveTeamLabels` (line 58-74)

**Issue**:
- Multiple fallback mechanisms
- Might not handle all team name formats
- Returns generic "Team A" / "Team B" if parsing fails

**Impact**:
- Some games might show generic team names
- Inconsistent display

**Fix Needed**:
- Improve team name parsing
- Add more fallback options
- Log when parsing fails

---

### 14. **Zip Directory Building is Inefficient**
**Location**: `buildZipDirectory` (line 26-56)

**Issue**:
- Processes all games on every render
- No memoization
- Could be slow with many games

**Impact**:
- Performance degradation
- Unnecessary computation

**Fix Needed**:
- Memoize zip directory
- Only rebuild when games change
- Optimize regex matching

---

### 15. **No Offline Support**
**Location**: All API calls

**Issue**:
- No offline caching
- All data is fetched from API
- No cached fallback

**Impact**:
- App doesn't work offline
- Poor experience with slow connections

**Fix Needed**:
- Add offline caching
- Cache games and posts
- Show cached data when offline

---

## Recommendations

### Immediate Actions (Critical)
1. ✅ Fix date parsing validation in `handleQuickGameSave`
2. ✅ Create public endpoint for nearby people or use alternative approach
3. ✅ Verify `Team.allMembers` exists and add error handling
4. ✅ Filter past events from calendar and games list
5. ✅ Add client-side validation for game creation

### Short-term Actions (Medium)
6. ✅ Improve error handling with specific messages
7. ✅ Add loading states for all async operations
8. ✅ Normalize zip code matching
9. ✅ Implement pagination for games list

### Long-term Actions (Low)
10. ✅ Improve team label derivation
11. ✅ Optimize zip directory building
12. ✅ Add offline support

---

## Testing Recommendations

1. **Test date parsing** with various formats
2. **Test nearby people** with different user roles
3. **Test search** with edge cases (empty, special chars, long queries)
4. **Test game creation** with invalid data
5. **Test calendar** with past/future dates
6. **Test error handling** with network failures
7. **Test performance** with large datasets

---

**Status**: ✅ **READY FOR FIXES**

**Next Steps**: Apply fixes for critical and medium priority issues.
