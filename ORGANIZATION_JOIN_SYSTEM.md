# Organization Join Request System

## Overview
Implemented a complete organization search, join request, and admin approval workflow for coaches during onboarding. This prevents duplicate organizations and allows coaches to connect to existing organizations instead of creating duplicates.

## Implementation Date
November 17, 2024

## Database Changes

### New Model: `OrganizationJoinRequest`
```prisma
model OrganizationJoinRequest {
  id              String   @id @default(cuid())
  organization_id String
  user_id         String
  status          String   @default("pending") // pending | approved | denied
  message         String?  // Optional message from user
  created_at      DateTime @default(now())
  reviewed_at     DateTime?
  reviewed_by     String?  // user_id of admin who reviewed
  
  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  @@unique([organization_id, user_id])
  @@index([organization_id, status])
  @@index([user_id, status])
}
```

### Updated Model: `Organization`
Added location fields for proximity search:
- `org_type` (String?) - school | club | league | other
- `location` (String?) - City, State format
- `zip_code` (String?) - For nearby search
- Indexes on `zip_code` and `location`

### Migration
```bash
npx prisma migrate dev --name add_organization_location_and_join_requests
```

## Backend API Endpoints

### Search & Discovery
**GET** `/organizations/search/nearby`
- Query params: `zip_code` (required), `sport`, `org_type`, `limit`
- Returns organizations in the same zip code
- Response includes member/team counts

**POST** `/organizations/check-duplicate`
- Body: `{ name, zip_code }`
- Checks for existing organizations with matching name/location
- Returns `{ exists: boolean, organization?: {...} }`

### Join Request Workflow
**POST** `/organizations/join-requests`
- Body: `{ organization_id, message? }`
- Creates join request and sends email to org owner
- Prevents duplicate requests
- Requires authentication

**GET** `/organizations/:id/join-requests`
- Query params: `status` (default: 'pending', or 'all')
- Returns join requests for organization
- Admin only (owner/manager role required)

**GET** `/organizations/join-requests/me`
- Returns authenticated user's own join requests
- Includes organization details

**POST** `/organizations/join-requests/:requestId/approve`
- Approves join request
- Creates OrganizationMembership with 'member' role
- Sends approval email to requester
- Admin only

**POST** `/organizations/join-requests/:requestId/deny`
- Body: `{ reason? }`
- Denies join request
- Sends denial email with optional reason
- Admin only

## Email Notifications

### `sendJoinRequestToAdmin()`
Sent when user requests to join organization.
- To: Organization owner/admin
- Includes: Requester name, optional message, approve/deny links
- Template: HTML + plain text

### `sendJoinRequestApproved()`
Sent when admin approves join request.
- To: Requesting user
- Includes: Organization name, admin name who approved, link to org
- Template: Success message with call-to-action

### `sendJoinRequestDenied()`
Sent when admin denies join request.
- To: Requesting user
- Includes: Organization name, optional denial reason
- Template: Polite notification

## Frontend Changes

### `step-5-league.tsx` (Coach Onboarding)

#### New UI Flow for Organizations (Veteran/Legend Plans)
1. **Initial Prompt**
   - "Does your organization already exist on VarsityHub?"
   - "Search for Organization" button
   - "Or create a new organization" divider

2. **Search Interface**
   - Zip code input field
   - Search button with loading state
   - "Create New Instead" back button
   - Results list with organization cards

3. **Organization Cards**
   - Organization name, location, sport
   - Member and team counts
   - "Request to Join" button

4. **Join Request Modal**
   - Organization name display
   - Optional message input
   - Cancel / Send Request buttons
   - Loading state during submission

5. **Success Flow**
   - Alert confirmation
   - Saves `join_request_pending` flag to onboarding state
   - Continues to next onboarding step
   - User receives email when admin responds

#### State Management
```typescript
// New state variables
const [showSearch, setShowSearch] = useState(false);
const [searchZip, setSearchZip] = useState(ob.zip || '');
const [nearbyOrgs, setNearbyOrgs] = useState<any[]>([]);
const [searching, setSearching] = useState(false);
const [requestingJoin, setRequestingJoin] = useState(false);
const [joinMessage, setJoinMessage] = useState('');
const [selectedOrg, setSelectedOrg] = useState<any>(null);
```

#### New Functions
- `searchNearbyOrgs()` - Searches organizations by zip code
- `requestToJoin(org)` - Opens join request modal
- `submitJoinRequest()` - Submits join request and sends email

