# Email Integration Fix Summary

## Issue
TypeScript compilation errors due to parameter name mismatches between function calls and function signatures.

## Root Cause
Email functions expect camelCase parameter names (e.g., `recipientName`) but I was using snake_case (e.g., `recipient_name`).

## Files with Errors
1. `server/src/routes/organizations.ts`
2. `server/src/routes/teams.ts`
3. `server/src/routes/auth.ts`
4. `server/src/routes/events.ts`
5. `server/src/routes/adminReports.ts`
6. `server/src/jobs/subscriptionExpiryChecker.ts`

## Required Parameter Names by Function

### sendOrganizationInvitationEmail
- to
- recipientName (NOT invitee_name)
- organizationName
- inviterName
- role
- acceptLink (NOT invite_link)
- declineLink

### sendTeamInvitationEmail  
- to
- recipientName (NOT invitee_name)
- teamName
- inviterName
- role
- acceptLink (NOT invite_link)
- declineLink

### sendAthleteInvitationEmail
- to
- athleteName (NOT athlete_name)
- teamName
- coachName (NOT coach_name)
- sport
- acceptLink
- declineLink

### sendRosterThresholdEmail
- to
- coachName (NOT coach_name)
- teamName
- currentRosterCount
- maxRosterCount
- upgradeLink

### sendInvitationDeclinedEmail
- to
- senderName (NOT sender_name)
- declinedByName (NOT declined_by_name)
- teamName
- role
- declinedDate (NOT declined_date)
- reasonProvided (NOT reason_provided)
- viewTeamUrl
- resendInvitationUrl

### sendRoleAssignmentEmail
- to
- userName (NOT recipient_name)
- newRole
- teamName
- assignedBy
- assignedDate
- dashboardLink

### sendTeamRosterUpdateEmail
- to
- coachName (NOT recipient_name)
- teamName
- updateType
- playerName (NOT affected_member_name)
- updateDate
- viewRosterLink

### sendMemberRemovedEmail
- to
- userName
- teamName
- organizationName
- removedBy
- removalDate
- removalReason
- contactEmail

### sendUserConfirmationEmail
- to
- userName (NOT user_name)
- confirmationLink
- expiresIn

### sendLoginNewDeviceEmail
Should be: sendLoginFromNewDeviceEmail
- to
- userName
- deviceName
- location
- timestamp
- secureAccountUrl

### sendEventRSVPEmail
Does NOT exist - need to check actual function name

### sendReportResolvedEmail
Should be: sendReportResolutionEmail
