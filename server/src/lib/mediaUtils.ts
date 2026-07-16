const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];

export const detectMediaType = (url?: string | null): 'video' | 'image' => {
  if (!url) return 'image';
  const sanitized = url.split('?')[0].split('#')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => sanitized.endsWith(ext)) ? 'video' : 'image';
};

/**
 * Derive a still/animated preview URL for a video.
 * - Cloudinary-uploaded videos: an animated WebP transform of the source.
 * - Other hosts (e.g. R2): a still JPG poster generated via Cloudinary's remote
 *   fetch (Cloudinary pulls the remote video and returns frame 0 as an image).
 *   This is what gives R2-hosted story/highlight videos a thumbnail instead of
 *   a blank tile, and it's server-delivered so it reaches every client
 *   regardless of app build.
 * Returns null for non-video URLs, or when no Cloudinary cloud is configured.
 */
export const getVideoPreviewUrl = (url?: string | null): string | null => {
  if (!url || detectMediaType(url) !== 'video') return null;
  const match = url.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)((?:[^v][^/]*\/)*)?(v\d+\/.+)$/
  );
  if (match) {
    const [, base, , rest] = match;
    return `${base}f_webp,fl_awebp,du_3,so_0,w_480,q_60/${rest}`;
  }
  // Non-Cloudinary video (e.g. R2). Use Cloudinary remote fetch to extract a
  // first-frame JPG poster. Requires an https source URL Cloudinary can reach.
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  if (cloudName && /^https:\/\//i.test(url)) {
    return `https://res.cloudinary.com/${cloudName}/video/fetch/so_0,f_jpg,w_480,q_auto/${encodeURIComponent(url)}`;
  }
  return null;
};

/**
 * Resolve the preview/poster URL for a post — the provider-independence seam.
 * Prefers a stored `poster_url` (uploaded alongside the video for a
 * direct-to-storage provider that can't transform on the fly); falls back to
 * the on-the-fly Cloudinary derivation. Behaviorally identical to the old
 * `getVideoPreviewUrl(post.media_url)` for every post whose poster_url is null.
 *
 * Every post-serialization site must use this rather than calling
 * getVideoPreviewUrl directly, so preview behavior stays consistent as media
 * migrates off Cloudinary (mirrors the client post-mapper consistency rule).
 */
export const resolvePreviewUrl = (post: {
  poster_url?: string | null;
  media_url?: string | null;
}): string | null => post.poster_url ?? getVideoPreviewUrl(post.media_url);
