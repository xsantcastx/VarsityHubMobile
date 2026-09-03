import type { FeedPost } from '../app/game-details/GameVerticalFeedScreen';

export function unwrapPostGridItem(item: any) {
  return item?.post || item?.target?.post || item?.target || item;
}

export function buildPostGridViewerState(
  sourceItems: any[],
  index: number,
  unwrapSource: boolean,
  toFeedPost: (item: any) => FeedPost | null
) {
  const sourcePosts = unwrapSource ? sourceItems.map(unwrapPostGridItem) : sourceItems;
  const mapped = sourcePosts.map(toFeedPost);
  const items = mapped.filter(Boolean) as FeedPost[];
  const targetId = sourcePosts[index]?.id;
  const targetIdx = targetId ? items.findIndex(post => post.id === targetId) : index;
  return {
    items,
    index: Math.max(0, targetIdx),
  };
}
