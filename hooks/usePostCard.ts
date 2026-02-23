import { Post } from '@/api/entities';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

export interface UsePostCardParams {
  postId: string;
  post: any;
  onDeleted?: (postId: string) => void;
  onUpdated?: (updatedPost: any) => void;
  onEditSuccess?: () => void; // e.g. close modal, show success toast
}

export interface UsePostCardResult {
  upvotesCount: number;
  bookmarksCount: number;
  bookmarked: boolean;
  updating: boolean;
  editContent: string;
  setEditContent: React.Dispatch<React.SetStateAction<string>>;
  editTitle: string;
  setEditTitle: React.Dispatch<React.SetStateAction<string>>;
  onUpvote: () => Promise<void>;
  onBookmark: () => Promise<void>;
  handleDeletePost: () => void;
  handleEditPost: () => Promise<void>;
}

export function usePostCard({
  postId,
  post,
  onDeleted,
  onUpdated,
  onEditSuccess,
}: UsePostCardParams): UsePostCardResult {
  const [upvotesCount, setUpvotesCount] = useState(post.upvotes_count || 0);
  const [bookmarksCount, setBookmarksCount] = useState(post.bookmarks_count || 0);
  const [bookmarked, setBookmarked] = useState(!!post.has_bookmarked);
  const [updating, setUpdating] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editTitle, setEditTitle] = useState(post.title || '');
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const onUpvote = useCallback(async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const r: any = await Post.toggleUpvote(String(postId));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count);
      }
    } catch {}
  }, [postId]);

  const onBookmark = useCallback(async () => {
    try {
      void Haptics.selectionAsync().catch(() => {});
      const r: any = await Post.toggleBookmark(String(postId));
      if (r && typeof r.bookmarks_count === 'number') {
        setBookmarksCount(r.bookmarks_count);
      }
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch {}
  }, [postId]);

  const handleDeletePost = useCallback(() => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await Post.delete(String(postId));
              const undoUntil = res?.undo_until ? new Date(res.undo_until).getTime() : null;
              const timeoutMs = undoUntil ? Math.max(0, undoUntil - Date.now()) : 5000;
              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
              deleteTimerRef.current = setTimeout(() => {
                onDeleted?.(String(postId));
              }, timeoutMs || 1);
              Alert.alert(
                'Post deleted',
                'You can undo this action for a short time.',
                [
                  {
                    text: 'Undo',
                    onPress: async () => {
                      if (deleteTimerRef.current) {
                        clearTimeout(deleteTimerRef.current);
                        deleteTimerRef.current = null;
                      }
                      try {
                        const restored = await Post.restore(String(postId));
                        onUpdated?.(restored);
                      } catch (restoreError: any) {
                        onDeleted?.(String(postId));
                        Alert.alert('Error', restoreError?.message || 'Restore window expired.');
                      }
                    },
                  },
                  { text: 'Dismiss', style: 'cancel' },
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete post');
            }
          }
        }
      ]
    );
    }, [postId, onDeleted, onUpdated]);

  const handleEditPost = useCallback(async () => {
    if (!editContent.trim() && !editTitle.trim()) {
      Alert.alert('Error', 'Post must have content or title');
      return;
    }
    setUpdating(true);
    try {
      const updateData: { content?: string; title?: string } = {};
      if (editContent.trim()) updateData.content = editContent.trim();
      if (editTitle.trim()) updateData.title = editTitle.trim();
      await Post.update(String(postId), updateData);
      onUpdated?.({ ...post, ...updateData });
      onEditSuccess?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update post');
    } finally {
      setUpdating(false);
    }
  }, [postId, post, editContent, editTitle, onUpdated, onEditSuccess]);

  return {
    upvotesCount,
    bookmarksCount,
    bookmarked,
    updating,
    editContent,
    setEditContent,
    editTitle,
    setEditTitle,
    onUpvote,
    onBookmark,
    handleDeletePost,
    handleEditPost,
  };
}
