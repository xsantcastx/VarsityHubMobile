/**
 * Share Utilities
 *
 * Provides cross-platform sharing functionality with:
 * - Native share sheet integration
 * - Clipboard fallback for failed shares
 * - Deep link generation for content
 * - UTM tracking for attribution
 *
 * @module utils/share
 */

import { Alert, Platform, Share } from 'react-native';
import { getConfig } from '@/config/env';
import { buildNativeSharePayload } from '@/utils/links';

type ShareOptions = Parameters<typeof Share.share>[1];

// Base URL for share links (update for production)
const SHARE_BASE_URL = `${getConfig().webBaseUrl}/share`;
const APP_SCHEME = getConfig().appScheme || 'varsityhubmobile';

/**
 * Content types that can be shared
 */
type ShareableContent = {
  type: 'post' | 'game' | 'event' | 'team' | 'profile';
  id: string;
  title?: string;
  description?: string;
};

/**
 * Generate a shareable URL with UTM parameters for attribution
 */
export function generateShareUrl(
  content: ShareableContent,
  options?: { source?: string; medium?: string; campaign?: string }
): string {
  const params = new URLSearchParams({
    type: content.type,
    id: content.id,
    utm_source: options?.source || 'app_share',
    utm_medium: options?.medium || 'social',
    ...(options?.campaign && { utm_campaign: options.campaign }),
  });

  return `${SHARE_BASE_URL}?${params.toString()}`;
}

/**
 * Generate a deep link URL for the app
 */
export function generateDeepLink(content: ShareableContent): string {
  return `${APP_SCHEME}://${content.type}/${content.id}`;
}

/**
 * Attempts to invoke the native share sheet and falls back to copying the message.
 */
export async function shareText(message: string, options?: ShareOptions) {
  try {
    const result = await Share.share({ message }, options);
    return result;
  } catch (error) {
    if (__DEV__) console.warn('Share failed, copying to clipboard instead.', error);
    try {
      // Web fallback
      if (Platform.OS === 'web' && 'clipboard' in navigator) {
        await (navigator as any).clipboard.writeText(message);
        Alert.alert('Link Copied', 'Share link copied to clipboard.');
        return null;
      }
      // Dynamic import to avoid hard dependency when native module is missing
      const mod: any = await import('expo-clipboard').catch(() => null);
      const Clipboard = mod?.default || mod;
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(message);
        Alert.alert('Link Copied', 'Share link copied to clipboard.');
        return null;
      }
      // Last resort: invoke Share again to surface UI
      await Share.share({ message });
      return null;
    } catch (clipboardError) {
      if (__DEV__) console.error('Failed to copy share message to clipboard.', clipboardError);
      throw clipboardError;
    }
  }
}

/**
 * Share content with generated URL and proper formatting
 */
export async function shareContent(
  content: ShareableContent,
  customMessage?: string
): Promise<{ shared: boolean; method?: string }> {
  const url = generateShareUrl(content);

  // Build the share message
  let message = customMessage || '';
  if (content.title) {
    message = message ? `${message}\n\n${content.title}` : content.title;
  }
  if (content.description) {
    message = message ? `${message}\n${content.description}` : content.description;
  }
  message = message ? `${message}\n\n${url}` : url;

  try {
    const result = await Share.share(buildNativeSharePayload(message, url), {
      dialogTitle: content.title || 'Share',
      subject: content.title,
    });

    if (result.action === Share.sharedAction) {
      if (__DEV__)
        console.log(
          `[Share] Content shared: ${content.type}/${content.id} via ${result.activityType || 'unknown'}`
        );
      return { shared: true, method: result.activityType || 'share' };
    } else if (result.action === Share.dismissedAction) {
      if (__DEV__) console.log('[Share] User dismissed share sheet');
      return { shared: false, method: 'dismissed' };
    }

    return { shared: false };
  } catch (error) {
    if (__DEV__) console.error('[Share] Native share failed:', error);

    // Fallback to clipboard
    try {
      await copyToClipboard(url);
      return { shared: true, method: 'clipboard' };
    } catch (clipboardError) {
      if (__DEV__) console.warn('[Share] Clipboard fallback also failed:', clipboardError);
      return { shared: false };
    }
  }
}

/**
 * Share a post
 */
export async function sharePost(
  postId: string,
  authorName?: string,
  preview?: string
): Promise<{ shared: boolean; method?: string }> {
  return shareContent(
    {
      type: 'post',
      id: postId,
      title: authorName ? `Check out this post by ${authorName}` : 'Check out this post',
      description: preview?.substring(0, 100),
    },
    '🏆 Check out this post on VarsityHub!'
  );
}

/**
 * Share a game/event
 */
export async function shareGame(
  gameId: string,
  title: string,
  date?: string,
  location?: string
): Promise<{ shared: boolean; method?: string }> {
  let description = '';
  if (date) description += `📅 ${date}`;
  if (location) description += description ? ` · 📍 ${location}` : `📍 ${location}`;

  return shareContent(
    {
      type: 'game',
      id: gameId,
      title,
      description,
    },
    `🏆 Come watch: ${title}!`
  );
}

/**
 * Share a team profile
 */
export async function shareTeam(
  teamId: string,
  teamName: string,
  sport?: string
): Promise<{ shared: boolean; method?: string }> {
  return shareContent(
    {
      type: 'team',
      id: teamId,
      title: teamName,
      description: sport ? `${sport} team` : undefined,
    },
    `🏆 Check out ${teamName} on VarsityHub!`
  );
}

/**
 * Share a user profile
 */
export async function shareProfile(
  userId: string,
  displayName: string,
  bio?: string
): Promise<{ shared: boolean; method?: string }> {
  return shareContent(
    {
      type: 'profile',
      id: userId,
      title: displayName,
      description: bio?.substring(0, 100),
    },
    `👤 Follow ${displayName} on VarsityHub!`
  );
}

export async function copyToClipboard(text: string) {
  try {
    if (Platform.OS === 'web' && 'clipboard' in navigator) {
      await (navigator as any).clipboard.writeText(text);
      Alert.alert('Copied!', 'Text copied to clipboard.');
      return;
    }
    const mod: any = await import('expo-clipboard').catch(() => null);
    const Clipboard = mod?.default || mod;
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', 'Text copied to clipboard.');
      return;
    }
    // Fallback: show share sheet
    await Share.share({ message: text });
  } catch (e) {
    // Silent failure fallback
    try {
      await Share.share({ message: text });
    } catch (shareError) {
      if (__DEV__) console.warn('[Share] Final fallback share failed:', shareError);
    }
  }
}
