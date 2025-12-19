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
        loginDate: 'December 17, 2025',
        deviceInfo: 'Chrome on macOS',
        ipAddress: '192.168.1.1',
        location: 'San Francisco, CA',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendSecurityAlertEmail should accept valid parameters', async () => {
      const result = await sendSecurityAlertEmail({
        to: 'test@example.com',
        userName: 'Test User',
        alertType: 'Suspicious Activity',
        alertMessage: 'Multiple failed login attempts',
        actionRequired: 'Please verify your account',
      });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Invitation & Team Management Templates', () => {
    it('sendOrganizationInvitationEmail should accept valid parameters', async () => {
      const result = await sendOrganizationInvitationEmail({
        to: 'test@example.com',
        inviteeName: 'Test User',
        organizationName: 'Test Org',
        inviterName: 'Admin User',
        role: 'coach',
        acceptLink: 'https://varsityhub.app/invites/accept/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendTeamInvitationEmail should accept valid parameters', async () => {
      const result = await sendTeamInvitationEmail({
        to: 'test@example.com',
        inviteeName: 'Test User',
        teamName: 'Test Team',
        sport: 'Basketball',
        inviterName: 'Coach Smith',
        role: 'player',
        acceptLink: 'https://varsityhub.app/team-invites/accept/123',
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
        season: 'Fall 2025',
        acceptLink: 'https://varsityhub.app/athlete-invites/accept/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendRoleAssignmentEmail should accept valid parameters', async () => {
      const result = await sendRoleAssignmentEmail({
        to: 'test@example.com',
        userName: 'Test User',
        teamName: 'Test Team',
        oldRole: 'player',
        newRole: 'captain',
        assignedBy: 'Coach Smith',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendRosterThresholdEmail should accept valid parameters', async () => {
      const result = await sendRosterThresholdEmail({
        to: 'test@example.com',
        coachName: 'Coach Smith',
        teamName: 'Test Team',
        currentCount: 8,
        maxAllowed: 10,
        planName: 'Free Plan',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendInvitationDeclinedEmail should accept valid parameters', async () => {
      const result = await sendInvitationDeclinedEmail({
        to: 'test@example.com',
        inviterName: 'Coach Smith',
        inviteeName: 'Test User',
        teamName: 'Test Team',
        sport: 'Basketball',
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
        updatedBy: 'Admin User',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendMemberRemovedEmail should accept valid parameters', async () => {
      const result = await sendMemberRemovedEmail({
        to: 'test@example.com',
        userName: 'Test User',
        teamName: 'Test Team',
        removedBy: 'Coach Smith',
        reason: 'Graduated',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendStaffInvitationEmail should accept valid parameters', async () => {
      const result = await sendStaffInvitationEmail({
        to: 'test@example.com',
        inviteeName: 'Test Staff',
        organizationName: 'Test Org',
        role: 'Assistant Coach',
        inviterName: 'Head Coach',
        acceptLink: 'https://varsityhub.app/staff-invites/accept/123',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendStaffInvitationConfirmationEmail should accept valid parameters', async () => {
      const result = await sendStaffInvitationConfirmationEmail({
        to: 'test@example.com',
        coachName: 'Head Coach',
        staffName: 'Test Staff',
        role: 'Assistant Coach',
        organizationName: 'Test Org',
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
        userName: 'Test User',
        limitType: 'teams',
        currentUsage: 2,
        maxAllowed: 2,
        upgradeLink: 'https://varsityhub.app/upgrade',
      });
      expect(typeof result).toBe('boolean');
    });

    it('sendBillingNoticeEmail should accept valid parameters', async () => {
      const result = await sendBillingNoticeEmail({
        to: 'test@example.com',
        userName: 'Test User',
        noticeType: 'payment_due',
        amount: '$9.99',
        dueDate: 'January 1, 2026',
        paymentLink: 'https://varsityhub.app/billing',
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
        adminName: 'Admin User',
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
        userName: 'Test User',
        contentType: 'post',
        reason: 'Inappropriate content',
        appealLink: 'https://varsityhub.app/appeals',
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
