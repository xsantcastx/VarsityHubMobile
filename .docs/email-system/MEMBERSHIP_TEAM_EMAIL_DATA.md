# Membership & Team Management Email Data – Phase 1

**Status:** Current backend capabilities  
**Last Updated:** December 14, 2025

---

## 1. Organization Invite Email

**Trigger:** User invites someone to join an organization  
**Recipients:** Invitee (person being invited)  
**Current Status:** Stubbed (makeDisabled) – waiting for template  

### Available Data

| Field | Type | Example | From |
|-------|------|---------|------|
| `to` | email | invited@example.com | invitation email param |
| `organizationName` | string | "City High Athletics" | org.name |
| `role` | string | "member" | invitation.role (can be: member, manager) |
| `inviterName` | string | "Coach Smith" | inviter.display_name |

### Example Payload Sent to Email Function
```javascript
{
  to: "athlete@school.edu",
  organizationName: "City High Athletics",
  role: "member",
  inviterName: "Coach Smith"
}
```

### What's NOT Available (Phase 2)
- ❌ Invitation link/code to accept invitation directly from email
- ❌ Organization logo/image
- ❌ Team assignment
- ❌ Expiration date (no invite TTL tracking)
- ❌ Billing/plan info
- ❌ Custom welcome message

---

## 2. Staff Team Invite Email

**Trigger:** Coach invites someone to join a team  
**Recipients:** Invitee (person being invited to team)  
**Current Status:** Queued to emailWorker (not yet stubbed, ready for templates)  
**Queue Job Type:** `staff.invited_to_team`

### Available Data

| Field | Type | Example | From |
|-------|------|---------|------|
| `to` | email | athlete@school.edu | inviteeEmail |
| `invitee_name` | string | "John Athlete" | inviteeName or fallback to email |
| `inviter_name` | string | "Coach Smith" | inviterName or fallback to "Coach" |
| `team_name` | string | "Varsity Football" | team.name |
| `invite_link` | URL | `/team-invites?invite=ABC123` | constructed from inviteId |
| `expiry_days` | number | 7 | STAFF_INVITE_EXPIRY_DAYS env var |
| `onboarding_url` | URL | `https://varsityhub.app/onboarding/staff` | STAFF_ONBOARDING_URL env var |

### Example Payload Sent to Queue
```javascript
{
  to: "john@school.edu",
  invitee_name: "John Athlete",
  inviter_name: "Coach Smith",
  team_name: "Varsity Football",
  invite_link: "https://varsityhub.app/team-invites?invite=INVITE_ID_123",
  expiry_days: 7,
  onboarding_url: "https://varsityhub.app/onboarding/staff"
}
```

### What's NOT Available (Phase 2)
- ❌ Team logo/image
- ❌ Organization context
- ❌ Sport type
- ❌ Season info
- ❌ Roster size
- ❌ Custom message

---

## 3. Staff Invitation Confirmation Email (to Inviter)

**Trigger:** Same as above – sent to the coach who invited the person  
**Recipients:** Coach/Staff Member who sent the invite  
**Current Status:** Queued to emailWorker  
**Queue Job Type:** `staff.invitation_sent`

### Available Data

