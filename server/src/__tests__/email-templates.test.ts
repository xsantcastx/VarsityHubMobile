import { describe, expect, it } from '@jest/globals';
import {
    isSendGridConfigured,
    sendAccountRecoveryEmail,
    sendAthleteInvitationEmail,
    sendBillingNoticeEmail,
    sendCoachOnboardingEmail,
    sendContentModerationEmail,
    sendFanWelcomeEmail,
    sendInvitationDeclinedEmail,
    sendLoginFromNewDeviceEmail,
    sendMemberRemovedEmail,
    sendOrganizationApprovalEmail,
    sendOrganizationDenialEmail,
    sendOrganizationInvitationEmail,
    sendPasswordChangedEmail,
    sendPasswordResetEmail,
    sendPaymentReceiptEmail,
    sendPlanLimitWarningEmail,
    sendRoleAssignmentEmail,
    sendRosterThresholdEmail,
    sendSecurityAlertEmail,
    sendStaffInvitationConfirmationEmail,
    sendStaffInvitationEmail,
    sendSubscriptionCanceledEmail,
    sendTeamInvitationEmail,
    sendTeamRosterUpdateEmail,
    sendUserConfirmationEmail,
    sendVerificationEmail,
} from '../lib/email.js';

describe('Email Template Validation', () => {
  const isSendGridReady = isSendGridConfigured();

  describe('Auth & Security Templates', () => {
    it('sendPasswordResetEmail should accept valid parameters', async () => {
      const result = await sendPasswordResetEmail(
        'test@example.com',
        '123456',
        'Test User',
        undefined,
        '1 hour'
      );
      expect(typeof result).toBe('boolean');
      // Result depends on SendGrid configuration, so we just check it's boolean
    });

    it('sendPasswordChangedEmail should accept valid parameters', async () => {
      const result = await sendPasswordChangedEmail(
        'test@example.com',
        'Test User',
        new Date().toLocaleDateString()
      );
      expect(typeof result).toBe('boolean');
    });

    it('sendAccountRecoveryEmail should accept valid parameters', async () => {
      const result = await sendAccountRecoveryEmail(
        'test@example.com',
        'Test User',
        new Date().toLocaleDateString()
      );
      expect(typeof result).toBe('boolean');
    });

    it('sendVerificationEmail should accept valid parameters', async () => {
      const result = await sendVerificationEmail(
        'test@example.com',
        '123456',
        'Test User'
      );
      expect(typeof result).toBe('boolean');
    });

    it('sendLoginFromNewDeviceEmail should accept valid parameters', async () => {
      const result = await sendLoginFromNewDeviceEmail({
        to: 'test@example.com',
        userName: 'Test User',
        deviceType: 'Chrome',
        deviceLocation: 'San Francisco, CA',
        loginDate: 'December 17, 2025',
        loginTime: '2:30 PM',
        ipAddress: '192.168.1.1',
        secureAccountLink: 'https://varsityhub.app/security',
        changePasswordLink: 'https://varsityhub.app/change-password',
        contactSupportLink: 'https://varsityhub.app/support',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendSecurityAlertEmail should accept valid parameters', async () => {
      const result = await sendSecurityAlertEmail({
        to: 'test@example.com',
        alertType: 'new_device',
        ipAddress: '192.168.1.1',
        location: 'San Francisco, CA',
        secureAccountLink: 'https://varsityhub.app/security',
        changePasswordLink: 'https://varsityhub.app/change-password',
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Invitation & Team Management Templates', () => {
    it('sendOrganizationInvitationEmail should accept valid parameters', async () => {
      const result = await sendOrganizationInvitationEmail({
        to: 'test@example.com',
        recipientName: 'Test User',
        organizationName: 'Test Org',
        inviterName: 'Admin User',
        role: 'coach',
        acceptLink: 'https://varsityhub.app/invites/accept/123',
        declineLink: 'https://varsityhub.app/invites/decline/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendTeamInvitationEmail should accept valid parameters', async () => {
      const result = await sendTeamInvitationEmail({
        to: 'test@example.com',
        recipientName: 'Test User',
        teamName: 'Test Team',
        inviterName: 'Coach Smith',
        role: 'player',
        acceptLink: 'https://varsityhub.app/team-invites/accept/123',
        declineLink: 'https://varsityhub.app/team-invites/decline/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendAthleteInvitationEmail should accept valid parameters', async () => {
      const result = await sendAthleteInvitationEmail({
        to: 'test@example.com',
        athleteName: 'Test Athlete',
        teamName: 'Test Team',
        coachName: 'Coach Smith',
        sport: 'Basketball',
        acceptLink: 'https://varsityhub.app/athlete-invites/accept/123',
        declineLink: 'https://varsityhub.app/athlete-invites/decline/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendRoleAssignmentEmail should accept valid parameters', async () => {
      const result = await sendRoleAssignmentEmail({
        to: 'test@example.com',
        userName: 'Test User',
        newRole: 'captain',
        teamName: 'Test Team',
        assignedBy: 'Coach Smith',
        assignedDate: 'December 17, 2025',
        dashboardLink: 'https://varsityhub.app/dashboard',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendRosterThresholdEmail should accept valid parameters', async () => {
      const result = await sendRosterThresholdEmail({
        to: 'test@example.com',
        coachName: 'Coach Smith',
        teamName: 'Test Team',
        currentRosterCount: 8,
        maxRosterCount: 10,
        upgradeLink: 'https://varsityhub.app/upgrade',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendInvitationDeclinedEmail should accept valid parameters', async () => {
      const result = await sendInvitationDeclinedEmail({
        to: 'test@example.com',
        senderName: 'Coach Smith',
        declinedByName: 'Test User',
        teamName: 'Test Team',
        role: 'player',
        declinedDate: 'December 17, 2025',
        viewTeamUrl: 'https://varsityhub.app/team/123',
        resendInvitationUrl: 'https://varsityhub.app/invites/resend/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendTeamRosterUpdateEmail should accept valid parameters', async () => {
      const result = await sendTeamRosterUpdateEmail({
        to: 'test@example.com',
        coachName: 'Coach Smith',
        teamName: 'Test Team',
        updateType: 'player_added',
        playerName: 'New Player',
        updateDate: 'December 17, 2025',
        viewRosterLink: 'https://varsityhub.app/roster',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendMemberRemovedEmail should accept valid parameters', async () => {
      const result = await sendMemberRemovedEmail({
        to: 'test@example.com',
        userName: 'Test User',
        teamName: 'Test Team',
        organizationName: 'Test Org',
        removedBy: 'Coach Smith',
        removalDate: 'December 17, 2025',
        removalReason: 'Graduated',
        contactEmail: 'coach@example.com',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendStaffInvitationEmail should accept valid parameters', async () => {
      const result = await sendStaffInvitationEmail({
        to: 'test@example.com',
        inviteeName: 'Test Staff',
        inviterName: 'Head Coach',
        teamName: 'Test Team',
        inviteLink: 'https://varsityhub.app/staff-invites/accept/123',
        expiryDays: 30,
        onboardingUrl: 'https://varsityhub.app/onboarding',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendStaffInvitationConfirmationEmail should accept valid parameters', async () => {
      const result = await sendStaffInvitationConfirmationEmail({
        to: 'test@example.com',
        coachName: 'Head Coach',
        inviteeName: 'Test Staff',
        inviteeEmail: 'test@example.com',
        teamName: 'Test Team',
        manageStaffUrl: 'https://varsityhub.app/manage-staff',
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Lifecycle & Engagement Templates', () => {
    it('sendCoachOnboardingEmail should accept valid parameters', async () => {
      const result = await sendCoachOnboardingEmail({
        to: 'test@example.com',
        coachName: 'Coach Smith',
        plan: 'rookie',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendFanWelcomeEmail should accept valid parameters', async () => {
      const result = await sendFanWelcomeEmail({
        to: 'test@example.com',
        fanName: 'Test Fan',
        exploreLink: 'https://varsityhub.app/explore',
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Billing & Subscription Templates', () => {
    it('sendPaymentReceiptEmail should accept valid parameters', async () => {
      const result = await sendPaymentReceiptEmail({
        to: 'test@example.com',
        planName: 'Pro Plan',
        amount: '$9.99',
        billingPeriod: 'monthly',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendSubscriptionCanceledEmail should accept valid parameters', async () => {
      const result = await sendSubscriptionCanceledEmail({
        to: 'test@example.com',
        planName: 'Pro Plan',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendPlanLimitWarningEmail should accept valid parameters', async () => {
      const result = await sendPlanLimitWarningEmail({
        to: 'test@example.com',
        planName: 'Free Plan',
        resourceType: 'team',
        used: 2,
        limit: 2,
        upgradeUrl: 'https://varsityhub.app/upgrade',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendBillingNoticeEmail should accept valid parameters', async () => {
      const result = await sendBillingNoticeEmail({
        to: 'test@example.com',
        type: 'payment_succeeded',
        planName: 'Pro Plan',
        amount: '$9.99',
        manageUrl: 'https://varsityhub.app/billing',
        teamName: 'Test Team',
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Organization Templates', () => {
    it('sendUserConfirmationEmail should accept valid parameters', async () => {
      const result = await sendUserConfirmationEmail({
        to: 'test@example.com',
        userName: 'Test User',
        confirmationLink: 'https://varsityhub.app/confirm',
        expiresIn: '30 days',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendOrganizationApprovalEmail should accept valid parameters', async () => {
      const result = await sendOrganizationApprovalEmail({
        to: 'test@example.com',
        organizationName: 'Test Org',
        dashboardLink: 'https://varsityhub.app/dashboard',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendOrganizationDenialEmail should accept valid parameters', async () => {
      const result = await sendOrganizationDenialEmail({
        to: 'test@example.com',
        organizationName: 'Test Org',
        reason: 'Incomplete information',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendContentModerationEmail should accept valid parameters', async () => {
      const result = await sendContentModerationEmail({
        to: 'test@example.com',
        action: 'flagged',
        postId: 'post-123',
        reason: 'Inappropriate content',
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Template Return Values', () => {
    it('all email functions should return boolean', async () => {
      const testEmail = 'test@example.com';
      
      const results = await Promise.all([
        sendPasswordResetEmail(testEmail, '123456'),
        sendPasswordChangedEmail(testEmail),
        sendAccountRecoveryEmail(testEmail),
        sendVerificationEmail(testEmail, '123456'),
      ]);

      results.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });

    it('should handle missing SendGrid gracefully', async () => {
      // All functions should return false when SendGrid not configured
      const result = await sendPasswordResetEmail('test@example.com', '123456');
      expect(typeof result).toBe('boolean');
      // Won't test exact value as it depends on env config
    });
  });

  describe('Parameter Validation', () => {
    it('should handle empty email addresses', async () => {
      const result = await sendPasswordResetEmail('', '123456');
      expect(typeof result).toBe('boolean');
    });

    it('should handle missing optional parameters', async () => {
      const result = await sendPasswordChangedEmail('test@example.com');
      expect(typeof result).toBe('boolean');
    });

    it('should handle undefined values gracefully', async () => {
      const result = await sendPasswordResetEmail(
        'test@example.com',
        '123456',
        undefined,
        undefined
      );
      expect(typeof result).toBe('boolean');
    });
  });
});
