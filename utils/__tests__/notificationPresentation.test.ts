/**
 * Regression test: notificationPresentation shared helper
 *
 * Why this exists:
 *   Before this file was extracted, `app/feed.tsx` and `app/(tabs)/notifications/index.tsx`
 *   each had their own inline notification tap-routing switch, and they drifted.
 *   Feed drawer routed UPVOTE/COMMENT/MENTION to the actor's profile instead of
 *   the target post. TEAM_INVITE+coach_approved went to /(tabs) in one and
 *   /(tabs)/create-team in the other. Users tapping the same notification
 *   from two entry points ended up on two different screens.
 *
 * This test pins the contract: for each supported notification type, assert
 * the expected href and title. Both consumers (feed.tsx, notifications/index.tsx)
 * read from this file via getNotificationHref/getNotificationTitle, so any
 * unintended behavior change here shows up as a test failure before shipping.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getNotificationActorLabel,
  getNotificationHref,
  getNotificationSubtitle,
  getNotificationTitle,
  isSystemNotification,
} from '../notificationPresentation';

const makeActor = (overrides: Partial<{ id: string; username: string; display_name: string }> = {}) => ({
  id: overrides.id ?? 'actor-1',
  username: overrides.username ?? 'jane',
  display_name: overrides.display_name ?? 'Jane Doe',
});

describe('getNotificationHref — routing per type', () => {
  it('FOLLOW → actor profile', () => {
    const href = getNotificationHref({ type: 'FOLLOW', actor: makeActor() });
    expect(href).toBe('/user-profile?id=actor-1');
  });

  it('FOLLOW_REQUEST → actor profile', () => {
    const href = getNotificationHref({ type: 'FOLLOW_REQUEST', actor: makeActor() });
    expect(href).toBe('/user-profile?id=actor-1');
  });

  it('UPVOTE → post detail (not actor profile — this was the drift bug)', () => {
    const href = getNotificationHref({
      type: 'UPVOTE',
      actor: makeActor(),
      post: { id: 'post-1' },
    });
    expect(href).toBe('/post-detail?id=post-1');
  });

  it('COMMENT → post detail', () => {
    const href = getNotificationHref({
      type: 'COMMENT',
      actor: makeActor(),
      post: { id: 'post-1' },
    });
    expect(href).toBe('/post-detail?id=post-1');
  });

  it('MENTION with comment id → post detail + commentId query param', () => {
    const href = getNotificationHref({
      type: 'MENTION',
      actor: makeActor(),
      post: { id: 'post-1' },
      comment: { id: 'comment-1' },
    });
    expect(href).toBe('/post-detail?id=post-1&commentId=comment-1');
  });

  it('COMMENT_REPLY with comment id → post detail + commentId query param', () => {
    const href = getNotificationHref({
      type: 'COMMENT_REPLY',
      actor: makeActor(),
      post: { id: 'post-1' },
      comment: { id: 'comment-99' },
    });
    expect(href).toBe('/post-detail?id=post-1&commentId=comment-99');
  });

  it('SHARE → post detail', () => {
    const href = getNotificationHref({
      type: 'SHARE',
      actor: makeActor(),
      post: { id: 'post-1' },
    });
    expect(href).toBe('/post-detail?id=post-1');
  });

  it('MESSAGE → message thread with conversation id', () => {
    const href = getNotificationHref({
      type: 'MESSAGE',
      actor: makeActor(),
      message: { conversation_id: 'conv-1' },
    });
    expect(href).toBe('/message-thread?conversation_id=conv-1');
  });

  it('TEAM_INVITE + coach_request → organization requests tab', () => {
    const href = getNotificationHref({
      type: 'TEAM_INVITE',
      actor: makeActor(),
      meta: { coach_request: true },
    });
    expect(href).toBe('/organization?tab=requests');
  });

  it('TEAM_INVITE + coach_approved → /(tabs)/create-team (was /(tabs) in feed.tsx drift)', () => {
    const href = getNotificationHref({
      type: 'TEAM_INVITE',
      actor: makeActor(),
      meta: { coach_approved: true },
    });
    expect(href).toBe('/(tabs)/create-team');
  });

  it('TEAM_INVITE fallback → /team-invites', () => {
    const href = getNotificationHref({
      type: 'TEAM_INVITE',
      actor: makeActor(),
      meta: {},
    });
    expect(href).toBe('/team-invites');
  });

  it('GAME_REMINDER → event detail using event.id', () => {
    const href = getNotificationHref({
      type: 'GAME_REMINDER',
      event: { id: 'event-1' },
    });
    expect(href).toBe('/event-detail?id=event-1');
  });

  it('GAME_REMINDER → event detail falling back to meta.event_id', () => {
    const href = getNotificationHref({
      type: 'GAME_REMINDER',
      meta: { event_id: 'event-7' },
    });
    expect(href).toBe('/event-detail?id=event-7');
  });

  it('AD_APPROVED → ad calendar', () => {
    const href = getNotificationHref({ type: 'AD_APPROVED', meta: { ad_id: 'ad-1' } });
    expect(href).toBe('/ad-calendar?adId=ad-1');
  });

  it('AD_REJECTED → ad calendar', () => {
    const href = getNotificationHref({ type: 'AD_REJECTED', meta: { ad_id: 'ad-1' } });
    expect(href).toBe('/ad-calendar?adId=ad-1');
  });

  it('ORG_APPROVED → coach-agreement (AuthProvider forwards if already accepted)', () => {
    // Regression lock: this previously pointed at /role-onboarding, which is
    // the role/tier *selection* flow for new users — wrong destination for an
    // already-approved coach. Push-tap handler routes to coach-agreement and
    // this must match. See utils/notificationPresentation.ts.
    const href = getNotificationHref({ type: 'ORG_APPROVED' });
    expect(href).toBe('/onboarding/coach-agreement');
  });

  it('JOIN_REQUEST_APPROVED with org id → organization page', () => {
    const href = getNotificationHref({
      type: 'JOIN_REQUEST_APPROVED',
      meta: { organization_id: 'org-1' },
    });
    expect(href).toBe('/organization?id=org-1');
  });

  it('JOIN_REQUEST_APPROVED with denied flag → tabs (legacy denial shape)', () => {
    const href = getNotificationHref({
      type: 'JOIN_REQUEST_APPROVED',
      meta: { denied: true },
    });
    expect(href).toBe('/(tabs)');
  });

  it('JOIN_REQUEST_DENIED → tabs', () => {
    const href = getNotificationHref({ type: 'JOIN_REQUEST_DENIED' });
    expect(href).toBe('/(tabs)');
  });

  it('COACH_REJECTED → tabs', () => {
    const href = getNotificationHref({ type: 'COACH_REJECTED' });
    expect(href).toBe('/(tabs)');
  });

  it('EVENT_APPROVED with event_id → event detail', () => {
    const href = getNotificationHref({
      type: 'EVENT_APPROVED',
      meta: { event_id: 'event-42' },
    });
    expect(href).toBe('/event-detail?id=event-42');
  });

  it('EVENT_REJECTED with event_id → event detail', () => {
    const href = getNotificationHref({
      type: 'EVENT_REJECTED',
      meta: { event_id: 'event-42' },
    });
    expect(href).toBe('/event-detail?id=event-42');
  });

  it('unknown type with actor → falls back to actor profile', () => {
    const href = getNotificationHref({ type: 'SOMETHING_NEW', actor: makeActor() });
    expect(href).toBe('/user-profile?id=actor-1');
  });

  it('unknown type with no actor → returns null (caller must no-op)', () => {
    const href = getNotificationHref({ type: 'SOMETHING_NEW' });
    expect(href).toBeNull();
  });
});

describe('getNotificationTitle — per type', () => {
  it('prefixes @username when present', () => {
    const title = getNotificationTitle({ type: 'FOLLOW', actor: makeActor({ username: 'bob' }) });
    expect(title).toBe('@bob followed you');
  });

  it('falls back to display_name when username is missing', () => {
    const title = getNotificationTitle({
      type: 'FOLLOW',
      actor: { id: 'x', display_name: 'Bob Bobson' },
    });
    expect(title).toBe('Bob Bobson followed you');
  });

  it('falls back to "Someone" when actor has neither username nor display_name', () => {
    const title = getNotificationTitle({ type: 'FOLLOW', actor: { id: 'x' } });
    expect(title).toBe('Someone followed you');
  });

  it('FOLLOW with follow_rejected meta → declined request phrasing', () => {
    const title = getNotificationTitle({
      type: 'FOLLOW',
      actor: makeActor({ username: 'bob' }),
      meta: { follow_rejected: true },
    });
    expect(title).toBe('@bob declined your follow request');
  });

  it('UPVOTE → "upvoted your post"', () => {
    const title = getNotificationTitle({ type: 'UPVOTE', actor: makeActor() });
    expect(title).toBe('@jane upvoted your post');
  });

  it('MESSAGE → "sent you a message"', () => {
    const title = getNotificationTitle({ type: 'MESSAGE', actor: makeActor() });
    expect(title).toBe('@jane sent you a message');
  });

  it('GAME_REMINDER uses event.title when present', () => {
    const title = getNotificationTitle({
      type: 'GAME_REMINDER',
      event: { id: 'e', title: 'Cats vs Dogs' },
    });
    expect(title).toBe('Game reminder: Cats vs Dogs');
  });

  it('unknown type with no actor → generic fallback', () => {
    const title = getNotificationTitle({ type: 'DEFINITELY_NOT_A_REAL_TYPE' });
    expect(title).toBe('New notification');
  });

  it('unknown type with an actor → identifies the actor', () => {
    const title = getNotificationTitle({
      type: 'DEFINITELY_NOT_A_REAL_TYPE',
      actor: { username: 'jane' },
    });
    expect(title).toBe('@jane sent you a notification');
  });
});

describe('notification presentation helpers', () => {
  it('prefers @username for actor labels', () => {
    expect(getNotificationActorLabel({ actor: makeActor({ username: 'varsity' }) })).toBe('@varsity');
  });

  it('falls back to display_name for actor labels', () => {
    expect(getNotificationActorLabel({ actor: { display_name: 'Varsity Coach' } })).toBe('Varsity Coach');
  });

  it('returns post content as the shared subtitle when present', () => {
    expect(getNotificationSubtitle({
      type: 'COMMENT',
      post: { id: 'post-1', content: 'Big win tonight at home.' },
    })).toBe('Big win tonight at home.');
  });

  it('falls back to message preview when post content is unavailable', () => {
    expect(getNotificationSubtitle({
      type: 'MESSAGE',
      message: { conversation_id: 'conv-1', content: 'Meet by the gym at 6:30.' } as any,
    })).toBe('Meet by the gym at 6:30.');
  });

  it('uses event title for reminder-style notifications', () => {
    expect(getNotificationSubtitle({
      type: 'GAME_REMINDER',
      event: { id: 'event-1', title: 'Varsity vs Central' },
    })).toBe('Varsity vs Central');
  });

  it('uses organization metadata for approval notifications', () => {
    expect(getNotificationSubtitle({
      type: 'ORG_APPROVED',
      meta: { organization_name: 'North Ridge League' },
    })).toBe('North Ridge League');
  });
});

describe('isSystemNotification', () => {
  it.each([
    ['GAME_REMINDER'],
    ['ORG_APPROVED'],
    ['AD_APPROVED'],
    ['AD_REJECTED'],
    ['EVENT_APPROVED'],
    ['EVENT_REJECTED'],
    ['COACH_REJECTED'],
    ['JOIN_REQUEST_APPROVED'],
    ['JOIN_REQUEST_DENIED'],
  ])('%s is a system notification', (type) => {
    expect(isSystemNotification({ type })).toBe(true);
  });

  it.each([
    ['FOLLOW'],
    ['UPVOTE'],
    ['COMMENT'],
    ['MESSAGE'],
    ['TEAM_INVITE'],
  ])('%s is NOT a system notification (actor-driven)', (type) => {
    expect(isSystemNotification({ type })).toBe(false);
  });
});
