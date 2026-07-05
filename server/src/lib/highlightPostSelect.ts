export const highlightPostSelect = {
  id: true,
  title: true,
  content: true,
  media_url: true,
  upvotes_count: true,
  created_at: true,
  author_id: true,
  // Event/game linkage — posts are denormalized with both ids at write, and
  // every post surface must be able to offer "open the event page".
  game_id: true,
  event_id: true,
  author: { select: { id: true, username: true, display_name: true, avatar_url: true } },
  lat: true,
  lng: true,
  country_code: true,
  _count: { select: { comments: true, bookmarks: true } },
} as const;