| Field | Type | Example | From |
|-------|------|---------|------|
| `to` | email | coach@school.edu | coachEmail (inviter's email) |
| `coach_name` | string | "Coach Smith" | inviterName or fallback to "Coach" |
| `invitee_name` | string | "John Athlete" | inviteeName or fallback to inviteeEmail |
| `invitee_email` | email | athlete@school.edu | inviteeEmail |
| `team_name` | string | "Varsity Football" | team.name |
| `manage_staff_url` | URL | `/teams/TEAM_ID/staff` | constructed from teamId |

### Example Payload Sent to Queue
```javascript
{
  to: "coach@school.edu",
  coach_name: "Coach Smith",
  invitee_name: "John Athlete",
  invitee_email: "john@school.edu",
  team_name: "Varsity Football",
  manage_staff_url: "https://varsityhub.app/teams/TEAM_ID/staff"
}
```

### What's NOT Available (Phase 2)
- ❌ Invitee status (pending/accepted/declined)
- ❌ Automatic retry notification if they don't accept
- ❌ Roster count

---

## 4. Roster Threshold Alert Email

**Trigger:** Team's roster size reaches ROSTER_ALERT_THRESHOLD (default 15 athletes)  
**Recipients:** Team owner(s)  
**Current Status:** Queued to emailWorker  
**Queue Job Type:** `teams.roster_threshold_alert`

### Available Data

| Field | Type | Example | From |
|-------|------|---------|------|
| `to` | email | coach@school.edu | team owner's email |
| `coach_name` | string | "Coach Smith" | owner's display_name |
| `team_name` | string | "Varsity Football" | team.name |
| `roster_count` | number | 15 | actual count of team members |
| `threshold_cost` | currency | 99.99 | ROSTER_THRESHOLD_COST env var |
| `manage_billing_url` | URL | `https://varsityhub.app/billing` | MANAGE_BILLING_URL env var |

### Example Payload Sent to Queue
```javascript
{
  to: "coach@school.edu",
  coach_name: "Coach Smith",
  team_name: "Varsity Football",
  roster_count: 15,
  threshold_cost: "99.99",
  manage_billing_url: "https://varsityhub.app/billing"
}
```

### What's NOT Available (Phase 2)
- ❌ Upgrade recommendation (which plan)
- ❌ Current plan info
- ❌ Discount codes
- ❌ Additional cost breakdown

---

## 5. Membership Decision Email (Accept/Deny Join Request)

**Trigger:** Admin approves or denies a user's request to join an organization  
**Recipients:** User who submitted the join request  
**Current Status:** Stubbed (makeDisabled) – waiting for template  

### Available Data

| Field | Type | Example | From |
|-------|------|---------|------|
| `to` | email | user@school.edu | joinRequest.user.email |
| `organizationName` | string | "City High Athletics" | organization.name |
| `approved` | boolean | true/false | decision (approve/deny) |
| `teamName` | string | "City High Athletics" | organization.name (same as org) |

### Example Payload - APPROVED
```javascript
{
  to: "athlete@school.edu",
  organizationName: "City High Athletics",
  approved: true,
  teamName: "City High Athletics"
}
```

### Example Payload - DENIED
```javascript
{
  to: "athlete@school.edu",
  organizationName: "City High Athletics",
  approved: false,
  teamName: "City High Athletics"
}
```

### Implementation Note
- Send different template based on `approved` boolean
- **Fallback behavior:** If this template fails, code falls back to `sendJoinRequestApproved()` or `sendJoinRequestDenied()` (with full details)

---

## Summary for Figma

**Tell them:**

✅ **Organization Invite** – 4 simple fields (email, org name, role, inviter name)

✅ **Team Staff Invite** – 7 fields (name, email, team, invite link, expiration days, coach name, onboarding URL)

✅ **Staff Confirmation to Coach** – 6 fields (coach name, invitee name/email, team, manage URL)

✅ **Roster Threshold Alert** – 6 fields (coach name, team, count, threshold cost, billing URL)

✅ **Membership Decision** – 4 fields (email, org name, approved boolean, team name)

**⚠️ Phase 2 Items (need backend work first):**
- Invitation links/codes with acceptance flow
- Media (logos, images)
- Expiration dates / automatic expirations
- Invitee status tracking
- Organization/team hierarchy context
- Billing/plan details

**🔴 NOT Coming in Phase 1:**
- Team assignment in org invites
- Custom messages
- Bulk invitations
- Invite revocation confirmations

---

## Implementation Status

| Email Type | Function | Status |
|------------|----------|--------|
| Organization Invite | `sendOrganizationInviteEmail()` | Stubbed (makeDisabled) |
| Team Staff Invite | `emailQueue.add('staff.invited_to_team')` | Queued (ready for worker) |
| Staff Confirmation | `emailQueue.add('staff.invitation_sent')` | Queued (ready for worker) |
| Roster Threshold Alert | `emailQueue.add('teams.roster_threshold_alert')` | Queued (ready for worker) |

**Next Steps:**
1. Create SendGrid Dynamic Templates with these fields
2. Map template IDs to env vars
3. Update emailWorker to call the appropriate SendGrid send functions
4. Test via team invite endpoints
