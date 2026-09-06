export const highlightPostSelect = {
  id: true,
  title: true,
  content: true,
  media_url: true,
  // Video poster + dimensions — without poster_url the /highlights feed can't
  // derive a thumbnail for R2 videos (getVideoPreviewUrl only handles
  // Cloudinary URLs), so R2 video cards rendered blank. The /feed bundle
  // already selects these; this keeps the two highlight surfaces in parity.
  poster_url: true,
  media_width: true,
  media_height: true,
  media_duration_s: true,
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

export const feedHighlightPostSelect = {
  ...highlightPostSelect,
  _count: { select: { comments: true } },
} as const;
