# Coach/Organization Real-World Testing Guide

This guide covers comprehensive testing for coach and organization functionality in VarsityHub.

## Quick Test

Run the automated test suite:

```bash
npx tsx scripts/test-coach-organization.ts
```

## What Gets Tested

### 1. **Server Health** ✅
- Verifies server is running and accessible
- Checks API base URL configuration

### 2. **Organization Endpoints** 📋
- `GET /organizations` - List organizations
- `POST /organizations` - Create organization (requires auth)
- Organization management functionality

### 3. **Team Endpoints** 👥
- `GET /teams` - List teams
- `POST /teams` - Create team (requires auth)
- `GET /teams/limits` - Check team creation limits
- Subscription-based team limits

### 4. **Event Endpoints** 🎪
- `GET /events/pending` - Approval queue
- `POST /games` - Create event
- `PUT /events/:id/approve` - Approve event (coach/admin only)
- Event approval workflow

### 5. **Team Invitations** 📧
- `GET /team-invites` - List invitations
- `POST /team-invites` - Create invitation
- Email notification testing

### 6. **Organization Join Requests** 🤝
- `GET /organizations/join-requests` - List requests
- `POST /organizations/join-requests` - Create request
- Request approval workflow

### 7. **Subscription Limits** 💳
- `GET /subscriptions/me` - Get subscription info
- `GET /teams/limits` - Team creation limits
- Rookie (2 teams), Veteran (unlimited), Legend (unlimited)

### 8. **Permissions & Roles** 🔐
- `GET /users/me` - User role verification
- Coach vs Fan vs Admin permissions
- Role-based access control

### 9. **Roster Management** 📊
- `GET /team-memberships` - List team members
- Member management functionality

## Manual Testing Scenarios

### Scenario 1: Coach Onboarding Flow

1. **Sign up as Coach**
   - Navigate to signup
   - Select "Coach / Organizer" role
   - Complete onboarding steps

2. **Create Organization**
   - Navigate to `/onboarding/step-4-organization`
   - Enter organization name and type
   - Verify organization is created

3. **Select Subscription Plan**
   - Choose Rookie (free, 2 teams)
   - Or Veteran ($70/year, unlimited teams)
   - Or Legend ($150/year, unlimited + features)

4. **Create First Team**
   - Navigate to `/create-team`
   - Enter team name, sport, season
   - Upload team logo
   - Verify team is created

### Scenario 2: Team Creation Limits

**Test Rookie Plan (2 teams max):**

1. Create first team ✅
2. Create second team ✅
3. Try to create third team ❌
   - Should show upgrade prompt
   - Should block creation

**Test Veteran/Legend Plan (unlimited):**

1. Create multiple teams ✅
2. Verify no limit enforcement
3. Check team limits endpoint shows unlimited

### Scenario 3: Event Creation & Approval

**As Coach (Auto-Approved):**

1. Navigate to `/event-approvals`
2. Click "Create Event" tab
3. Fill out event form:
   - Event type (Game/Match, Watch Party, etc.)
   - Date & time
   - Location
   - Description
4. Submit event
5. Verify event appears immediately (auto-approved)

**As Fan (Requires Approval):**

1. Sign up as Fan
2. Create event via `/create-fan-event`
3. Submit event
4. Verify event goes to approval queue
5. Coach/admin approves via `/event-approvals`
6. Verify event is published

### Scenario 4: Event Approval Workflow

1. **View Pending Events**
   - Navigate to `/event-approvals`
   - Switch to "Approvals" tab
   - View list of pending events

2. **Approve Event**
   - Click on pending event
   - Review event details
   - Click "Approve"
   - Verify event is published

3. **Reject Event**
   - Click on pending event
   - Click "Reject"
   - Enter rejection reason (optional)
   - Verify event is removed from queue

### Scenario 5: Team Invitations

1. **Create Team Invitation**
   - Navigate to team management
   - Click "Invite Member"
   - Enter email address
   - Select role (player, coach, etc.)
   - Send invitation

2. **Verify Email Sent**
   - Check recipient's email
   - Verify invitation email received
   - Click invitation link

