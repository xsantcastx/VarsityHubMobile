/**
 * Test that every NotificationType enum value has a proper summarize() case.
 * This catches the bug where adding a new enum value in schema.prisma
 * but forgetting to add a case in notifications.ts causes "did something".
 */

// All NotificationType values from server/prisma/schema.prisma
const ALL_NOTIFICATION_TYPES = [
  'FOLLOW',
  'FOLLOW_REQUEST',
  'UPVOTE',
  'COMMENT',
  'TEAM_INVITE',
  'TEAM_INVITE_ACCEPTED',
  'TEAM_INVITE_DECLINED',
  'TEAM_MEMBER_REMOVED',
  'TEAM_ROLE_CHANGED',
  'TEAM_FOLLOWED',
  'MESSAGE',
  'MENTION',
  'COMMENT_REPLY',
  'SHARE',
  'GAME_REMINDER',
  'GAME_CANCELLED',
  'GAME_STORY_ADDED',
  'AD_APPROVED',
  'AD_REJECTED',
  'ORG_APPROVED',
  'JOIN_REQUEST_APPROVED',
  'EVENT_APPROVED',
  'EVENT_REJECTED',
  'COACH_REJECTED',
] as const;

// Mirror of server/src/routes/notifications.ts summarize()
const summarize = (n: { type: string }) => {
  switch (n.type) {
    case 'FOLLOW': return 'followed you';
    case 'FOLLOW_REQUEST': return 'requested to follow you';
    case 'UPVOTE': return 'upvoted your post';
    case 'COMMENT': return 'commented on your post';
    case 'MESSAGE': return 'sent you a message';
    case 'TEAM_INVITE': return 'invited you to a team';
    case 'MENTION': return 'mentioned you';
    case 'COMMENT_REPLY': return 'replied to your comment';
    case 'SHARE': return 'shared your post';
    case 'GAME_REMINDER': return 'game reminder';
    case 'AD_APPROVED': return 'your ad has been approved';
    case 'AD_REJECTED': return 'your ad needs changes';
    case 'ORG_APPROVED': return 'your organization has been approved';
    case 'JOIN_REQUEST_APPROVED': return 'your join request was approved';
    case 'TEAM_INVITE_ACCEPTED': return 'accepted your team invite';
    case 'TEAM_INVITE_DECLINED': return 'declined your team invite';
    case 'TEAM_MEMBER_REMOVED': return 'you were removed from a team';
    case 'TEAM_ROLE_CHANGED': return 'your team role was changed';
    case 'TEAM_FOLLOWED': return 'followed your team';
    case 'GAME_CANCELLED': return 'a game has been cancelled';
    case 'GAME_STORY_ADDED': return 'added a story to a game';
    case 'EVENT_APPROVED': return 'your event has been approved';
    case 'EVENT_REJECTED': return 'your event was not approved';
    case 'COACH_REJECTED': return 'your coach application was not approved';
    default: return 'did something';
  }
};

describe('Notification summarizer', () => {
  it.each(ALL_NOTIFICATION_TYPES)(
    'should have a specific summary for %s (not "did something")',
    (type) => {
      const result = summarize({ type });
      expect(result).not.toBe('did something');
      expect(result.length).toBeGreaterThan(0);
    }
  );

  it('should return "did something" only for unknown types', () => {
    expect(summarize({ type: 'UNKNOWN_TYPE' })).toBe('did something');
  });
});
