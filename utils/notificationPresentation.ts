type NotificationActor = {
  id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type NotificationItem = {
  type?: string | null;
  actor?: NotificationActor | null;
  post?: { id?: string | null } | null;
  comment?: { id?: string | null } | null;
  message?: { conversation_id?: string | null } | null;
  event?: { id?: string | null; title?: string | null } | null;
  meta?: Record<string, any> | null;
};

const SYSTEM_NOTIFICATION_TYPES = new Set([
  'GAME_REMINDER',
  'ORG_APPROVED',
  'ORG_REJECTED',
  'AD_APPROVED',
  'AD_REJECTED',
  'EVENT_APPROVED',
  'EVENT_REJECTED',
  'COACH_REJECTED',
  'JOIN_REQUEST_APPROVED',
  'JOIN_REQUEST_DENIED',
]);

const actorName = (item: NotificationItem) =>
  item.actor?.username ? `@${item.actor.username}` : item.actor?.display_name || 'Someone';

export function isSystemNotification(item: NotificationItem) {
  return SYSTEM_NOTIFICATION_TYPES.has(String(item.type || ''));
}

export function getNotificationTitle(item: NotificationItem) {
  const name = actorName(item);
  const type = String(item.type || '');

  if (type === 'FOLLOW' && item.meta?.follow_rejected) return `${name} declined your follow request`;
  if (type === 'FOLLOW') return `${name} followed you`;
  if (type === 'FOLLOW_REQUEST') return `${name} requested to follow you`;
  if (type === 'UPVOTE') return `${name} upvoted your post`;
  if (type === 'COMMENT') return `${name} commented on your post`;
  if (type === 'MESSAGE') return `${name} sent you a message`;
  if (type === 'TEAM_INVITE' && item.meta?.coach_approved) {
    return `${item.meta?.organization_name || 'A league'} approved your coach application`;
  }
  if (type === 'TEAM_INVITE' && item.meta?.coach_request) {
    return `${item.meta?.coach_name || name} wants to join ${item.meta?.organization_name || 'your league'}`;
  }
  if (type === 'TEAM_INVITE') return `${name} invited you to a team`;
  if (type === 'MENTION') return `${name} mentioned you`;
  if (type === 'COMMENT_REPLY') return `${name} replied to your comment`;
  if (type === 'SHARE') return `${name} shared your post`;
  if (type === 'GAME_REMINDER') {
    return `Game reminder: ${(item.event?.title || item.meta?.event_title) || 'Your game'}`;
  }
  if (type === 'AD_APPROVED') {
    return `Your ad${item.meta?.business_name ? ` for "${item.meta.business_name}"` : ''} has been approved! Tap to complete payment.`;
  }
  if (type === 'AD_REJECTED') {
    return `Your ad${item.meta?.business_name ? ` for "${item.meta.business_name}"` : ''} needs changes.${item.meta?.reason ? ` ${item.meta.reason}` : ' Please review and resubmit.'}`;
  }
  if (type === 'ORG_APPROVED') {
    return `Your organization${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} has been approved!`;
  }
  if (type === 'ORG_REJECTED') {
    return `Your organization${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`;
  }
  if (type === 'JOIN_REQUEST_APPROVED') {
    return item.meta?.denied
      ? `Your request to join${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`
      : `Your request to join${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} was approved!`;
  }
  if (type === 'JOIN_REQUEST_DENIED') {
    return `Your request to join${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`;
  }
  if (type === 'EVENT_APPROVED') {
    return `Your event${item.meta?.event_title ? ` "${item.meta.event_title}"` : ''} has been approved!`;
  }
  if (type === 'EVENT_REJECTED') {
    return `Your event${item.meta?.event_title ? ` "${item.meta.event_title}"` : ''} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`;
  }
  if (type === 'COACH_REJECTED') {
    return `Your application to join ${item.meta?.organization_name || 'the league'} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`;
  }

  // v1.0.3: previously unknown/missing types showed a bare "Notification"
  // label — useless for the user and indistinguishable from other items.
  // If we have an actor, at least identify them; otherwise fall through to
  // a clearer generic string.
  if (item.actor?.username || item.actor?.display_name) {
    return `${name} sent you a notification`;
  }
  return 'New notification';
}

export function getNotificationHref(item: NotificationItem): any | null {
  const type = String(item.type || '');

  if ((type === 'FOLLOW' || type === 'FOLLOW_REQUEST') && item.actor?.id) {
    return `/user-profile?id=${encodeURIComponent(item.actor.id)}`;
  }
  if (
    (type === 'UPVOTE' || type === 'COMMENT' || type === 'MENTION' || type === 'COMMENT_REPLY' || type === 'SHARE') &&
    item.post?.id
  ) {
    const commentId =
      (type === 'MENTION' || type === 'COMMENT_REPLY') && item.comment?.id
        ? `&commentId=${encodeURIComponent(item.comment.id)}`
        : '';
    return `/post-detail?id=${encodeURIComponent(item.post.id)}${commentId}`;
  }
  if (type === 'MESSAGE' && item.message?.conversation_id) {
    return `/message-thread?conversation_id=${encodeURIComponent(item.message.conversation_id)}`;
  }
  if (type === 'TEAM_INVITE' && item.meta?.coach_request) {
    return '/approvals';
  }
  if (type === 'TEAM_INVITE' && item.meta?.coach_approved) {
    return '/(tabs)/create-team';
  }
  if (type === 'TEAM_INVITE') {
    return '/team-invites';
  }
  if (
    (type === 'GAME_REMINDER' || type === 'EVENT_APPROVED' || type === 'EVENT_REJECTED') &&
    (item.event?.id || item.meta?.event_id)
  ) {
    return `/event-detail?id=${encodeURIComponent(item.event?.id || item.meta?.event_id || '')}`;
  }
  if ((type === 'AD_APPROVED' || type === 'AD_REJECTED') && item.meta?.ad_id) {
    return `/ad-calendar?adId=${encodeURIComponent(item.meta.ad_id)}`;
  }
  if (type === 'ORG_APPROVED') {
    // Route through coach-agreement — AuthProvider forwards if already
    // accepted. `/role-onboarding` (the previous target) is the role/tier
    // selection flow for new users, not the continuation path for an
    // approved coach. See components/NotificationTapHandler.tsx for the
    // push-tap side that this now matches.
    return '/onboarding/coach-agreement';
  }
  if (type === 'ORG_REJECTED') {
    return '/onboarding/league-pending-approval';
  }
  if (type === 'JOIN_REQUEST_APPROVED') {
    return item.meta?.denied
      ? '/(tabs)'
      : item.meta?.organization_id
        ? `/organization?id=${encodeURIComponent(item.meta.organization_id)}`
        : '/(tabs)';
  }
  if (type === 'JOIN_REQUEST_DENIED') {
    return '/(tabs)';
  }
  if (type === 'COACH_REJECTED') {
    return '/(tabs)';
  }

  return item.actor?.id ? `/user-profile?id=${encodeURIComponent(item.actor.id)}` : null;
}
