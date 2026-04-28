import { buildConversationId } from '../lib/messageHelpers';
import {
  buildNewMessageNotificationPayload,
  buildPostInteractionNotificationPayload,
  truncatePreview,
} from '../lib/notificationHelpers';

describe('Messaging helpers', () => {
  it('buildConversationId sorts user ids consistently', () => {
    expect(buildConversationId('user-b', 'user-a')).toBe('dm:user-a__user-b');
    expect(buildConversationId('user-a', 'user-b')).toBe('dm:user-a__user-b');
    expect(buildConversationId('user-a', 'user-a')).toBe('dm:user-a__user-a');
  });
});

describe('Notifications helpers', () => {
  it('truncates previews to 100 characters by default', () => {
    expect(truncatePreview('A'.repeat(150))).toHaveLength(100);
  });

  it('builds new message notification payload', () => {
    const payload = buildNewMessageNotificationPayload('sender-9', 'Coach Kelly', 'A'.repeat(150));
    expect(payload).toMatchObject({
      title: 'New message from Coach Kelly',
      body: 'A'.repeat(100),
      data: {
        type: 'new_message',
        sender_id: 'sender-9',
        screen: 'messages',
      },
    });
  });

  it('builds post interaction payload for comments', () => {
    const payload = buildPostInteractionNotificationPayload('comment', 'user-3', 'Jamie', 'post-42');
    expect(payload).toMatchObject({
      title: 'Jamie commented on your post',
      body: 'Open the post to see the latest activity.',
      data: {
        type: 'post_interaction',
        interaction_type: 'comment',
        actor_id: 'user-3',
        post_id: 'post-42',
        screen: 'post-detail',
        post_id_param: 'post-42',
      },
    });
  });
});
