/**
 * Single source of truth for "is this URL an asset we host?"
 *
 * This allowlist previously existed as six inline copies (auth ×2, posts,
 * games, teams, organizations ×3). When the R2 media migration went live
 * (2026-07-13) only the posts.ts copy was taught about R2, so every other
 * surface began rejecting the R2 URLs the uploader had already started
 * returning — profile pictures could not be saved at all. Keep this the only
 * copy; `media-host-allowlist.test.ts` fails the build if a route re-declares
 * one inline.
 */

// Hosts we upload to.
const PLATFORM_HOSTS = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app'];

// OAuth providers hand us a profile picture URL on their own CDN at sign-in.
// Valid for user avatars only — a post or a team logo must never point here.
const OAUTH_AVATAR_HOSTS = [
  'lh3.googleusercontent.com',
  'platform-lookaside.fbsbx.com',
  'graph.facebook.com',
];

/**
 * R2 is resolved from env on every call rather than at module load, so setting
 * R2_PUBLIC_BASE_URL on a running deploy takes effect immediately and tests can
 * toggle it. A malformed value is ignored rather than throwing.
 */
function allowedHosts(extra: string[]): string[] {
  const hosts = [...PLATFORM_HOSTS, ...extra];
  const r2base = (process.env.R2_PUBLIC_BASE_URL || '').trim();
  if (r2base) {
    try {
      hosts.push(new URL(r2base).hostname);
    } catch {
      /* ignore malformed env */
    }
  }
  return hosts;
}

/**
 * Exact host or a true subdomain. A bare `endsWith` would accept an
 * attacker-registered `evil-varsityhub.app`, which is what the old inline
 * copies did.
 */
function hostAllowed(hostname: string, extra: string[] = []): boolean {
  return allowedHosts(extra).some(h => hostname === h || hostname.endsWith(`.${h}`));
}

/**
 * Post/story/game media. A data: URI or a relative path is processed
 * server-side and passes; an absolute off-platform URL is rejected — otherwise
 * a fan could point media at an arbitrary host for viewer-IP tracking or to
 * bypass the upload moderation + delete-cleanup pipeline. Audit 2026-07-14.
 */
export function isAllowedMediaUrl(value: string): boolean {
  const v = value.trim();
  if (v.startsWith('data:')) return true;
  if (v.startsWith('//')) return false; // protocol-relative → treated as network URL
  if (!/^https?:\/\//i.test(v)) return true; // relative/local path, processed server-side
  try {
    const parsed = new URL(v);
    if (parsed.protocol !== 'https:') return false;
    return hostAllowed(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * An uploaded asset that must be a bare absolute https URL — team/org logos,
 * banners, story media. No data:/relative forms.
 */
export function isAllowedAssetUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:') return false;
    return hostAllowed(parsed.hostname);
  } catch {
    return false;
  }
}

/** A user avatar: an uploaded asset, or a picture from an OAuth provider CDN. */
export function isAllowedAvatarUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:') return false;
    return hostAllowed(parsed.hostname, OAUTH_AVATAR_HOSTS);
  } catch {
    return false;
  }
}

export const AVATAR_URL_MESSAGE = {
  message: 'Avatar URL must be an uploaded VarsityHub asset',
};
export const MEDIA_URL_MESSAGE = { message: 'media url must be an uploaded VarsityHub asset' };
export const ASSET_URL_MESSAGE = { message: 'Image URL must be an uploaded VarsityHub asset' };
