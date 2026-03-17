/**
 * Handles notification taps with auth guard.
 * Only navigates to protected routes when user is authenticated.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
let Notifications: any = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
}

const devLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

export function NotificationTapHandler() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (isExpoGo || !Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;

      if (!data || typeof data.type !== 'string') {
        devLog('[Notifications] Received notification with no data');
        return;
      }

      const str = (v: unknown): string | null => (v != null && typeof v === 'string' ? v : null);

      devLog('[Notifications] User tapped notification:', data.type);

      // Guard: protected routes require auth
      const isProtected = !['coach_approved'].includes(data.type);
      if (isProtected && !user) {
        devLog('[Notifications] User not authenticated, redirecting to home');
        router.replace('/(tabs)' as any);
        return;
      }

      try {
        switch (data.type) {
          case 'new_message': {
            const convId = str(data.conversation_id);
            const senderId = str(data.sender_id);
            if (convId) {
              router.push(`/(tabs)/message-thread?conversation_id=${encodeURIComponent(convId)}` as any);
            } else if (senderId) {
              router.push(`/(tabs)/message-thread?with=${encodeURIComponent(senderId)}` as any);
            } else {
              router.push('/(tabs)/messages' as any);
            }
            break;
          }

          case 'post_interaction': {
            const postId = str(data.post_id);
            if (postId) {
              router.push({ pathname: '/(tabs)/post-detail', params: { id: postId } } as any);
            }
            break;
          }

          case 'mention':
          case 'comment_reply': {
            const postId = str(data.post_id);
            const commentId = str(data.comment_id);
            if (postId) {
              router.push({
                pathname: '/(tabs)/post-detail',
                params: { id: postId, ...(commentId ? { commentId } : {}) },
              } as any);
            }
            break;
          }

          case 'new_follower': {
            const followerId = str(data.follower_id);
            if (followerId) {
              router.push({ pathname: '/(tabs)/user-profile', params: { userId: followerId } } as any);
            }
            break;
          }

          case 'team_invite':
            router.push('/team-invites' as any);
            break;

          case 'game_reminder': {
            const eventId = str(data.event_id);
            if (eventId) {
              router.push({ pathname: '/(tabs)/event-detail', params: { id: eventId } } as any);
            }
            break;
          }

          case 'coach_request':
            router.push('/(tabs)/approvals' as any);
            break;

          case 'coach_approved':
            router.push('/(tabs)' as any);
            break;

          default:
            devLog('[Notifications] Unknown notification type:', data.type);
        }
      } catch (error) {
        if (__DEV__) console.error('[Notifications] Navigation error:', error);
      }
    });

    return () => subscription.remove();
  }, [router, user]);

  return null;
}
