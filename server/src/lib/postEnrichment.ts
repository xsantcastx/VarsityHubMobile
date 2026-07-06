import { detectMediaType, getVideoPreviewUrl } from './mediaUtils.js';
import { prisma } from './prisma.js';

export const withMediaPreview = (post: any) => ({
  ...post,
  media_type: detectMediaType(post.media_url),
  preview_url: getVideoPreviewUrl(post.media_url),
});

/**
 * Per-user interaction state for a set of posts. Without this a post payload
 * omits has_upvoted/has_bookmarked, so the client defaults them to false on
 * every refetch and a filled upvote arrow visibly reverts.
 */
export async function getInteractionSets(
  userId: string | null | undefined,
  postIds: string[]
): Promise<{ upvotedIds: Set<string>; bookmarkedIds: Set<string> }> {
  if (!userId || postIds.length === 0) {
    return { upvotedIds: new Set(), bookmarkedIds: new Set() };
  }
  const [upvotes, bookmarks] = await Promise.all([
    prisma.postUpvote.findMany({
      where: { user_id: userId, post_id: { in: postIds } },
      select: { post_id: true },
      take: postIds.length,
    }),
    prisma.postBookmark.findMany({
      where: { user_id: userId, post_id: { in: postIds } },
      select: { post_id: true },
      take: postIds.length,
    }),
  ]);
  return {
    upvotedIds: new Set(upvotes.map(u => u.post_id)),
    bookmarkedIds: new Set(bookmarks.map(b => b.post_id)),
  };
}

export const withInteractions =
  (upvotedIds: Set<string>, bookmarkedIds: Set<string>) => (post: any) => ({
    ...withMediaPreview(post),
    bookmarks_count: post._count?.bookmarks ?? 0,
    has_upvoted: upvotedIds.has(post.id),
    has_bookmarked: bookmarkedIds.has(post.id),
  });
