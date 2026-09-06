import { useCallback, useMemo } from 'react';
import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AppLinks, { buildNativeSharePayload, ShareableLink } from '@/utils/links';
import { captureException } from '@/utils/sentry';

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
  onShareSuccess?: (postId: string) => void | Promise<void>;
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

  const link = useMemo(() => formatLink({ caption, id, kind, title }), [caption, id, kind, title]);

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
        return false;
      }
      try {
        const copied = await Clipboard.setStringAsync(link.webUrl);
        if (copied === false) throw new Error('Clipboard write failed');
        if (!silent) Alert.alert('Link copied', 'You can paste it anywhere to share.');
        return true;
      } catch (error) {
        captureException(error, { tags: { context: 'share_copy', kind } });
        if (!silent) Alert.alert('Copy failed', 'Unable to copy the link right now.');
        return false;
      }
    },
    [kind, link]
  );

  const share = useCallback(async () => {
    if (!link) {
      Alert.alert('Share unavailable', 'Link is still loading.');
      return;
    }
    try {
      const result = await Share.share(
        buildNativeSharePayload(contextMessage || link.shareMessage, link.webUrl)
      );
      if (result.action === Share.sharedAction && kind === 'post' && id && onShareSuccess) {
        try {
          await onShareSuccess(String(id));
        } catch (error) {
          // The OS share completed; recording it must not announce a share failure.
          captureException(error, { tags: { context: 'share_tracking', kind } });
        }
      }
    } catch (error) {
      captureException(error, { tags: { context: 'share_sheet', kind } });
      const copied = await copyLink(true);
      Alert.alert(
        'Share unavailable',
        copied
          ? 'Link copied to clipboard so you can paste it manually.'
          : 'Unable to share or copy the link. Please try again.'
      );
    }
  }, [contextMessage, copyLink, id, kind, link, onShareSuccess]);

  return {
    share,
    copyLink,
    shareMessage: contextMessage || link?.shareMessage || '',
    webUrl: link?.webUrl ?? null,
    isReady: !!link,
  };
}

export default useShareLink;
