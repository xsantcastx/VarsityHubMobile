/**
 * Handles notification taps with auth guard.
 * Only navigates to protected routes when user is authenticated.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthProvider';
import Notifications from '@/utils/notifications';
import { captureBreadcrumb, captureException } from '@/utils/sentry';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

const devLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args); // eslint-disable-line no-console -- dev-only logging
};

type NotificationPayload = {
  type?: string;
  conversation_id?: string;
  sender_id?: string;
  post_id?: string;
  comment_id?: string;
  follower_id?: string;
  user_id?: string;
  event_id?: string;
  ad_id?: string;
  organization_id?: string;
  team_id?: string;
  game_id?: string;
  [key: string]: unknown;
};

type NotificationResponseLike = {
  notification?: {
    request?: {
      content?: {
        data?: NotificationPayload;
      };
    };
  };
};

export function NotificationTapHandler() {
  const router = useRouter();
  const { user, loading, hasSession } = useAuth();
  const pendingResponseRef = useRef<NotificationResponseLike | null>(null);

  const pushRoute = useCallback((target: string | { pathname: string; params?: Record<string, string> }) => {
    router.push(target as never);
  }, [router]);

  const replaceRoute = useCallback((target: string) => {
    router.replace(target as never);
  }, [router]);

  const processNotificationResponse = useCallback((response: NotificationResponseLike) => {
    const data = response?.notification?.request?.content?.data;

    if (!data || typeof data.type !== 'string') {
      devLog('[Notifications] Received notification with no data');
      return;
    }

    const str = (v: unknown): string | null => (v != null && typeof v === 'string' ? v : null);

    devLog('[Notifications] User tapped notification:', data.type);
    captureBreadcrumb('Push notification tapped', 'notifications.tap', {
      type: data.type,
    });

    // Guard: protected routes require settled auth state.
    const isProtected = !['coach_approved', 'coach_rejected'].includes(data.type);
    if (isProtected && !user) {
      // Cold-start race guard: a valid saved session may still be restoring
      // when the notification tap arrives. Queue the response until auth
      // settles instead of immediately bouncing the user to /sign-in.
      if (loading || hasSession) {
        pendingResponseRef.current = response;
        devLog('[Notifications] Deferring protected notification until auth settles');
        return;
      }

      devLog('[Notifications] User not authenticated, redirecting to sign-in');
      captureBreadcrumb('Push notification redirected to sign-in', 'notifications.tap', {
        type: data.type,
        reason: 'auth-required',
      }, 'warning');
      replaceRoute('/sign-in');
      return;
    }

    try {
      switch (data.type) {
        case 'new_message': {
          const convId = str(data.conversation_id);
          const senderId = str(data.sender_id);
          if (convId) {
            pushRoute(`/message-thread?conversation_id=${encodeURIComponent(convId)}`);
          } else if (senderId) {
            pushRoute(`/message-thread?with=${encodeURIComponent(senderId)}`);
          } else {
            pushRoute('/messages');
          }
          break;
        }

        case 'post_interaction': {
          const postId = str(data.post_id);
          if (postId) {
            pushRoute({ pathname: '/post-detail', params: { id: postId } });
          }
          break;
        }

        case 'mention':
        case 'comment_reply': {
          const postId = str(data.post_id);
          const commentId = str(data.comment_id);
          if (postId) {
            pushRoute({
              pathname: '/post-detail',
              params: { id: postId, ...(commentId ? { commentId } : {}) },
            });
          }
          break;
        }

        case 'new_follower': {
          // Follow acceptance sends user_id; new follows send follower_id
          const userId = str(data.follower_id) || str(data.user_id);
          if (userId) {
            pushRoute({ pathname: '/user-profile', params: { id: userId } });
          }
          break;
        }

        case 'team_invite':
          pushRoute('/team-invites');
          break;

        case 'game_reminder': {
          const eventId = str(data.event_id);
          if (eventId) {
            pushRoute({ pathname: '/event-detail', params: { id: eventId } });
          }
          break;
        }

        case 'coach_request':
          pushRoute('/organization?tab=requests');
          break;

        case 'coach_approved':
          // Route to coach-agreement — AuthProvider will handle onboarding flow
          pushRoute('/onboarding/coach-agreement');
          break;

        case 'coach_rejected':
          pushRoute('/(tabs)');
          break;

        case 'ad_approved': {
          const adId = str(data.ad_id);
          if (adId) {
            pushRoute(`/ad-calendar?adId=${encodeURIComponent(adId)}`);
          }
          break;
        }

        case 'ad_rejected': {
          const adId = str(data.ad_id);
          if (adId) {
            pushRoute(`/ad-calendar?adId=${encodeURIComponent(adId)}`);
          }
          break;
        }

        case 'org_approved':
          // Route through coach-agreement first — AuthProvider will redirect if already accepted
          pushRoute('/onboarding/coach-agreement');
          break;

        case 'org_rejected':
          // Land on league-pending-approval where the rejection reason + Try Again CTA renders
          pushRoute('/onboarding/league-pending-approval');
          break;

        case 'event_approved':
        case 'event_rejected': {
          const eventId = str(data.event_id);
          if (eventId) {
            pushRoute({ pathname: '/event-detail', params: { id: eventId } });
          }
          break;
        }

        case 'post_removed':
          pushRoute('/(tabs)/feed');
          break;

        case 'join_request_approved': {
          const orgId = str(data.organization_id);
          if (orgId) {
            pushRoute({ pathname: '/organization', params: { id: orgId } });
          }
          break;
        }

        case 'team_followed':
        case 'team_invite_accepted':
        case 'team_invite_declined':
        case 'team_role_changed': {
          const teamId = str(data.team_id);
          if (teamId) {
            pushRoute({ pathname: '/team-page', params: { id: teamId } });
          }
          break;
        }

        case 'team_member_removed':
          pushRoute('/(tabs)/feed');
          break;

        case 'event_updated': {
          const evtId = str(data.event_id);
          if (evtId) {
            pushRoute({ pathname: '/event-detail', params: { id: evtId } });
          }
          break;
        }

        case 'event_cancelled':
        case 'game_cancelled':
          pushRoute('/(tabs)/feed');
          break;

        case 'game_story_added': {
          const gameId = str(data.game_id);
          if (gameId) {
            pushRoute({ pathname: '/game/[id]', params: { id: gameId } });
          }
          break;
        }

        default:
          devLog('[Notifications] Unknown notification type:', data.type);
          captureBreadcrumb('Unknown push notification type', 'notifications.tap', {
            type: data.type,
          }, 'warning');
      }
    } catch (error) {
      if (__DEV__) console.error('[Notifications] Navigation error:', error);
      captureException(error, {
        tags: { context: 'notification-tap-navigation' },
        extra: { type: data?.type },
      });
    }
  }, [hasSession, loading, pushRoute, replaceRoute, user]);

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      isExpoGo ||
      !Notifications?.addNotificationResponseReceivedListener
    ) {
      return undefined;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response: NotificationResponseLike) => {
      processNotificationResponse(response);
    });

    return () => {
      subscription.remove();
    };
  }, [processNotificationResponse]);

  useEffect(() => {
    if (loading || !pendingResponseRef.current) return;

    const pending = pendingResponseRef.current;
    if (!user && hasSession) return;

    pendingResponseRef.current = null;
    processNotificationResponse(pending);
  }, [hasSession, loading, processNotificationResponse, user]);

  return null;
}
