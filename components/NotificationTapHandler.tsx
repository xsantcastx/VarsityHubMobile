/**
 * Handles notification taps with auth guard.
 * Only navigates to protected routes when user is authenticated.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthProvider';
import Notifications from '@/utils/notifications';
import { captureBreadcrumb, captureException } from '@/utils/sentry';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

const devLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args); // eslint-disable-line no-console -- dev-only logging
};

export function NotificationTapHandler() {
  const router = useRouter();
  const { user, loading, hasSession } = useAuth();
  const pendingResponseRef = useRef<any | null>(null);

  const processNotificationResponse = useCallback((response: any) => {
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
      router.replace('/sign-in' as any);
      return;
    }

    try {
      switch (data.type) {
        case 'new_message': {
          const convId = str(data.conversation_id);
          const senderId = str(data.sender_id);
          if (convId) {
            router.push(`/message-thread?conversation_id=${encodeURIComponent(convId)}` as any);
          } else if (senderId) {
            router.push(`/message-thread?with=${encodeURIComponent(senderId)}` as any);
          } else {
            router.push('/messages' as any);
          }
          break;
        }

        case 'post_interaction': {
          const postId = str(data.post_id);
          if (postId) {
            router.push({ pathname: '/post-detail', params: { id: postId } } as any);
          }
          break;
        }

        case 'mention':
        case 'comment_reply': {
          const postId = str(data.post_id);
          const commentId = str(data.comment_id);
          if (postId) {
            router.push({
              pathname: '/post-detail',
              params: { id: postId, ...(commentId ? { commentId } : {}) },
            } as any);
          }
          break;
        }

        case 'new_follower': {
          // Follow acceptance sends user_id; new follows send follower_id
          const userId = str(data.follower_id) || str(data.user_id);
          if (userId) {
            router.push({ pathname: '/user-profile', params: { id: userId } } as any);
          }
          break;
        }

        case 'team_invite':
          router.push('/team-invites' as any);
          break;

        case 'game_reminder': {
          const eventId = str(data.event_id);
          if (eventId) {
            router.push({ pathname: '/event-detail', params: { id: eventId } } as any);
          }
          break;
        }

        case 'coach_request':
          router.push('/approvals' as any);
          break;

        case 'coach_approved':
          // Route to coach-agreement — AuthProvider will handle onboarding flow
          router.push('/onboarding/coach-agreement' as any);
          break;

        case 'coach_rejected':
          router.push('/(tabs)' as any);
          break;

        case 'ad_approved': {
          const adId = str(data.ad_id);
          if (adId) {
            router.push(`/ad-calendar?adId=${encodeURIComponent(adId)}` as any);
          }
          break;
        }

        case 'ad_rejected': {
          const adId = str(data.ad_id);
          if (adId) {
            router.push(`/ad-calendar?adId=${encodeURIComponent(adId)}` as any);
          }
          break;
        }

        case 'org_approved':
          // Route through coach-agreement first — AuthProvider will redirect if already accepted
          router.push('/onboarding/coach-agreement' as any);
          break;

        case 'org_rejected':
          // Land on league-pending-approval where the rejection reason + Try Again CTA renders
          router.push('/onboarding/league-pending-approval' as any);
          break;

        case 'event_approved':
        case 'event_rejected': {
          const eventId = str(data.event_id);
          if (eventId) {
            router.push({ pathname: '/event-detail', params: { id: eventId } } as any);
          }
          break;
        }

        case 'post_removed':
          router.push('/(tabs)/feed' as any);
          break;

        case 'join_request_approved': {
          const orgId = str(data.organization_id);
          if (orgId) {
            router.push({ pathname: '/organization', params: { id: orgId } } as any);
          }
          break;
        }

        case 'team_followed':
        case 'team_invite_accepted':
        case 'team_invite_declined':
        case 'team_role_changed': {
          const teamId = str(data.team_id);
          if (teamId) {
            router.push({ pathname: '/team-page', params: { id: teamId } } as any);
          }
          break;
        }

        case 'team_member_removed':
          router.push('/(tabs)/feed' as any);
          break;

        case 'event_updated': {
          const evtId = str(data.event_id);
          if (evtId) {
            router.push({ pathname: '/event-detail', params: { id: evtId } } as any);
          }
          break;
        }

        case 'event_cancelled':
        case 'game_cancelled':
          router.push('/(tabs)/feed' as any);
          break;

        case 'game_story_added': {
          const gameId = str(data.game_id);
          if (gameId) {
            router.push({ pathname: '/game', params: { id: gameId } } as any);
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
  }, [hasSession, loading, router, user]);

  useEffect(() => {
    if (isExpoGo || !Notifications?.addNotificationResponseReceivedListener) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      processNotificationResponse(response);
    });

    return () => subscription.remove();
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
