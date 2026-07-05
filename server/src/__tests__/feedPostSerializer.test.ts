/**
 * Locks the shared feed/posts serializer so the extraction from routes/feed.ts
 * and routes/posts.ts is provably behavior-preserving. The payload shape is a
 * client contract; a field rename/drop must update these expectations.
 */
import { describe, expect, it } from '@jest/globals';
import {
  serializeFeedPost,
  serializePoll,
  stripSampleGameTitle,
  loadPostInteractionSets,
  type PostInteractionSets,
} from '../lib/feedPostSerializer.js';

const emptySets: PostInteractionSets = {
  upvotedIds: new Set(),
  bookmarkedIds: new Set(),
  followingIds: new Set(),
  pollVoteMap: new Map(),
};

describe('stripSampleGameTitle', () => {
  it('strips the SAMPLE_GAME marker and keeps the remainder', () => {
    expect(stripSampleGameTitle('[SAMPLE_GAME:abc] Real Title')).toBe('Real Title');
  });
  it('passes through a normal title and null', () => {
    expect(stripSampleGameTitle('Normal')).toBe('Normal');
    expect(stripSampleGameTitle(null)).toBeNull();
  });
});

describe('serializePoll', () => {
  it('maps options, totals, and ISO endsAt', () => {
    const poll = {
      id: 'p1',
      options: [
        { id: 'o1', text: 'A', votes_count: 2 },
        { id: 'o2', text: 'B', _count: { votes: 3 } },
      ],
      expires_at: new Date('2026-07-01T00:00:00.000Z'),
    };
    expect(serializePoll(poll, 'Question?', 'o1')).toEqual({
      id: 'p1',
      question: 'Question?',
      options: [
        { id: 'o1', text: 'A', votes: 2 },
        { id: 'o2', text: 'B', votes: 3 },
      ],
      totalVotes: 5,
      endsAt: '2026-07-01T00:00:00.000Z',
      userVote: 'o1',
    });
  });
  it('defaults question to "Poll" and endsAt to undefined', () => {
    const r = serializePoll({ id: 'p', options: [] }, null);
    expect(r.question).toBe('Poll');
    expect(r.endsAt).toBeUndefined();
    expect(r.userVote).toBeNull();
  });
});

describe('serializeFeedPost', () => {
  const post = {
    id: 'post1',
    author_id: 'u1',
    team_id: 't1',
    is_pinned: true,
    title: '[SAMPLE_GAME:x] Hello',
    content: 'body text',
    media_url: 'https://cdn/x.mp4',
    upvotes_count: 4,
    _count: { comments: 2, bookmarks: 1 },
    created_at: new Date('2026-06-01T12:00:00.000Z'),
    author: { id: 'u1', username: 'jane', display_name: 'Jane', avatar_url: 'a.png' },
    team: { id: 't1', name: 'Tigers', logo_url: 'l.png' },
    poll: null,
  };

  it('produces the exact feed payload shape', () => {
    expect(serializeFeedPost(post, emptySets)).toEqual({
      id: 'post1',
      author_id: 'u1',
      team_id: 't1',
      is_pinned: true,
      title: 'Hello',
      content: 'body text',
      media_url: 'https://cdn/x.mp4',
      media_type: 'video',
      preview_url: null,
      caption: 'body text',
      upvotes_count: 4,
      comments_count: 2,
      bookmarks_count: 1,
      created_at: '2026-06-01T12:00:00.000Z',
      // Event/game linkage is part of the contract — every post surface
      // (EventChip) depends on these two fields being present.
      game_id: null,
      event_id: null,
      author: { id: 'u1', username: 'jane', display_name: 'Jane', avatar_url: 'a.png' },
      team: { id: 't1', name: 'Tigers', logo_url: 'l.png' },
      has_upvoted: false,
      has_bookmarked: false,
      is_following_author: false,
      poll: null,
    });
  });

  it('reflects the viewer interaction sets', () => {
    const sets: PostInteractionSets = {
      upvotedIds: new Set(['post1']),
      bookmarkedIds: new Set(['post1']),
      followingIds: new Set(['u1']),
      pollVoteMap: new Map(),
    };
    const out = serializeFeedPost(post, sets);
    expect(out.has_upvoted).toBe(true);
    expect(out.has_bookmarked).toBe(true);
    expect(out.is_following_author).toBe(true);
  });

  it('null-safes missing author/team/counts', () => {
    const out = serializeFeedPost({ id: 'p', author: null, team: null }, emptySets);
    expect(out.author).toBeNull();
    expect(out.team).toBeNull();
    expect(out.comments_count).toBe(0);
    expect(out.is_following_author).toBe(false);
  });
});

describe('loadPostInteractionSets', () => {
  it('returns empty sets with no user (no DB calls)', async () => {
    const prisma = {} as any;
    const sets = await loadPostInteractionSets(prisma, null, {
      postIds: ['a'],
      authorIds: ['u'],
      pollIds: [],
    });
    expect(sets.upvotedIds.size).toBe(0);
    expect(sets.pollVoteMap.size).toBe(0);
  });

  it('returns empty sets with no posts', async () => {
    const prisma = {} as any;
    const sets = await loadPostInteractionSets(prisma, 'u1', {
      postIds: [],
      authorIds: [],
      pollIds: [],
    });
    expect(sets.bookmarkedIds.size).toBe(0);
  });
});
