/**
 * Email Invite Tests
 *
 * Tests sendTeamInviteEmail function.
 */

import { describe, it, expect, jest } from '@jest/globals';

// Capture and clear test-env markers BEFORE email module loads,
// so the module-level `isTestEnv` constant evaluates to false.
const savedNodeEnv = process.env.NODE_ENV;
const savedJestWorker = process.env.JEST_WORKER_ID;
process.env.NODE_ENV = 'development';
delete process.env.JEST_WORKER_ID;

// Mock the email service so no real sends happen
const mockSend = jest.fn(async () => ({ success: true }));
jest.unstable_mockModule('../services/email/service.js', () => ({
  getEmailService: jest.fn(async () => ({
    isConfigured: () => true,
    send: mockSend,
  })),
}));

// Set template ID so sendTeamInviteEmail doesn't bail early
process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = 'd-0123456789abcdef0123456789abcdef';

// Dynamic import after mocks and env overrides are in place
const { sendTeamInviteEmail } = await import('../lib/email.js');

// Restore env after module is loaded
process.env.NODE_ENV = savedNodeEnv;
process.env.JEST_WORKER_ID = savedJestWorker;

describe('Email Invite Functions', () => {
  describe('sendTeamInviteEmail', () => {
    it('should return true and include inviteToken in the canonical join URL', async () => {
      mockSend.mockClear();

      const result = await sendTeamInviteEmail({
        to: 'player@example.com',
        teamName: 'Test Eagles',
        recipientName: 'Player One',
        inviterName: 'Coach Smith',
        inviteToken: 'test-token-123',
      });

      expect(result).toBe(true);

      // Verify invite_url contains the token
      expect(mockSend).toHaveBeenCalledTimes(1);
      const payload = mockSend.mock.calls[0]![0] as any;
      expect(payload.templateData.acceptLink).toBe('https://varsityhub.app/join/team/test-token-123');
      expect(payload.templateData.invite_url).toBe('https://varsityhub.app/join/team/test-token-123');
    });
  });
});
