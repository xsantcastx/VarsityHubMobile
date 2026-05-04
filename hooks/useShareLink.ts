import { useCallback, useMemo } from 'react';
import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AppLinks, { ShareableLink } from '@/utils/links';

export type ShareLinkKind =
  | 'post'
  | 'highlight'
  | 'event'
  | 'game'
  | 'team'
  | 'user'
  | 'organization';

interface ShareLinkOptions {
  kind: ShareLinkKind;
  id?: string | number | null;
  title?: string | null;
  caption?: string | null;
  contextLines?: Array<string | null | undefined>;
  /** Called when user completes a share (e.g. to track share for notifications). Only for kind='post'. */
  onShareSuccess?: (postId: string) => void;
}

const formatLink = (options: ShareLinkOptions): ShareableLink | null => {
  if (options.id == null) return null;
  const id = String(options.id);
  switch (options.kind) {
    case 'post':
      return AppLinks.post(id, options.caption || undefined);
    case 'highlight':
      return AppLinks.highlight(id, options.caption || undefined);
    case 'game':
      return AppLinks.game(id, options.title || undefined);
    case 'event':
      return AppLinks.event(id, options.title || undefined);
    case 'team':
      return AppLinks.team(id, options.title || undefined);
    case 'user':
      return AppLinks.user(id, options.title || undefined);
    case 'organization':
      return AppLinks.organization(id, options.title || undefined);
    default:
      return null;
  }
};

export function useShareLink(options: ShareLinkOptions) {
  const { caption, id, kind, title, contextLines, onShareSuccess } = options;

  const link = useMemo(
    () => formatLink({ caption, id, kind, title }),
    [caption, id, kind, title],
  );

  const contextMessage = useMemo(() => {
    if (!link) return '';
    const lines = (contextLines || []).filter(Boolean) as string[];
    if (!lines.length) return link.shareMessage;
    return `${lines.join('\n')}\n${link.shareMessage}`;
  }, [link, contextLines]);

  const copyLink = useCallback(
    async (silent = false) => {
      if (!link) {
        if (!silent) Alert.alert('Share unavailable', 'Link is still loading.');
        return;
      }
      try {
        await Clipboard.setStringAsync(link.webUrl);
        if (!silent) Alert.alert('Link copied', 'You can paste it anywhere to share.');
      } catch (error) {
        if (__DEV__) console.error('[share] Failed to copy link', error);
        if (!silent) Alert.alert('Copy failed', 'Unable to copy the link right now.');
      }
    },
    [link],
  );

  const share = useCallback(async () => {
    if (!link) {
      Alert.alert('Share unavailable', 'Link is still loading.');
      return;
    }
    try {
      const result = await Share.share({
        message: contextMessage || link.shareMessage,
        url: link.webUrl,
        title: title || link.webUrl,
      });
      if (result.action === Share.sharedAction && kind === 'post' && id && onShareSuccess) {
        onShareSuccess(String(id));
      }
    } catch (error) {
      if (__DEV__) console.warn('[share] Failed to open share sheet', error);
      await copyLink(true);
      Alert.alert('Share unavailable', 'Link copied to clipboard so you can paste it manually.');
    }
  }, [contextMessage, copyLink, id, kind, link, onShareSuccess, title]);

  return {
    share,
    copyLink,
    shareMessage: contextMessage || link?.shareMessage || '',
    webUrl: link?.webUrl ?? null,
    isReady: !!link,
  };
}

export default useShareLink;
