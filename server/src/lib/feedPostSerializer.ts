/**
 * Shared post → feed-response serialization for the feed and posts routes.
 *
 * routes/feed.ts and routes/posts.ts each held byte-identical copies of the
 * same logic (serializePoll, the SAMPLE_GAME title stripper, the per-user
 * interaction-set loader, and the post payload mapper). A field added to one
 * payload but not the other silently diverges the feed depending on which
 * endpoint served it — exactly the class of bug the post-mapper rule guards on
 * the client. This is the single server-side source of truth.
 *
 * Output is intentionally byte-for-byte identical to the former inline copies;
 * see feedPostSerializer.test.ts which locks the payload shape.
 */
import type { PrismaClient } from '@prisma/client';
import { detectMediaType, resolvePreviewUrl } from './mediaUtils.js';

export const serializePoll = (
  poll: any,
  postContent: string | null,
  userVote: string | null = null
) => {
  const options = (poll.options ?? []).map((opt: any) => ({
    id: opt.id,
    text: opt.text,
    votes: opt.votes_count ?? opt._count?.votes ?? 0,
  }));
  const totalVotes = options.reduce((sum: number, o: any) => sum + o.votes, 0);
  return {
    id: poll.id,
    question: postContent || 'Poll',
    options,
    totalVotes,
    endsAt: poll.expires_at
      ? poll.expires_at instanceof Date
        ? poll.expires_at.toISOString()
        : poll.expires_at
      : undefined,
    userVote,
  };
};

/** Strip the internal `[SAMPLE_GAME:…]` marker from a post title. */
export const stripSampleGameTitle = (title: string | null): string | null => {
  if (!title) return null;
  const match = title.match(/^\[SAMPLE_GAME:[^\]]+\]\s*(.*)$/);
  return match ? match[1] || null : title;
};

export type PostInteractionSets = {
  upvotedIds: Set<string>;
  bookmarkedIds: Set<string>;
  followingIds: Set<string>;
  pollVoteMap: Map<string, string>;
};

const emptyInteractionSets = (): PostInteractionSets => ({
  upvotedIds: new Set(),
  bookmarkedIds: new Set(),
  followingIds: new Set(),
  pollVoteMap: new Map(),
});

/**
 * Batch-load the current user's upvote / bookmark / follow / poll-vote state for
 * a page of posts. Returns empty sets when there is no user or no posts.
 */
export async function loadPostInteractionSets(
  prisma: PrismaClient,
  currentUserId: string | null | undefined,
  ids: { postIds: string[]; authorIds: string[]; pollIds: string[] }
): Promise<PostInteractionSets> {
  const { postIds, authorIds, pollIds } = ids;
  if (!currentUserId || !postIds.length) return emptyInteractionSets();

  const followPromise = authorIds.length
    ? prisma.follows.findMany({
        where: { follower_id: currentUserId, following_id: { in: authorIds } },
        select: { following_id: true },
        take: authorIds.length,
      })
    : Promise.resolve([] as Array<{ following_id: string }>);
  const pollVotePromise = pollIds.length
    ? prisma.pollVote.findMany({
        where: { user_id: currentUserId, poll_option: { poll_id: { in: pollIds } } },
        select: { poll_option: { select: { poll_id: true } }, poll_option_id: true },
        take: pollIds.length,
      })
    : Promise.resolve([] as any[]);
  const [upvotes, bookmarks, follows, pollVotes] = await Promise.all([
    prisma.postUpvote.findMany({
      where: { user_id: currentUserId, post_id: { in: postIds } },
      select: { post_id: true },
      take: postIds.length,
    }),
    prisma.postBookmark.findMany({
      where: { user_id: currentUserId, post_id: { in: postIds } },
      select: { post_id: true },
      take: postIds.length,
    }),
    followPromise,
    pollVotePromise,
  ]);
  return {
    upvotedIds: new Set((upvotes as Array<{ post_id: string }>).map(row => row.post_id)),
    bookmarkedIds: new Set((bookmarks as Array<{ post_id: string }>).map(row => row.post_id)),
    followingIds: new Set(
      (follows as Array<{ following_id: string }>).map(row => row.following_id)
    ),
    pollVoteMap: new Map(
      (pollVotes as any[]).map((row: any) => [row.poll_option.poll_id, row.poll_option_id])
    ),
  };
}

/** Map one post row + the viewer's interaction sets to the feed payload shape. */
export function serializeFeedPost(post: any, sets: PostInteractionSets) {
  return {
    id: post.id,
    author_id: post.author_id,
    team_id: post.team_id ?? null,
    // Event/game link, denormalized in both directions at write time. Exposed
    // so the client can render the post's context card and tie the post back
    // to its event/game feed regardless of which column it was created with.
    game_id: post.game_id ?? null,
    event_id: post.event_id ?? null,
    is_pinned: post.is_pinned ?? false,
    title: stripSampleGameTitle(post.title),
    content: post.content ?? null,
    media_url: post.media_url ?? null,
    media_type: detectMediaType(post.media_url),
    preview_url: resolvePreviewUrl(post),
    // Nullable until backfilled/captured; lets the client reserve correct
    // aspect ratio before the media loads (no layout shift).
    media_width: post.media_width ?? null,
    media_height: post.media_height ?? null,
    media_duration_s: post.media_duration_s ?? null,
    caption: post.content ?? null,
    upvotes_count: post.upvotes_count ?? 0,
    comments_count: post._count?.comments ?? 0,
    bookmarks_count: post._count?.bookmarks ?? 0,
    created_at: post.created_at instanceof Date ? post.created_at.toISOString() : post.created_at,
    author: post.author
      ? {
          id: post.author.id,
          username: post.author.username,
          display_name: post.author.display_name,
          avatar_url: post.author.avatar_url,
        }
      : null,
    team: post.team
      ? { id: post.team.id, name: post.team.name, logo_url: post.team.logo_url }
      : null,
    has_upvoted: sets.upvotedIds.has(post.id),
    has_bookmarked: sets.bookmarkedIds.has(post.id),
    is_following_author: post.author ? sets.followingIds.has(post.author.id) : false,
    poll: post.poll
      ? serializePoll(post.poll, post.content, sets.pollVoteMap.get(post.poll.id) || null)
      : null,
  };
}