## User Experience

### For Coaches Joining Existing Organizations
1. Start onboarding, select Coach role
2. Choose Veteran or Legend plan
3. Reach organization step
4. Click "Search for Organization"
5. Enter zip code and search
6. See list of nearby organizations
7. Click "Request to Join" on desired org
8. Write optional introduction message
9. Submit request
10. Receive confirmation alert
11. Continue onboarding (can add authorized users, etc.)
12. Receive email when admin approves/denies

### For Organization Admins
1. Receive email: "New Join Request for [Organization Name]"
2. See requester name and optional message
3. Click "Approve Request" or "Deny Request" in email
4. Or visit organization dashboard to review all pending requests
5. Approve: User immediately added as member, receives approval email
6. Deny: User receives notification with optional reason

### For Coaches Creating New Organizations
1. If search returns no results, prompted to create new
2. Or click "Create New Instead" from search view
3. Fill out organization form (name, type, location)
4. System checks for duplicates before creation
5. Organization created with coach as owner

## Benefits

### Prevents Duplicate Organizations
- Search shows existing organizations in same zip code
- Users can join instead of creating duplicates
- Cleaner database, better user connections

### Admin Control
- Organization owners control membership
- Can review requester profile before approving
- Can deny with explanation if needed

### Email Integration
- Automated notifications keep everyone informed
- Approve/deny links in emails for quick action
- Professional communication templates

### Seamless Onboarding
- Join request doesn't block onboarding flow
- User can complete setup while waiting for approval
- Pending status tracked in onboarding state

## Testing Checklist

- [ ] Search for organizations by zip code
- [ ] Display organization cards with correct info
- [ ] Submit join request with message
- [ ] Submit join request without message
- [ ] Verify email sent to organization admin
- [ ] Approve join request (admin side)
- [ ] Verify approval email sent to requester
- [ ] Verify membership created on approval
- [ ] Deny join request with reason
- [ ] Deny join request without reason
- [ ] Verify denial email sent to requester
- [ ] Create new organization if none found
- [ ] Check duplicate prevention on creation
- [ ] Test with multiple organizations in same zip
- [ ] Test with no organizations in zip (empty results)
- [ ] Test back/forth between search and create modes
- [ ] Verify onboarding state updated correctly
- [ ] Test pending request status in user's requests list

## Configuration Required

### Environment Variables
All email variables already configured:
- `SMTP_HOST` - SendGrid configured
- `SMTP_PORT` - Port 587
- `SMTP_USER` - "apikey"
- `SMTP_PASS` - SendGrid API key
- `FROM_EMAIL` - Sender email (needs verification for production)
- `WEB_URL` - Base URL for email links (default: https://varsityhub.app)

### SendGrid Setup
- ✅ API key configured
- ⚠️ Sender identity needs verification for production emails
- ✅ Templates use HTML + plain text format

## Future Enhancements

### Radius-Based Search
Currently searches by exact zip code match. Could enhance with:
- Radius parameter (e.g., "within 25 miles")
- Geocoding to calculate distances
- Sort results by proximity

### Advanced Search Filters
- Sport type
- Organization type (school/club/league)
- Organization size (team/member count)
- Activity level (recent posts/games)

### Join Request Features
- Request expiration (auto-deny after X days)
- Batch approve/deny multiple requests
- Organization join settings (auto-approve, require approval, closed)
- Request notes/annotations from admin

### Notifications
- In-app notifications for join requests
- Push notifications for mobile apps
- Digest emails for multiple pending requests

## Related Files

**Database:**
- `/server/prisma/schema.prisma` - Models and indexes

**Backend:**
- `/server/src/routes/organizations.ts` - API endpoints
- `/server/src/lib/email.ts` - Email templates

**Frontend:**
- `/app/onboarding/step-5-league.tsx` - UI implementation
- `/context/OnboardingContext.tsx` - State management

**Documentation:**
- This file (`ORGANIZATION_JOIN_SYSTEM.md`)

## Notes

- Join requests are unique per user+organization (prevents duplicate requests)
- Status can be: `pending`, `approved`, or `denied`
- Approved users get `member` role (not owner or manager)
- Denied users can submit new requests later
- Search is case-insensitive
- Location fields are optional but recommended for better UX
- Email notifications work in dev (console log) and production (SendGrid)
