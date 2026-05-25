export const highlightPostSelect = {
  id: true,
  title: true,
  content: true,
  media_url: true,
  upvotes_count: true,
  created_at: true,
  author_id: true,
  author: { select: { id: true, username: true, display_name: true, avatar_url: true } },
  lat: true,
  lng: true,
  country_code: true,
  _count: { select: { comments: true } },
} as const;
