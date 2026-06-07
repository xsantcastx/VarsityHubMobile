import { Post, Report } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { promptForSignIn } from '@/utils/requireSignIn';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

export const REPORT_REASONS = [
  { value: 'copyright', label: 'Copyright / broadcast footage' },
  { value: 'impersonation', label: 'Unauthorized use of my likeness' },
  { value: 'nudity', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'violence', label: 'Violence' },
  { value: 'false_information', label: 'False information' },
  { value: 'other', label: 'Other' },
] as const;

type Options = {
  postId: string;
  initialUpvotes?: number;
  initialBookmarked?: boolean;
  initialBookmarksCount?: number;
  /** Tag for debug logs */
  tag?: string;
};

export function usePostInteractions({
  postId,
  initialUpvotes = 0,
  initialBookmarked = false,
  initialBookmarksCount = 0,
  tag = 'Post',
}: Options) {
  const router = useRouter();
  const { user } = useAuth();
  const [upvotesCount, setUpvotesCount] = useState(initialUpvotes);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarksCount, setBookmarksCount] = useState(initialBookmarksCount);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const upvoteInFlight = useRef(false);
  const bookmarkInFlight = useRef(false);

  const onUpvote = async () => {
    if (upvoteInFlight.current) return;
    if (!user) {
      promptForSignIn(
        () => {
          void router.push('/sign-in');
        },
        {
          message: 'Sign in to upvote posts.',
        }
      );
      return;
    }
    upvoteInFlight.current = true;

    // Optimistic update — increment immediately, reconcile with server response
    const prevCount = upvotesCount;
    setUpvotesCount(prev => prev + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const r: any = await Post.toggleUpvote(String(postId));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count); // Reconcile with actual server count
      }
    } catch (error) {
      setUpvotesCount(prevCount); // Revert on failure
      if (__DEV__) console.error(`[${tag}] Failed to toggle upvote:`, error);
    } finally {
      upvoteInFlight.current = false;
    }
  };

  const onBookmark = async () => {
    if (bookmarkInFlight.current) return;
    if (!user) {
      promptForSignIn(
        () => {
          void router.push('/sign-in');
        },
        {
          message: 'Sign in to save posts.',
        }
      );
      return;
    }
    bookmarkInFlight.current = true;

    // Optimistic update — toggle immediately
    const prevBookmarked = bookmarked;
    const prevCount = bookmarksCount;
    setBookmarked(prev => !prev);
    setBookmarksCount(prev => (prevBookmarked ? Math.max(0, prev - 1) : prev + 1));
    void Haptics.selectionAsync().catch(() => {});

    try {
      const r: any = await Post.toggleBookmark(String(postId));
      if (r && typeof r.bookmarks_count === 'number') {
        setBookmarksCount(r.bookmarks_count);
      }
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch (error) {
      // Revert on failure
      setBookmarked(prevBookmarked);
      setBookmarksCount(prevCount);
      if (__DEV__) console.error(`[${tag}] Failed to toggle bookmark:`, error);
    } finally {
      bookmarkInFlight.current = false;
    }
  };

  const submitReport = async (reason: string) => {
    if (!user) {
      promptForSignIn(
        () => {
          void router.push('/sign-in');
        },
        {
          message: 'Sign in to report posts.',
        }
      );
      return;
    }
    setReportSubmitting(true);
    try {
      await Report.create({ target_type: 'post', target_id: String(postId), reason });
      Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
    } catch (error: any) {
      if (error?.status === 409) {
        Alert.alert('Already Reported', 'You have already reported this post.');
      } else {
        Alert.alert('Error', error?.message || 'Failed to submit report. Please try again.');
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  return {
    upvotesCount,
    bookmarked,
    bookmarksCount,
    reportSubmitting,
    onUpvote,
    onBookmark,
    submitReport,
  };
}
