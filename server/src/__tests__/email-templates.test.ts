import { describe, expect, it } from '@jest/globals';
import {
  isSendGridConfigured,
  sendLoginFromNewDeviceEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
  sendTeamInvitationEmail,
  sendVerificationEmail,
} from '../lib/email.js';

const to = 'test@example.com';

describe('SendGrid email helpers', () => {
  it('isSendGridConfigured returns a boolean', () => {
    expect(typeof isSendGridConfigured()).toBe('boolean');
  });

  it('sendPasswordResetEmail accepts required params', async () => {
    const result = await sendPasswordResetEmail(to, '123456', 'Test User');
    expect(typeof result).toBe('boolean');
  });

  it('sendPasswordChangedEmail accepts required params', async () => {
    const result = await sendPasswordChangedEmail(to, 'Test User', new Date().toISOString());
    expect(typeof result).toBe('boolean');
  });

  it('sendVerificationEmail accepts required params', async () => {
    const result = await sendVerificationEmail(to, '654321', 'Test User');
    expect(typeof result).toBe('boolean');
  });

  it('sendLoginFromNewDeviceEmail accepts required params', async () => {
    const result = await sendLoginFromNewDeviceEmail({
      to,
      userName: 'Test User',
      deviceType: 'Chrome',
      deviceLocation: 'San Francisco, CA',
      loginDate: 'Jan 1, 2025',
      loginTime: '12:00 PM',
      ipAddress: '127.0.0.1',
      secureAccountLink: 'https://varsityhub.app/security',
      changePasswordLink: 'https://varsityhub.app/reset-password',
      contactSupportLink: 'https://varsityhub.app/support',
    });
    expect(typeof result).toBe('boolean');
  });

  it('sendSecurityAlertEmail accepts required params', async () => {
    const result = await sendSecurityAlertEmail({
      to,
      alertType: 'new_device',
      ipAddress: '127.0.0.1',
      location: 'San Francisco, CA',
    });
    expect(typeof result).toBe('boolean');
  });

  it('sendTeamInvitationEmail accepts required params', async () => {
    const result = await sendTeamInvitationEmail({
      to,
      recipientName: 'Test User',
      teamName: 'Test Team',
      inviterName: 'Coach Smith',
      role: 'player',
      acceptLink: 'https://varsityhub.app/team-invites/accept/123',
      declineLink: 'https://varsityhub.app/team-invites/decline/123',
    });
    expect(typeof result).toBe('boolean');
  });
});
