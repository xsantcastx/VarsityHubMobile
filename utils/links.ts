/**
 * Deep link and web URL generation utilities
 * Provides canonical URLs for sharing events, games, posts, and profiles
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getConfig } from '@/config/env';

const appConfig = getConfig();
const WEB_BASE_URL: string =
  appConfig.webBaseUrl ||
  (Constants?.expoConfig as any)?.extra?.appBaseUrl ||
  appConfig.apiUrl ||
  'https://api-production-8ac3.up.railway.app';
const APP_SCHEME = appConfig.appScheme || 'varsityhubmobile';

export interface ShareableLink {
  /** Universal web URL (for sharing outside the app) */
  webUrl: string;
  /** Deep link URL (for opening in app) */
  deepLink: string;
  /** Shareable message with URL */
  shareMessage: string;
}

/**
 * Payload for React Native's Share.share().
 *
 * iOS: URL only. Passing both `message` and `url` (or a message that contains
 * the URL) makes Messages split the share into a text bubble plus one link
 * chip per URL occurrence — the recipient gets three bubbles. A bare URL
 * renders as a single rich link preview.
 *
 * Android: Share.share() ignores `url`, so the URL must live in the message
 * text (shareMessage already ends with it).
 */
export function buildNativeSharePayload(
  shareMessage: string,
  webUrl: string | null | undefined
): { message: string } | { url: string } {
  if (Platform.OS === 'ios' && webUrl) {
    return { url: webUrl };
  }
  return { message: shareMessage };
}

/**
 * App deep linking utilities
 */
export const AppLinks = {
  /**
   * Generate shareable link for a post/highlight
   */
  post: (id: string, caption?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/posts/${id}`;
    const deepLink = `${APP_SCHEME}://post/${id}`;
    const preview = caption ? caption.substring(0, 100) : 'Check out this post';
    const shareMessage = `${preview}${caption && caption.length > 100 ? '...' : ''}\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate shareable link for a highlight (alias for post)
   */
  highlight: (id: string, caption?: string): ShareableLink => AppLinks.post(id, caption),

  /**
   * Generate shareable link for a game
   */
  game: (idOrSlug: string, title?: string): ShareableLink => {
    const id = String(idOrSlug);
    const webUrl = `${WEB_BASE_URL}/games/${id}`;
    const deepLink = `${APP_SCHEME}://game/${id}`;
    const shareMessage = title
      ? `Check out "${title}" on VarsityHub!\n${webUrl}`
      : `Check out this game on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate shareable link for a team
   */
  team: (id: string, teamName?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/teams/${id}`;
    const deepLink = `${APP_SCHEME}://team/${id}`;
    const shareMessage = teamName
      ? `Follow ${teamName} on VarsityHub!\n${webUrl}`
      : `Check out this team on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate shareable link for a user profile
   */
  user: (id: string, displayName?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/users/${id}`;
    const deepLink = `${APP_SCHEME}://profile/${id}`;
    const shareMessage = displayName
      ? `Check out ${displayName}'s profile on VarsityHub!\n${webUrl}`
      : `Check out this profile on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate shareable link for an event
   */
  event: (idOrSlug: string, title?: string): ShareableLink => {
    const id = String(idOrSlug);
    const webUrl = `${WEB_BASE_URL}/events/${id}`;
    const deepLink = `${APP_SCHEME}://event/${id}`;
    const shareMessage = title
      ? `Check out "${title}" on VarsityHub!\n${webUrl}`
      : `Check out this event on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate shareable link for an organization public page
   */
  organization: (id: string, orgName?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/organizations/${id}`;
    const deepLink = `${APP_SCHEME}://organizations/${id}`;
    const shareMessage = orgName
      ? `Check out ${orgName} on VarsityHub!\n${webUrl}`
      : `Check out this organization on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate invite link for organization
   */
  organizationInvite: (orgId: string, orgName?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/join/org/${orgId}`;
    const deepLink = `${APP_SCHEME}://join/org/${orgId}`;
    const shareMessage = orgName
      ? `Join ${orgName} on VarsityHub!\n${webUrl}`
      : `Join this organization on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },

  /**
   * Generate invite link for team
   */
  teamInvite: (teamId: string, teamName?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/join/team/${teamId}`;
    const deepLink = `${APP_SCHEME}://join/team/${teamId}`;
    const shareMessage = teamName
      ? `Join ${teamName} on VarsityHub!\n${webUrl}`
      : `Join this team on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },
};

/**
 * Parse a deep link URL into route params
 */
export function parseDeepLink(url: string): { type: string; id: string } | null {
  const match = url.match(new RegExp(`${APP_SCHEME}://([^/]+)/(.+)`));
  if (!match) return null;

  const [, type, id] = match;
  return { type, id };
}

/**
 * Check if a URL is a VarsityHub deep link
 */
export function isVarsityHubLink(url: string): boolean {
  return url.startsWith(`${APP_SCHEME}://`) || url.startsWith(WEB_BASE_URL);
}

export default AppLinks;
