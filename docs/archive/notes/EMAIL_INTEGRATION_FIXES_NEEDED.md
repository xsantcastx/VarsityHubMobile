# Complete Email Integration Fix List

## Summary

All 28 email templates are now integrated into routes, but TypeScript compilation fails due to parameter name mismatches. This document lists every required fix.

## Status

- ✅ All route integrations added
- ❌ Parameter names don't match function signatures
- ⏳ Need to fix 50+ parameter mismatches across 6 files

## Compilation Errors: 20 total

### File: server/src/routes/auth.ts (3 errors)

**Error 1: Line 10 - Wrong import name**

```typescript
// CURRENT (WRONG):
import { sendLoginNewDeviceEmail } from '../lib/email.js';

// FIX TO:
import { sendLoginFromNewDeviceEmail } from '../lib/email.js';
```

**Error 2: Line 119 - sendUserConfirmationEmail parameters**
Expected: `userName`, `confirmationLink`, `expiresIn`
Current has: `user_name`, `registration_date`, `user_role`, `next_steps_url`, `support_email`

**Error 3: Line 227 - sendLoginFromNewDeviceEmail parameters**
Expected: `userName`, `deviceType`, `deviceLocation`, `loginDate`, `loginTime`, `ipAddress`, `secureAccountLink`, `changePasswordLink`, `contactSupportLink`
Current has: `user_name`, `device_type`, `browser`, `ip_address`, `login_date`, `login_time`, `secure_account_url`, `support_email`

### File: server/src/routes/organizations.ts (3 errors)

**All 3 errors: sendOrganizationInvitationEmail parameters**
Expected: `recipientName`, `organizationName`, `inviterName`, `role`, `acceptLink`, `declineLink`
Current has: `invitee_name`, `inviter_name`, `organization_name`, `role`, `invite_link`, `expiry_days`

### File: server/src/routes/teams.ts (10 errors)

**Error 1: Line 155 - sendRosterThresholdEmail**
Expected: `coachName`, `teamName`, `currentRosterCount`, `maxRosterCount`, `upgradeLink`
Current has: `coach_name`, `team_name`, `roster_count`, `threshold`, `threshold_cost`, `manage_billing_url`

**Error 2-3: Lines 907, 1004 - sendTeamInvitationEmail**
Expected: `recipientName`, `teamName`, `inviterName`, `role`, `acceptLink`, `declineLink`
Current has: `invitee_name`, `inviter_name`, `team_name`, `organization_name`, `role`, `invite_link`, `expiry_days`

**Error 4: Line 910 - team.organization property**
Need to include organization in query

**Error 5: Line 991 - sendAthleteInvitationEmail**
Expected: `athleteName`, `teamName`, `coachName`, `sport`, `acceptLink`, `declineLink`
Current has: `athlete_name`, `coach_name`, `team_name`, `organization_name`, `sport`, `position`, `invite_link`, `expiry_days`

**Error 6: Line 1116 - sendStaffMemberJoinedEmail not imported**

**Error 7: Line 1247 - sendInvitationDeclinedEmail**
Expected: `senderName`, `declinedByName`, `teamName`, `role`, `declinedDate`, `reasonProvided`, `viewTeamUrl`, `resendInvitationUrl`
Current has: `sender_name`, `declined_by_name`, `team_name`, `role`, `declined_date`, `reason_provided`, `view_team_url`, `resend_invitation_url`

**Error 8: Line 1329 - sendRoleAssignmentEmail**
Expected: `userName`, `newRole`, `teamName`, `assignedBy`, `assignedDate`, `dashboardLink`
Current has: `recipient_name`, `team_name`, `organization_name`, `previous_role`, `new_role`, `assigned_by_name`, `assignment_date`, `view_team_url`

**Error 9: Line 1422 - sendMemberRemovedEmail missing role**
Current doesn't have `role` parameter

**Error 10: Line 1440 - sendTeamRosterUpdateEmail**
Expected: `coachName`, `teamName`, `updateType`, `playerName`, `updateDate`, `viewRosterLink`
Current has: `recipient_name`, `team_name`, `update_type`, `affected_member_name`, `affected_member_role`, `action_by_name`, `update_date`, `roster_count`, `view_roster_url`

### File: server/src/routes/events.ts (2 errors)

**Error 1: Line 3 - Wrong function name**

```typescript
// CURRENT (WRONG):
import { sendEventRSVPEmail } from '../lib/email.js';

// FIX TO:
import { sendEventRsvpConfirmedEmail } from '../lib/email.js';
```

**Error 2: Line 280 - sendEventRsvpConfirmedEmail parameters**
Expected: `userName`, `eventName`, `eventDate`, `eventTime`, `eventLocation`, `rsvpConfirmedAt`, `organizationName`, `eventDetailLink`, `calendarLink`, `cancelRsvpLink`
Current has: `user_name`, `event_name`, `event_date` (combined), `event_location`, `rsvp_status`, `attendee_count`, `event_capacity`, `event_details_url`, `cancel_rsvp_url`

### File: server/src/routes/adminReports.ts (1 error)

**Error 1: Line 8 - Wrong function name**

```typescript
// CURRENT (WRONG):
import { sendReportResolvedEmail } from '../lib/email.js';

// FIX TO:
import { sendReportResolutionEmail } from '../lib/email.js';
```

### File: server/src/jobs/subscriptionExpiryChecker.ts (1 error)

**Error 1: Line 82 - sendSubscriptionExpiringEmail parameters**
Expected: `userName`, `planName`, `expiresDate`, `daysRemaining`, `renewalPrice`, `featuresLosing`, `renewLink`, `manageSubscriptionLink`
Current has: `user_name`, `plan_name`, `expiry_date`, `days_remaining`, `renewal_url`, `manage_billing_url`, `support_email`

## Next Steps

1. Fix import names (3 files)
2. Fix parameter names in all function calls
3. Add missing imports (sendStaffMemberJoinedEmail in teams.ts)
4. Re-run TypeScript compilation
5. Run Snyk security scan
6. Document final status

## Estimated Fixes: ~60 line changes across 6 files
