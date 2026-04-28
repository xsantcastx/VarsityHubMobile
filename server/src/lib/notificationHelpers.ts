export type PostInteractionType = 'like' | 'comment' | 'share';

export function truncatePreview(message: string, limit: number = 100): string {
  return message.substring(0, limit);
}

export function buildNewMessageNotificationPayload(
  senderId: string,
  senderName: string,
  messagePreview: string
) {
  return {
    title: `New message from ${senderName}`,
    body: truncatePreview(messagePreview, 100),
    data: {
      type: 'new_message',
      sender_id: senderId,
      screen: 'messages',
    },
  };
}

export function buildPostInteractionNotificationPayload(
  interactionType: PostInteractionType,
  actorId: string,
  actorName: string,
  postId: string
) {
  const titles: Record<PostInteractionType, string> = {
    like: `${actorName} liked your post`,
    comment: `${actorName} commented on your post`,
    share: `${actorName} shared your post`,
  };

  return {
    title: titles[interactionType],
    body: 'Open the post to see the latest activity.',
    data: {
      type: 'post_interaction',
      interaction_type: interactionType,
      actor_id: actorId,
      post_id: postId,
      screen: 'post-detail',
      post_id_param: postId,
    },
  };
}
