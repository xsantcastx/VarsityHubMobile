# Team Invite Workflow Fix

## Issues Found

### 1. User Search Endpoint Problems
**Location:** `server/src/routes/users.ts` - `/users/search/mentions`

**Previous Issues:**
- ❌ Only returned `id`, `display_name`, `avatar_url` (missing `email` and `username`)
- ❌ Only searched users you follow/followers (too restrictive)
- ❌ Didn't search by username or email
- ❌ Frontend expected `email` field but it was undefined

**Impact:**
- User search appeared to work but didn't return email
- `sendInvite()` in team-profile.tsx would fail silently when trying to access `selectedUser.email`
- Couldn't find users by username or email, only display name
- Couldn't invite users you don't follow

### 2. What Was Fixed

**Backend Changes:** `server/src/routes/users.ts`
```typescript
// NOW searches ALL users (not just followers) by:
// - username (case-insensitive)
// - display_name (case-insensitive)  
// - email (case-insensitive)

// NOW returns complete user data:
{
  id: true,
  username: true,        // ✅ ADDED
  display_name: true,
  email: true,           // ✅ ADDED
  avatar_url: true,
  verified: true,        // ✅ ADDED
}
```

## Complete Team Invite Workflow

### 1. **Invite User** (team-profile.tsx)
1. Team owner/admin opens team profile
2. Clicks "Invite Members" button
3. Types username, display name, or email in search box
4. Search calls `User.searchForMentions(query, 10)`
   - Backend searches all non-banned users
   - Returns users with matching username, display_name, or email
5. User selects someone from results
6. Clicks "Send Invite"
7. `sendInvite()` validates:
   - Roster limit (max 99 members)
   - Email exists (now fixed!)
8. Calls `TeamApi.invite(teamId, email, 'member')`
9. Backend creates TeamInvite record

### 2. **Receive Invite** (team-invites.tsx)
1. Invited user navigates to Team Invites screen
2. App calls `TeamApi.myInvites()`
3. Backend finds invites matching user's email with status='pending'
4. Returns list with team details
5. User sees pending invites with team name and role

### 3. **Accept Invite** (team-invites.tsx)
1. User clicks "Accept" on an invite
2. Calls `TeamApi.acceptInvite(inviteId)`
3. Backend:
   - Verifies invite belongs to user's email
   - Creates/updates TeamMembership record (status='active')
   - Updates invite status to 'accepted'
4. Shows success modal with option to view team
5. Refreshes invite list (accepted invite removed)

### 4. **Decline Invite** (team-invites.tsx)
1. User clicks "Decline" on an invite
2. Calls `TeamApi.declineInvite(inviteId)`
3. Backend:
   - Verifies invite belongs to user's email
   - Updates invite status to 'declined'
4. Refreshes invite list (declined invite removed)

## API Endpoints

### User Search
- **GET** `/users/search/mentions?q={query}&limit={limit}`
- **Returns:** Array of users with id, username, display_name, email, avatar_url, verified
- **Searches:** username, display_name, email (case-insensitive)

### Team Invites
- **POST** `/teams/:id/invite` - Send invite (requires email, optional role)
- **GET** `/teams/invites/me` - Get my pending invites
- **POST** `/teams/invites/:inviteId/accept` - Accept invite
- **POST** `/teams/invites/:inviteId/decline` - Decline invite

## Frontend Files

### team-profile.tsx
- Lines 94-95: Search state (searchQuery, searchResults)
- Lines 301-336: `searchUsers()` - Calls User.searchForMentions
- Lines 480-527: `sendInvite()` - Validates and sends invite
- Lines 991-1085: Invite modal UI with search input

### team-invites.tsx
- Lines 25-30: `load()` - Fetches pending invites
- Lines 36-60: `accept()` - Accept invite and show confirmation
- Lines 61-74: `decline()` - Decline invite
- Full invite list UI with accept/decline buttons

## Testing Checklist

- [x] User search returns email field
- [x] Can search by username
- [x] Can search by display name
- [x] Can search by email
- [x] Search finds users you don't follow
- [x] Invite sends with email correctly
- [x] Invites appear in team-invites.tsx
- [x] Accept creates team membership
- [x] Decline updates invite status
- [ ] **Deploy backend changes to Railway** (REQUIRED!)

## Deployment Required

⚠️ **IMPORTANT**: The backend changes to `server/src/routes/users.ts` must be deployed to Railway before the search will work properly in production.

**To deploy:**
1. Commit changes to git
2. Push to main branch
3. Railway will auto-deploy
4. Verify search endpoint returns email field

## Known Limitations

1. Invites are email-based, so users must have verified email addresses
2. No push notifications for new invites (users must check team-invites screen)
3. 99 player roster limit enforced
4. Duplicate invites allowed (same user can be invited multiple times)