3. **Accept Invitation**
   - User accepts invitation
   - Verify user added to team roster
   - Verify user can access team features

### Scenario 6: Organization Join Requests

1. **Request to Join Organization**
   - Navigate to organization page
   - Click "Request to Join"
   - Enter message
   - Submit request

2. **Admin Reviews Request**
   - Admin navigates to `/organization-join-requests`
   - Views pending requests
   - Approves or denies request

3. **User Receives Notification**
   - Email notification sent
   - User can view status in app

### Scenario 7: Roster Management

1. **View Team Roster**
   - Navigate to team page
   - View roster list
   - Check member roles

2. **Add Team Member**
   - Invite via email
   - Or add existing user
   - Assign role

3. **Remove Team Member**
   - Select member
   - Remove from team
   - Verify removal

4. **Update Member Role**
   - Select member
   - Change role (player → coach)
   - Verify role update

### Scenario 8: Organization Page

1. **View Organization**
   - Navigate to `/organization?id=<org-id>`
   - View organization details
   - Check teams tab
   - Check schedule tab
   - Check feed tab

2. **Follow Organization**
   - Click "Follow" button
   - Verify following status
   - Check organization appears in following list

3. **View Organization Teams**
   - Switch to "Teams" tab
   - View all teams in organization
   - Click team to view details

4. **View Organization Schedule**
   - Switch to "Schedule" tab
   - View all games/events
   - Filter by date

5. **View Organization Feed**
   - Switch to "Feed" tab
   - View posts related to organization
   - Filter by team hashtags

## API Endpoint Testing

### Test with Authentication

To test authenticated endpoints, you'll need a valid JWT token:

```bash
# 1. Sign in to get token
curl -X POST http://localhost:3001/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "coach@example.com", "password": "password"}'

# 2. Use token in subsequent requests
curl -X GET http://localhost:3001/teams \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test Organization Creation

```bash
curl -X POST http://localhost:3001/organizations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test High School",
    "type": "school",
    "description": "Test organization"
  }'
```

### Test Team Creation

```bash
curl -X POST http://localhost:3001/teams \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Varsity Basketball",
    "sport": "Basketball",
    "season": "Fall 2024",
    "organization_id": "org-id-here"
  }'
```

### Test Event Approval

```bash
curl -X PUT http://localhost:3001/events/123/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Expected Behaviors

### ✅ Success Cases

- Coach can create unlimited teams (Veteran/Legend) or 2 teams (Rookie)
- Coach-created events are auto-approved
- Fan-created events require approval
- Team invitations send email notifications
- Organization join requests notify admins
- Roster management works correctly
- Subscription limits are enforced

### ❌ Error Cases

- Rookie coach cannot create 3rd team (should show upgrade)
- Unauthenticated users cannot create teams/events
- Fans cannot approve events
- Invalid team IDs return 404
- Missing required fields return 400

## Performance Testing

### Response Time Targets

- Organization list: < 500ms
- Team list: < 500ms
- Event creation: < 1000ms
- Event approval: < 500ms
- Team invitation: < 1000ms

### Load Testing

Test with multiple concurrent requests:

```bash
# Test team creation limits under load
for i in {1..10}; do
  curl -X POST http://localhost:3001/teams \
    -H "Authorization: Bearer TOKEN" \
    -d '{"name": "Team '$i'"}' &
done
wait
```

## Troubleshooting

### Server Not Running

```bash
cd server
npm run dev
```

### Authentication Issues

- Verify JWT token is valid
- Check token expiration
- Ensure user has correct role (coach/admin)

### Team Limit Issues

- Check subscription tier: `GET /subscriptions/me`
- Verify team count: `GET /teams/limits`
- Check if upgrade is needed

### Event Approval Issues

- Verify user has coach/admin role
- Check event exists: `GET /events/pending`
- Verify approval endpoint: `PUT /events/:id/approve`

## Next Steps

After testing:

1. ✅ Verify all endpoints respond correctly
2. ✅ Test authentication and authorization
3. ✅ Verify subscription limits work
4. ✅ Test email notifications
5. ✅ Check error handling
6. ✅ Verify UI matches API behavior
