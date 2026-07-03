import ExpandableText from '@/components/ExpandableText';
import VideoPlayer from '@/components/VideoPlayer';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { formatCount, getCountryFlag, timeAgo } from '@/utils/format';
import { optimizeImageUrl } from '@/utils/imageUrl';
import { resolvePostMedia } from '@/utils/media';
import { safeGoBack } from '@/utils/navigation';
import { promptForSignIn } from '@/utils/requireSignIn';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Post as PostApi, Report, User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { usePostCache } from '@/context/PostCacheContext';
import { useShareLink } from '@/hooks/useShareLink';
import { sanitizeTitle } from '@/lib/sanitizeTitle';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';
import { getAuthSnapshot } from '@/utils/authState';
import { sanitizeText } from '@/utils/formUtils';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SKELETON_3 = Array.from({ length: 3 });

const getSportCategory = (title?: string | null, content?: string | null) => {
  const text = ((title || '') + ' ' + (content || '')).toLowerCase();
  if (text.includes('football') || text.includes('nfl'))
    return { name: 'Football', icon: '🏈', color: '#8B5A2B' };
  if (text.includes('basketball') || text.includes('nba'))
    return { name: 'Basketball', icon: '🏀', color: '#FF6B35' };
  if (text.includes('baseball') || text.includes('mlb'))
    return { name: 'Baseball', icon: '⚾', color: '#2E8B57' };
  if (text.includes('soccer') || text.includes('fifa'))
    return { name: 'Soccer', icon: '⚽', color: '#4169E1' };
  if (text.includes('hockey') || text.includes('nhl'))
    return { name: 'Hockey', icon: '🏒', color: '#1C1C1C' };
  if (text.includes('tennis')) return { name: 'Tennis', icon: '🎾', color: '#228B22' };
  return { name: 'Sports', icon: '🏆', color: '#FF6B35' };
};

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    postIds?: string;
    index?: string;
    from?: string;
  }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const postCache = usePostCache();
  const { user, checkAuth } = useAuth();
  const { edgeSwipeGesture } = useEdgeSwipeBack();
  const insets = useSafeAreaInsets();
  const explicitFallback = params.from === 'highlights' ? '/(tabs)/highlights' : undefined;
  const handleBack = useCallback(() => {
    safeGoBack(router, explicitFallback);
  }, [explicitFallback, router]);

  // Parse params for multi-post navigation
  const postIdsArray = useMemo(() => {
    return params.postIds
      ? params.postIds.split(',').filter(Boolean)
      : params.id
        ? [params.id]
        : [];
  }, [params.postIds, params.id]);
  const initialIndex = (() => {
    if (!params.index) return 0;
    const n = parseInt(params.index, 10);
    // parseInt('abc', 10) returns NaN — using NaN as an array index resolves
    // to undefined for the post ID, which then breaks the swipe sequence.
    // Treat any non-finite or negative value as the start of the list.
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();

  // State for current post in swipe sequence
  const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
  const currentPostId = useMemo(() => {
    return postIdsArray[currentPostIndex] || params.id;
  }, [postIdsArray, currentPostIndex, params.id]);

  // FlatList ref for programmatic scrolling
  const flatListRef = useRef<FlatList>(null);
  const activeScrollViewRef = useRef<ScrollView | null>(null);
  const isInitialLoad = useRef(true);
  const [activeScrollOffsetY, setActiveScrollOffsetY] = useState(0);
  const [activeScrollViewportHeight, setActiveScrollViewportHeight] = useState(0);
  const [activeScrollContentHeight, setActiveScrollContentHeight] = useState(0);

  // Track previous params to avoid re-scrolling on simple re-focus
  const prevParamsRef = useRef<{ index?: string; postIds?: string }>({});

  // Sync currentPostIndex only when navigation params actually change (not on every focus)
  useFocusEffect(
    useCallback(() => {
      const newIndexRaw = params.index ? parseInt(params.index, 10) : 0;
      const newIndex = Number.isFinite(newIndexRaw) && newIndexRaw >= 0 ? newIndexRaw : 0;
      const paramsChanged =
        prevParamsRef.current.index !== params.index ||
        prevParamsRef.current.postIds !== params.postIds;

      prevParamsRef.current = { index: params.index, postIds: params.postIds };

      if (!paramsChanged && !isInitialLoad.current) return;
      isInitialLoad.current = false;

      setCurrentPostIndex(newIndex);
      setTimeout(() => {
        if (flatListRef.current && postIdsArray.length > 1) {
          try {
            flatListRef.current.scrollToIndex({ index: newIndex, animated: false });
          } catch {
            /* scrollToIndex may fail before layout */
          }
        }
      }, 50);
    }, [params.index, params.postIds, postIdsArray.length])
  );

  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [comment, setComment] = useState('');
  const [voting, setVoting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [updatingComment, setUpdatingComment] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<{
    id: string;
    authorName: string;
  } | null>(null);
  const [_editing] = useState(false); // edit removed v1.0.2
  const [_editContent] = useState(''); // edit removed v1.0.2
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(false);
  const [_imageRotation, setImageRotation] = useState(0);
  const imageScale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const resetFullscreen = () => {
    setImageRotation(0);
    imageScale.value = 1;
    savedScale.value = 1;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      // Reduced sensitivity: max 2.5x zoom, no sub-1x shrink
      imageScale.value = Math.max(1, Math.min(2.5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = imageScale.value;
      if (imageScale.value < 1.05) {
        imageScale.value = withSpring(1);
        savedScale.value = 1;
      }
    });

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: imageScale.value }],
  }));
  const scrollJumpThreshold = 96;
  const maxActiveScrollY = Math.max(0, activeScrollContentHeight - activeScrollViewportHeight);
  const hasOverflowingContent = activeScrollContentHeight > activeScrollViewportHeight + 48;
  const canJumpToTop = hasOverflowingContent && activeScrollOffsetY > scrollJumpThreshold;
  const canJumpToBottom =
    hasOverflowingContent && maxActiveScrollY - activeScrollOffsetY > scrollJumpThreshold;

  // Skeleton loading component
  const SkeletonLoader = () => (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={Colors[colorScheme].background}
      />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Skeleton */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: Colors[colorScheme].surface,
            borderBottomColor: Colors[colorScheme].border,
          },
        ]}
      >
        <View style={[styles.skeletonButton, { backgroundColor: Colors[colorScheme].surface }]} />
        <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].surface }]} />
        <View style={[styles.skeletonButton, { backgroundColor: Colors[colorScheme].surface }]} />
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: Colors[colorScheme].background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Skeleton */}
        <View style={[styles.skeletonHero, { backgroundColor: Colors[colorScheme].surface }]} />

        {/* Content Skeleton */}
        <View style={[styles.postContent, { backgroundColor: Colors[colorScheme].card }]}>
          <View
            style={[
              styles.skeletonLine,
              styles.skeletonLineTitle,
              { backgroundColor: Colors[colorScheme].surface },
            ]}
          />
          <View
            style={[
              styles.skeletonLine,
              styles.skeletonLineText,
              { backgroundColor: Colors[colorScheme].surface },
            ]}
          />
          <View
            style={[
              styles.skeletonLine,
              styles.skeletonLineText,
              { backgroundColor: Colors[colorScheme].surface },
            ]}
          />

          {/* Author Skeleton */}
          <View style={styles.authorSection}>
            <View style={styles.authorInfo}>
              <View
                style={[styles.authorAvatar, { backgroundColor: Colors[colorScheme].surface }]}
              />
              <View style={styles.authorDetails}>
                <View
                  style={[
                    styles.skeletonAuthorName,
                    { backgroundColor: Colors[colorScheme].surface },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonAuthorTime,
                    { backgroundColor: Colors[colorScheme].surface },
                  ]}
                />
              </View>
            </View>
            <View
              style={[
                styles.skeletonFollowButton,
                { backgroundColor: Colors[colorScheme].surface },
              ]}
            />
          </View>
        </View>

        {/* Comments Skeleton */}
        <View style={[styles.commentsSection, { backgroundColor: 'transparent' }]}>
          <View style={styles.commentsHeader}>
            <View
              style={[
                styles.skeletonCommentsTitle,
                { backgroundColor: Colors[colorScheme].surface },
              ]}
            />
            <View
              style={[
                styles.skeletonCommentsCount,
                { backgroundColor: Colors[colorScheme].surface },
              ]}
            />
          </View>

          {SKELETON_3.map((_, i) => (
            <View key={i} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View style={styles.commentAuthor}>
                  <View
                    style={[styles.commentAvatar, { backgroundColor: Colors[colorScheme].surface }]}
                  />
                  <View style={styles.commentAuthorInfo}>
                    <View
                      style={[
                        styles.skeletonCommentAuthor,
                        { backgroundColor: Colors[colorScheme].surface },
                      ]}
                    />
                    <View
                      style={[
                        styles.skeletonCommentDate,
                        { backgroundColor: Colors[colorScheme].surface },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View
                style={[
                  styles.skeletonCommentText,
                  { backgroundColor: Colors[colorScheme].surface },
                ]}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = (await getAuthSnapshot(checkAuth, user)) as any;
        setCurrentUser(currentUser);
      } catch (error) {
        if (__DEV__) console.warn('[post-detail] Failed to load current user:', error);
        setCurrentUser(null);
      }
    };
    void loadUser();
  }, [checkAuth, user]);

  // Defer the fetch of the newly-current post until the navigation/swipe
  // transition settles so this heavy screen doesn't parse a response
  // mid-animation. Cached entries render instantly regardless (a disabled
  // query still serves its cache).
  const queryClient = useQueryClient();
  const [settledPostId, setSettledPostId] = useState<string | null>(null);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setSettledPostId(currentPostId ?? null);
    });
    setReplyingToComment(null);
    return () => task.cancel();
  }, [currentPostId]);

  // One query per post in the swipe sequence. Only the settled current post
  // fetches; previously-visited posts render reactively from the cache (the
  // old postsById/commentsById maps). PostCacheContext seeds instant paints
  // via placeholderData, mirroring the old cache-first path.
  const fetchPostDetail = useCallback(
    async (targetId: string) => {
      const [p, c] = await Promise.all([
        PostApi.get(targetId).catch((err: any) => {
          if (__DEV__) console.error('[post-detail] Failed to get post:', err?.message || err);
          throw err;
        }),
        PostApi.comments(targetId).catch((err: any) => {
          if (__DEV__) console.warn('[post-detail] Failed to get comments:', err?.message || err);
          return [] as any;
        }),
      ]);

      if (!p || !p.id) {
        throw new Error('Post not found or was deleted');
      }

      // Cache the post for cross-screen sharing
      postCache.set(targetId, p);

      // Comments response is either an array or { items, nextCursor }
      let commentsArray: any[] = [];
      let nextCursor: string | null = null;
      if (Array.isArray(c)) {
        commentsArray = c;
      } else if (c && Array.isArray(c.items)) {
        commentsArray = c.items;
        nextCursor = c.nextCursor ?? null;
      }

      return { post: p, comments: commentsArray, nextCursor };
    },
    [postCache]
  );

  const postQueries = useQueries({
    queries: postIdsArray.map(id => ({
      queryKey: ['post-detail', id],
      enabled: id === settledPostId,
      queryFn: () => fetchPostDetail(id),
      placeholderData: () => {
        const cachedPost = postCache.get(id);
        return cachedPost?.id && cachedPost?.author?.username
          ? { post: cachedPost, comments: [] as any[], nextCursor: null as string | null }
          : undefined;
      },
    })),
  });

  const { postsById, commentsById } = useMemo(() => {
    const posts: Record<string, any> = {};
    const commentsMap: Record<string, any[]> = {};
    postIdsArray.forEach((id, i) => {
      const d = postQueries[i]?.data;
      if (d?.post) {
        posts[id] = d.post;
        commentsMap[id] = d.comments ?? [];
      }
    });
    return { postsById: posts, commentsById: commentsMap };
    // postQueries is a new array each render but its data refs are stable
  }, [postIdsArray, postQueries]);

  const currentQueryIndex = currentPostId ? postIdsArray.indexOf(currentPostId) : -1;
  const currentQuery = currentQueryIndex >= 0 ? postQueries[currentQueryIndex] : undefined;
  // If the fetch failed but PostCacheContext still has a renderable copy,
  // show it instead of the error card — the old cache-first path never took
  // content away on a failed refresh (offline/flaky-network protection).
  const cachedFallbackPost = useMemo(() => {
    if (!currentPostId || !currentQuery?.isError) return null;
    const cached = postCache.get(currentPostId);
    return cached?.id && cached?.author?.username ? cached : null;
  }, [currentPostId, currentQuery?.isError, postCache]);
  const post = (currentPostId && postsById[currentPostId]) || cachedFallbackPost || null;
  const comments = (currentPostId && commentsById[currentPostId]) || [];
  const commentsNextCursor = currentQuery?.data?.nextCursor ?? null;

  // Full-screen skeleton only before the FIRST post ever renders — swiping to
  // an unvisited post shows the per-item placeholder inside the FlatList
  // instead, matching the old showLoading=initial-only behavior.
  const hasRenderedOnceRef = useRef(false);
  hasRenderedOnceRef.current = hasRenderedOnceRef.current || !!post || !!currentQuery?.isError;
  const error = !currentPostId
    ? 'No post ID provided'
    : currentQuery?.isError && !post
      ? (currentQuery.error as any)?.message || 'Failed to load post'
      : null;
  const loading = !hasRenderedOnceRef.current && !error;

  const retryLoad = useCallback(() => {
    void currentQuery?.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuery?.refetch]);

  // Patch one post's cached payload; every consumer (current post, swipe
  // pages, counts) re-renders from the cache.
  const patchPostDetail = useCallback(
    (postId: string, updater: (old: any) => any) => {
      queryClient.setQueryData(['post-detail', postId], (old: any) => (old ? updater(old) : old));
    },
    [queryClient]
  );

  // Initialize follow/save toggles once per post (from server fields); later
  // optimistic toggles must not be clobbered by cache patches.
  const interactionInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!post?.id) return;
    if (interactionInitRef.current === String(post.id)) return;
    interactionInitRef.current = String(post.id);
    if (typeof post.is_following_author === 'boolean') {
      setFollowing(post.is_following_author);
    }
    if (typeof post.has_bookmarked === 'boolean') {
      setSaved(post.has_bookmarked);
    }
    // Note: has_upvoted is read directly from the cached post for UI
  }, [post]);

  useEffect(() => {
    activeScrollViewRef.current = null;
    setActiveScrollOffsetY(0);
    setActiveScrollViewportHeight(0);
    setActiveScrollContentHeight(0);
  }, [currentPostId]);

  // Handle post change when swiping
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const visibleIndex = viewableItems[0].index;
      if (visibleIndex !== undefined) {
        setCurrentPostIndex(visibleIndex);
        // Don't call load() here - the useEffect will handle it automatically
      }
    }
  }).current;

  const onUpvote = async () => {
    if (!currentPostId || voting) return;
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
    setVoting(true);
    // Only the top-level vote fields change here, so a shallow snapshot is enough.
    const prevPost = post ? { ...post } : post;
    patchPostDetail(currentPostId, old => {
      const p = old.post;
      if (!p) return old;
      const optimisticNext = !p.has_upvoted;
      return {
        ...old,
        post: {
          ...p,
          has_upvoted: optimisticNext,
          upvotes_count: Math.max(0, (p.upvotes_count || 0) + (optimisticNext ? 1 : -1)),
        },
      };
    });
    try {
      const r: any = await PostApi.toggleUpvote(currentPostId);
      const upvotedNow = typeof r?.has_upvoted === 'boolean' ? r.has_upvoted : Boolean(r?.upvoted);
      if (upvotedNow) {
        analytics.track(ANALYTICS_EVENTS.POST_UPVOTED, {
          post_id: currentPostId,
          source: 'post_detail',
        });
      }
      // Reconcile with server values
      patchPostDetail(currentPostId, old => ({
        ...old,
        post: {
          ...(old.post || {}),
          upvotes_count:
            typeof r?.count === 'number'
              ? r.count
              : typeof r?.upvotes_count === 'number'
                ? r.upvotes_count
                : old.post?.upvotes_count || 0,
          has_upvoted: typeof r?.has_upvoted === 'boolean' ? r.has_upvoted : Boolean(r?.upvoted),
        },
      }));
    } catch (error: any) {
      // Revert optimistic update on failure
      if (prevPost) {
        patchPostDetail(currentPostId, old => ({ ...old, post: prevPost }));
      }
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.');
      if (__DEV__) console.error('Error toggling upvote:', error);
    } finally {
      setVoting(false);
    }
  };

  const onAddComment = async () => {
    if (!currentPostId || !comment.trim()) return;
    if (!user) {
      promptForSignIn(
        () => {
          void router.push('/sign-in');
        },
        {
          message: 'Sign in to comment on posts.',
        }
      );
      return;
    }
    setCommenting(true);
    const parentId = replyingToComment?.id;
    const commentText = sanitizeText(comment);

    // Optimistic insert — show the comment immediately with a temporary ID.
    // The server response will replace it with the real record.
    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      text: commentText,
      parent_id: parentId || null,
      created_at: new Date().toISOString(),
      user: { id: 'self', display_name: 'You', avatar_url: null },
      _optimistic: true,
    };
    const prevComments = comments;
    patchPostDetail(currentPostId, old => ({
      ...old,
      comments: [optimisticComment, ...(old.comments ?? [])],
    }));
    setReplyingToComment(null);
    setComment('');

    try {
      const created = await PostApi.addComment(currentPostId, commentText, parentId);
      analytics.track(ANALYTICS_EVENTS.COMMENT_CREATED, {
        post_id: currentPostId,
        is_reply: !!parentId,
        source: 'post_detail',
      });
      // Replace optimistic comment with real server response and bump the count
      patchPostDetail(currentPostId, old => ({
        ...old,
        comments: [created, ...prevComments],
        post: old.post
          ? { ...old.post, comments_count: (old.post.comments_count || 0) + 1 }
          : old.post,
      }));
    } catch (error) {
      // Revert optimistic insert on failure
      patchPostDetail(currentPostId, old => ({ ...old, comments: prevComments }));
      const err = error as any;
      if (__DEV__) console.error('Error adding comment:', err?.message || error);
      Alert.alert('Comment Failed', err?.message || 'Failed to post comment. Please try again.');
    } finally {
      setCommenting(false);
    }
  };

  const postShareContext = useMemo(() => {
    const lines: string[] = [];
    if (sanitizeTitle(post?.title)) {
      lines.push(`Check out: ${sanitizeTitle(post?.title)}`);
    }
    if (post?.game?.home_team && post?.game?.away_team) {
      lines.push(`${post.game.home_team} vs ${post.game.away_team}`);
    }
    if (post?.author?.username) {
      lines.push(`Posted by @${post.author.username}`);
    }
    return lines;
  }, [post]);

  const { share: sharePost } = useShareLink({
    kind: 'post',
    id: currentPostId,
    title: sanitizeTitle(post?.title) || 'VarsityHub Post',
    caption: post?.caption,
    contextLines: postShareContext,
    onShareSuccess: postId => {
      PostApi.share(postId).catch(err => {
        if (__DEV__) console.warn('[post-detail] Share tracking failed:', err);
      });
    },
  });

  const onShare = () => {
    void sharePost();
  };

  const _onSendToFriend = () => {
    // Navigate to messages/DM with pre-filled post link
    Alert.alert('Send to Friend', 'Choose how to send this post', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Via VarsityHub DM',
        onPress: () => {
          router.push(`/messages?sharePost=${currentPostId}` as any);
        },
      },
      {
        text: 'Share Externally',
        onPress: onShare,
      },
    ]);
  };

  const followInFlight = useRef(false);
  const _onFollow = async () => {
    if (!post?.author_id || followInFlight.current) return;
    followInFlight.current = true;

    const prev = following;
    setFollowing(!prev); // Optimistic update

    try {
      const authorId = String(post.author_id);
      if (prev) {
        await User.unfollow(authorId);
      } else {
        await User.follow(authorId);
      }
    } catch (error: any) {
      if (__DEV__) console.error('[post-detail] Error toggling follow:', error);
      setFollowing(prev); // Revert on error
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.');
    } finally {
      followInFlight.current = false;
    }
  };

  const onSave = async () => {
    if (!post?.id) return;

    try {
      const result = await PostApi.toggleBookmark(post.id);
      // Update the saved state based on API response
      if (result && typeof result.has_bookmarked === 'boolean') {
        setSaved(result.has_bookmarked);
      } else {
        // Fallback to toggle if API doesn't return the state
        setSaved(!saved);
      }
    } catch (error: any) {
      if (__DEV__) console.error('[post-detail] Error toggling save:', error);
      // Revert optimistic update on error
      setSaved(saved);
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.');
    }
  };

  const onReport = () => {
    if (!currentPostId) return;
    const reasons = [
      { text: 'Harassment / Bullying', value: 'harassment' },
      { text: 'Copyright infringement', value: 'copyright' },
      { text: 'Broadcast footage', value: 'copyright' },
      { text: 'Unauthorized use of my likeness', value: 'impersonation' },
      { text: 'Inappropriate content', value: 'nudity' },
      { text: 'Spam', value: 'spam' },
      { text: 'Cancel', value: '' },
    ];
    Alert.alert(
      'Report Post',
      'Select a reason:',
      reasons.map(r => ({
        text: r.text,
        style: r.value === '' ? ('cancel' as const) : ('default' as const),
        onPress: r.value
          ? async () => {
              try {
                await Report.create({
                  target_type: 'post',
                  target_id: currentPostId,
                  reason: r.value,
                });
                Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
              } catch (error: any) {
                if (error?.status === 409) {
                  Alert.alert('Already Reported', 'You have already reported this post.');
                } else if (error?.status === 400 && error?.data?.error?.includes('own')) {
                  Alert.alert('Cannot Report', 'You cannot report your own content.');
                } else {
                  Alert.alert(
                    'Error',
                    error?.data?.error ||
                      error?.message ||
                      'Failed to submit report. Please try again.'
                  );
                }
              }
            }
          : undefined,
      }))
    );
  };

  const handleReportComment = (commentId: string) => {
    const reasons = [
      { text: 'Harassment / Bullying', value: 'harassment' },
      { text: 'Hate speech', value: 'hate_speech' },
      { text: 'Spam', value: 'spam' },
      { text: 'Inappropriate content', value: 'nudity' },
      { text: 'Other', value: 'other' },
      { text: 'Cancel', value: '' },
    ];
    Alert.alert(
      'Report Comment',
      'Select a reason:',
      reasons.map(r => ({
        text: r.text,
        style: r.value === '' ? ('cancel' as const) : ('default' as const),
        onPress: r.value
          ? async () => {
              try {
                await Report.create({
                  target_type: 'comment',
                  target_id: commentId,
                  reason: r.value,
                });
                Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
              } catch (error: any) {
                if (error?.status === 409) {
                  Alert.alert('Already Reported', 'You have already reported this comment.');
                } else if (error?.status === 400 && error?.data?.error?.includes('own')) {
                  Alert.alert('Cannot Report', 'You cannot report your own content.');
                } else {
                  Alert.alert(
                    'Error',
                    error?.data?.error ||
                      error?.message ||
                      'Failed to submit report. Please try again.'
                  );
                }
              }
            }
          : undefined,
      }))
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentPostId) return;
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await PostApi.deleteComment(currentPostId, commentId);
            patchPostDetail(currentPostId, old => ({
              ...old,
              comments: (old.comments ?? []).filter((c: any) => String(c.id) !== commentId),
            }));
            Alert.alert('Success', 'Comment deleted successfully');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete comment');
          }
        },
      },
    ]);
  };

  const handleDeletePost = async () => {
    if (!currentPostId) return;
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
              await PostApi.delete(currentPostId);
              postCache.remove(currentPostId);
              queryClient.removeQueries({ queryKey: ['post-detail', currentPostId] });
              handleBack();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  // handleEditPost removed in v1.0.2 — post editing disabled

  const handleEditComment = async () => {
    if (!currentPostId || !editCommentId || !editCommentText.trim()) return;
    setUpdatingComment(true);
    try {
      await PostApi.updateComment(currentPostId, editCommentId, sanitizeText(editCommentText));
      patchPostDetail(currentPostId, old => ({
        ...old,
        comments: (old.comments ?? []).map((c: any) =>
          String(c.id) === editCommentId ? { ...c, content: editCommentText.trim() } : c
        ),
      }));
      setEditCommentId(null);
      setEditCommentText('');
      Alert.alert('Success', 'Comment updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update comment');
    } finally {
      setUpdatingComment(false);
    }
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  if (error && !loading) {
    const is404 =
      error.toLowerCase().includes('not found') || error.toLowerCase().includes('deleted');
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={Colors[colorScheme].background}
        />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons
            name={is404 ? 'document-text-outline' : 'alert-circle'}
            size={48}
            color={Colors[colorScheme].mutedText}
          />
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>
            {is404 ? 'This post is no longer available' : error}
          </Text>
          {!is404 && (
            <Pressable testID="retry-button" style={styles.retryButton} onPress={retryLoad}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.retryButton,
              !is404 && { marginTop: 8 },
              { backgroundColor: Colors[colorScheme].surface },
            ]}
            onPress={() => {
              handleBack();
            }}
          >
            <Text style={[styles.retryButtonText, { color: Colors[colorScheme].text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!post && !loading && !error) {
    // Post failed to load but no error was set - show error state
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={Colors[colorScheme].background}
        />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors[colorScheme].destructive} />
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>
            Failed to load post
          </Text>
          <Pressable style={styles.retryButton} onPress={retryLoad}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            style={[
              styles.retryButton,
              { marginTop: 8, backgroundColor: Colors[colorScheme].surface },
            ]}
            onPress={() => {
              handleBack();
            }}
          >
            <Text style={[styles.retryButtonText, { color: Colors[colorScheme].text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    // Show error with retry and back options
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={Colors[colorScheme].background}
        />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors[colorScheme].destructive} />
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={retryLoad}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            style={[
              styles.retryButton,
              { marginTop: 8, backgroundColor: Colors[colorScheme].surface },
            ]}
            onPress={() => {
              handleBack();
            }}
          >
            <Text style={[styles.retryButtonText, { color: Colors[colorScheme].text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={Colors[colorScheme].background}
        />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>
            Post not found
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme].surface }]}
            onPress={() => {
              handleBack();
            }}
          >
            <Text style={[styles.retryButtonText, { color: Colors[colorScheme].text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasMultiplePosts = postIdsArray.length > 1;
  const currentMedia = resolvePostMedia(post);
  const currentIsImage = currentMedia.mediaType === 'image';
  const currentIsVideo = currentMedia.mediaType === 'video';

  // Render single post content (reusable for both single and multi-post views)
  const renderPostContent = (postData: any, commentsData: any[], isInsidePager = false) => {
    const media = resolvePostMedia(postData);
    const isImage = media.mediaType === 'image';
    const isVideo = media.mediaType === 'video';
    const hasMedia = media.hasMedia;
    const category = getSportCategory(postData.title, postData.content);
    const localComments = Array.isArray(commentsData) ? commentsData : [];
    const isActivePost = String(postData.id) === String(currentPostId);

    return (
      <ScrollView
        ref={node => {
          if (isActivePost) {
            activeScrollViewRef.current = node;
          }
        }}
        style={[styles.content, { backgroundColor: Colors[colorScheme].background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        nestedScrollEnabled={isInsidePager}
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        scrollEventThrottle={16}
        onLayout={event => {
          if (isActivePost) {
            setActiveScrollViewportHeight(event.nativeEvent.layout.height);
          }
        }}
        onContentSizeChange={(_width, height) => {
          if (isActivePost) {
            setActiveScrollContentHeight(height);
          }
        }}
        onScroll={event => {
          if (isActivePost) {
            setActiveScrollOffsetY(event.nativeEvent.contentOffset.y);
          }
        }}
      >
        {/* Hero Media Section */}
        <View style={styles.heroSection}>
          {hasMedia ? (
            <Pressable style={styles.mediaContainer} onPress={() => setFullscreenMedia(true)}>
              {isImage && (
                <ExpoImage
                  source={{
                    uri:
                      optimizeImageUrl(
                        media.displayImageUrl || media.mediaUrl,
                        Math.max(900, Math.round(SCREEN_WIDTH * 1.5))
                      ) ||
                      media.displayImageUrl ||
                      media.mediaUrl!,
                  }}
                  style={styles.heroImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              )}
              {isVideo && (
                <View style={styles.videoContainer}>
                  <VideoPlayer uri={media.mediaUrl!} style={styles.heroVideo} />
                </View>
              )}

              {/* Media Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.mediaOverlay}
              />

              {/* Category Badge */}
              <View style={styles.mediaTopOverlay}>
                {/* Category badge removed as requested */}
                <Text style={styles.countryFlag}>{getCountryFlag(postData.country_code)}</Text>
              </View>

              {/* Expand Icon */}
              <View style={styles.expandIcon}>
                <Ionicons name="expand-outline" size={24} color="#fff" />
              </View>

              {/* Live Badge */}
              {postData.created_at &&
                new Date(postData.created_at).getTime() > Date.now() - 3600000 && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
            </Pressable>
          ) : (
            <LinearGradient
              colors={[category.color + '40', category.color + '20']}
              style={styles.noMediaHero}
            >
              <Text style={styles.noMediaIcon}>{category.icon}</Text>
              <Text style={[styles.noMediaText, { color: Colors[colorScheme].text }]}>
                Text Post
              </Text>
            </LinearGradient>
          )}
        </View>

        {/* Post Content */}
        <View style={[styles.postContent, { backgroundColor: Colors[colorScheme].card }]}>
          {/* Title */}
          {sanitizeTitle(postData.title) && (
            <Text style={[styles.postTitle, { color: Colors[colorScheme].text }]}>
              {sanitizeTitle(postData.title)}
            </Text>
          )}

          {/* Content — read-only on post detail (edit removed per product policy) */}
          {postData.content ? (
            <ExpandableText
              text={postData.content}
              maxLines={6}
              style={[styles.postText, { color: Colors[colorScheme].text }]}
              expandStyle={[styles.postTextToggle, { color: Colors[colorScheme].tint }]}
            />
          ) : null}

          {/* Game/Event Info */}
          {postData.game && (
            <Pressable
              style={[
                styles.gameInfo,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              onPress={() => {
                if (postData.game?.id) {
                  void router.push({ pathname: '/game/[id]', params: { id: postData.game.id } });
                }
              }}
            >
              <Ionicons name="basketball-outline" size={20} color={Colors[colorScheme].tint} />
              <View style={styles.gameDetails}>
                <Text style={[styles.gameTitle, { color: Colors[colorScheme].text }]}>
                  {postData.game.title}
                </Text>
                {(postData.game.home_team || postData.game.away_team) && (
                  <Text style={[styles.gameTeams, { color: Colors[colorScheme].mutedText }]}>
                    {postData.game.home_team && postData.game.away_team
                      ? `${postData.game.home_team} vs ${postData.game.away_team}`
                      : postData.game.home_team || postData.game.away_team}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
          )}

          {/* Team Links */}
          {(postData.team_id || postData.team) && (
            <Pressable
              style={[
                styles.teamInfo,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              onPress={() => {
                const teamId = postData.team_id || postData.team?.id;
                if (teamId) {
                  void router.push(`/team-page?id=${teamId}`);
                }
              }}
            >
              <Ionicons name="people-outline" size={20} color={Colors[colorScheme].tint} />
              <View style={styles.teamDetails}>
                <Text style={[styles.teamTitle, { color: Colors[colorScheme].text }]}>
                  {postData.team?.name || 'Team'}
                </Text>
                {postData.team?.sport && (
                  <Text style={[styles.teamSport, { color: Colors[colorScheme].mutedText }]}>
                    {postData.team.sport}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
          )}

          {/* Author Info */}
          <View style={[styles.authorSection, { borderBottomColor: Colors[colorScheme].border }]}>
            <Pressable
              style={styles.authorInfo}
              onPress={() => {
                if (postData.author_id) {
                  void router.push(`/user-profile?id=${postData.author_id}`);
                }
              }}
              disabled={!postData.author_id}
            >
              {postData.author?.avatar_url ? (
                <ExpoImage
                  source={{
                    uri:
                      optimizeImageUrl(postData.author.avatar_url, 96) ||
                      postData.author.avatar_url,
                  }}
                  style={styles.authorAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.authorAvatar, styles.defaultAvatar]}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
              )}
              <View style={styles.authorDetails}>
                <Text style={[styles.authorName, { color: Colors[colorScheme].text }]}>
                  {postData.author?.display_name || postData.author?.username || 'Anonymous'}
                </Text>
                <Text style={[styles.postTime, { color: Colors[colorScheme].tabIconDefault }]}>
                  {timeAgo(postData.created_at)}
                </Text>
              </View>
            </Pressable>
            {/* Follow button removed — users follow when visiting profile page */}
          </View>

          {/* Stats & Actions */}
          <View style={styles.statsSection}>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Ionicons name="arrow-up" size={18} color={Colors[colorScheme].tint} />
                <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>
                  {formatCount(postData.upvotes_count || 0)}
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={Colors[colorScheme].mutedText}
                />
                <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>
                  {formatCount(localComments.length || 0)}
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="eye-outline" size={18} color={Colors[colorScheme].mutedText} />
                <Text style={[styles.statText, { color: Colors[colorScheme].text }]}>
                  {formatCount((postData.upvotes_count || 0) * 12)}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                testID="upvote-button"
                style={[
                  styles.actionButton,
                  styles.upvoteButton,
                  postData?.has_upvoted && styles.upvoteButtonActive,
                ]}
                onPress={onUpvote}
                disabled={voting}
              >
                <Ionicons
                  name={postData?.has_upvoted ? 'arrow-up' : 'arrow-up-outline'}
                  size={20}
                  color="#fff"
                />
              </Pressable>

              <Pressable
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: Colors[colorScheme].card,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
                onPress={onSave}
              >
                <Ionicons
                  name={saved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={saved ? '#FFB800' : Colors[colorScheme].icon}
                />
              </Pressable>

              <Pressable
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: Colors[colorScheme].card,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
                onPress={onReport}
              >
                <Ionicons name="flag-outline" size={20} color={Colors[colorScheme].icon} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Comments Section */}
        <View style={[styles.commentsSection, { backgroundColor: 'transparent' }]}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.commentsTitle, { color: Colors[colorScheme].text }]}>
              Comments
            </Text>
            <Text style={[styles.commentsCount, { color: Colors[colorScheme].mutedText }]}>
              {localComments.length}
            </Text>
          </View>

          {/* Add Comment */}
          <View style={styles.addCommentWrapper}>
            {replyingToComment && (
              <View
                style={[
                  styles.replyingToBar,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
              >
                <Text style={[styles.replyingToText, { color: Colors[colorScheme].mutedText }]}>
                  Replying to {replyingToComment.authorName}
                </Text>
                <Pressable onPress={() => setReplyingToComment(null)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={Colors[colorScheme].mutedText} />
                </Pressable>
              </View>
            )}
            <View
              style={[styles.addCommentContainer, { backgroundColor: Colors[colorScheme].card }]}
            >
              {currentUser?.avatar_url ? (
                <ExpoImage
                  source={{
                    uri: optimizeImageUrl(currentUser.avatar_url, 64) || currentUser.avatar_url,
                  }}
                  style={styles.commentAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                  <Ionicons name="person" size={16} color="#fff" />
                </View>
              )}
              <TextInput
                testID="comment-input"
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                    color: Colors[colorScheme].text,
                  },
                ]}
                placeholder={
                  replyingToComment
                    ? `Reply to ${replyingToComment.authorName}...`
                    : 'Add a comment...'
                }
                placeholderTextColor={Colors[colorScheme].mutedText}
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <Pressable
                testID="submit-comment"
                style={[
                  styles.sendButton,
                  (commenting || !comment.trim()) && styles.sendButtonDisabled,
                ]}
                onPress={onAddComment}
                disabled={commenting || !comment.trim()}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={
                    commenting || !comment.trim()
                      ? Colors[colorScheme].mutedText
                      : Colors[colorScheme].tint
                  }
                />
              </Pressable>
            </View>
          </View>

          {/* Comments List */}
          {localComments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={Colors[colorScheme].tabIconDefault}
              />
              <Text style={[styles.emptyCommentsText, { color: Colors[colorScheme].text }]}>
                No comments yet
              </Text>
              <Text
                style={[styles.emptyCommentsSubtext, { color: Colors[colorScheme].tabIconDefault }]}
              >
                Be the first to share your thoughts!
              </Text>
            </View>
          ) : (
            <View style={styles.commentsList}>
              {localComments.map(c => (
                <View key={String(c.id)} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Pressable
                      style={styles.commentAuthor}
                      onPress={() => {
                        if (c.author_id) {
                          void router.push(`/user-profile?id=${c.author_id}`);
                        }
                      }}
                      disabled={!c.author_id}
                    >
                      {c.author?.avatar_url ? (
                        <ExpoImage
                          source={{
                            uri: optimizeImageUrl(c.author.avatar_url, 64) || c.author.avatar_url,
                          }}
                          style={styles.commentAvatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                          <Ionicons name="person" size={16} color="#fff" />
                        </View>
                      )}
                      <View style={styles.commentAuthorInfo}>
                        <Text
                          style={[styles.commentAuthorName, { color: Colors[colorScheme].text }]}
                        >
                          {c.author?.username
                            ? `@${c.author.username}`
                            : c.author?.display_name
                              ? `@${c.author.display_name}`
                              : 'User'}
                        </Text>
                        {c.created_at && (
                          <Text
                            style={[styles.commentDate, { color: Colors[colorScheme].mutedText }]}
                          >
                            {timeAgo(c.created_at)}
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    <View style={styles.commentActions}>
                      {currentUser && (
                        <Pressable
                          style={styles.commentActionBtn}
                          onPress={() =>
                            setReplyingToComment({
                              id: String(c.id),
                              authorName: c.author?.username
                                ? `@${c.author.username}`
                                : c.author?.display_name || 'User',
                            })
                          }
                        >
                          <Ionicons
                            name="arrow-undo-outline"
                            size={16}
                            color={Colors[colorScheme].icon}
                          />
                        </Pressable>
                      )}
                      {currentUser &&
                      c.author_id &&
                      String(currentUser.id) === String(c.author_id) ? (
                        <>
                          <Pressable
                            style={styles.commentActionBtn}
                            onPress={() => {
                              setEditCommentId(String(c.id));
                              setEditCommentText(c.content || '');
                            }}
                          >
                            <Ionicons name="pencil" size={16} color={Colors[colorScheme].icon} />
                          </Pressable>
                          <Pressable
                            style={styles.commentActionBtn}
                            onPress={() => handleDeleteComment(String(c.id))}
                          >
                            <Ionicons name="trash" size={16} color="#DC2626" />
                          </Pressable>
                        </>
                      ) : currentUser &&
                        c.author_id &&
                        String(currentUser.id) !== String(c.author_id) ? (
                        <>
                          {/* Post owners can moderate comments on their own post
                              (server allows author-of-post deletion, posts.ts). */}
                          {post &&
                          String(currentUser.id) ===
                            String(post.author_id ?? post.author?.id ?? '') ? (
                            <Pressable
                              style={styles.commentActionBtn}
                              onPress={() => handleDeleteComment(String(c.id))}
                              accessibilityLabel="Delete comment"
                            >
                              <Ionicons name="trash" size={16} color="#DC2626" />
                            </Pressable>
                          ) : null}
                          <Pressable
                            style={styles.commentActionBtn}
                            onPress={() => handleReportComment(String(c.id))}
                            accessibilityLabel="Report comment"
                          >
                            <Ionicons
                              name="flag-outline"
                              size={16}
                              color={Colors[colorScheme].mutedText}
                            />
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.commentText, { color: Colors[colorScheme].text }]}>
                    {c.content}
                  </Text>
                </View>
              ))}
              {isActivePost && commentsNextCursor && (
                <Pressable
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                  onPress={async () => {
                    if (loadingMoreComments || !commentsNextCursor) return;
                    setLoadingMoreComments(true);
                    try {
                      const more = await PostApi.comments(postData.id, {
                        cursor: commentsNextCursor,
                      });
                      const moreItems = Array.isArray(more) ? more : (more?.items ?? []);
                      patchPostDetail(String(postData.id), old => ({
                        ...old,
                        comments: [...(old.comments ?? []), ...moreItems],
                        nextCursor: more?.nextCursor ?? null,
                      }));
                    } catch {
                      // silently ignore — user can retry by tapping again
                    } finally {
                      setLoadingMoreComments(false);
                    }
                  }}
                  disabled={loadingMoreComments}
                >
                  {loadingMoreComments ? (
                    <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
                  ) : (
                    <Text style={{ color: Colors[colorScheme].tint, fontSize: 14 }}>
                      Load more comments
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const content = (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}
    >
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={Colors[colorScheme].background}
      />
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Custom Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: Colors[colorScheme].surface, borderBottomColor: 'transparent' },
          ]}
        >
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>
              Post Details
            </Text>
            {hasMultiplePosts && (
              <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>
                {currentPostIndex + 1} of {postIdsArray.length}
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {/* Show delete button for post author or admin */}
            {currentUser &&
              (post.author_id === currentUser.id ||
                currentUser.is_admin ||
                currentUser.role === 'super_admin') && (
                <Pressable style={styles.headerActionButton} onPress={handleDeletePost}>
                  <Ionicons name="trash-outline" size={22} color="#DC2626" />
                </Pressable>
              )}
            <Pressable style={styles.headerActionButton} onPress={onShare}>
              <Ionicons name="share-outline" size={22} color={Colors[colorScheme].text} />
            </Pressable>
          </View>
        </View>

        {/* Horizontal Swipe FlatList for Multiple Posts */}
        {hasMultiplePosts ? (
          <FlatList
            ref={flatListRef}
            data={postIdsArray}
            horizontal
            pagingEnabled
            scrollEnabled={true}
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="fast"
            keyExtractor={item => item}
            extraData={comments}
            initialScrollIndex={initialIndex}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            renderItem={({ item }) => {
              // `post` includes the postCache fallback when the fetch errored
              const postData = postsById[item] ?? (item === currentPostId ? post : undefined);
              const commentsData = commentsById[item];
              return (
                <View style={{ width: SCREEN_WIDTH }}>
                  {postData ? (
                    renderPostContent(postData, commentsData, true)
                  ) : (
                    <View
                      style={[
                        styles.loadingPlaceholder,
                        { backgroundColor: Colors[colorScheme].background },
                      ]}
                    />
                  )}
                </View>
              );
            }}
          />
        ) : post ? (
          renderPostContent(post, comments, false)
        ) : null}
        {hasOverflowingContent && (
          <View
            pointerEvents="box-none"
            style={[styles.scrollJumpOverlay, { bottom: Math.max(insets.bottom + 20, 28) }]}
          >
            {canJumpToTop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll to top"
                style={[
                  styles.scrollJumpButton,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
                onPress={() => {
                  activeScrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }}
              >
                <Text style={[styles.scrollJumpEmoji, { color: Colors[colorScheme].text }]}>
                  ⬆️
                </Text>
              </Pressable>
            )}
            {canJumpToBottom && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll to bottom"
                style={[
                  styles.scrollJumpButton,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
                onPress={() => {
                  activeScrollViewRef.current?.scrollTo({ y: maxActiveScrollY, animated: true });
                }}
              >
                <Text style={[styles.scrollJumpEmoji, { color: Colors[colorScheme].text }]}>
                  ⬇️
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
      {/* Edit Comment Modal */}
      <Modal
        visible={editCommentId !== null}
        animationType="slide"
        onRequestClose={() => {
          setEditCommentId(null);
          setEditCommentText('');
        }}
      >
        <SafeAreaView
          style={[styles.editModal, { backgroundColor: Colors[colorScheme].background }]}
        >
          <View
            style={[
              styles.editHeader,
              {
                backgroundColor: Colors[colorScheme].surface,
                borderBottomColor: Colors[colorScheme].border,
              },
            ]}
          >
            <Pressable
              onPress={() => {
                setEditCommentId(null);
                setEditCommentText('');
              }}
            >
              <Text style={[styles.cancelButton, { color: Colors[colorScheme].tabIconDefault }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.editTitle, { color: Colors[colorScheme].text }]}>
              Edit Comment
            </Text>
            <Pressable onPress={handleEditComment} disabled={updatingComment}>
              <Text
                style={[
                  styles.saveButton,
                  updatingComment && styles.saveButtonDisabled,
                  {
                    color: updatingComment
                      ? Colors[colorScheme].tabIconDefault
                      : Colors[colorScheme].tint,
                  },
                ]}
              >
                {updatingComment ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.editContent}>
            <TextInput
              style={[
                styles.editCommentInput,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              placeholder="Edit your comment..."
              placeholderTextColor={Colors[colorScheme].tabIconDefault}
              value={editCommentText}
              onChangeText={setEditCommentText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Fullscreen Media Modal */}
      <Modal
        visible={fullscreenMedia}
        animationType="fade"
        onRequestClose={() => {
          setFullscreenMedia(false);
          resetFullscreen();
        }}
      >
        <View style={styles.fullscreenContainer}>
          <Pressable
            style={styles.fullscreenCloseButton}
            onPress={() => {
              setFullscreenMedia(false);
              resetFullscreen();
            }}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </Pressable>

          {currentIsImage && post.media_url && (
            <>
              <GestureDetector gesture={pinchGesture}>
                <Animated.View style={[styles.fullscreenImageWrapper, imageAnimatedStyle]}>
                  <ExpoImage
                    source={{
                      uri:
                        optimizeImageUrl(
                          currentMedia.displayImageUrl || post.media_url,
                          Math.max(1400, Math.round(SCREEN_WIDTH * 2))
                        ) ||
                        currentMedia.displayImageUrl ||
                        post.media_url,
                    }}
                    style={styles.fullscreenImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </Animated.View>
              </GestureDetector>
              {/* Rotate button removed — caused images to flip upside down */}
            </>
          )}

          {currentIsVideo && post.media_url && (
            <VideoPlayer
              uri={post.media_url}
              style={styles.fullscreenVideo}
              autoPlay
              nativeControls
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );

  // Only wrap with edge swipe gesture when viewing single post
  // (multi-post mode uses FlatList horizontal scrolling which conflicts with the gesture)
  if (hasMultiplePosts) return content;
  return <GestureDetector gesture={edgeSwipeGesture}>{content}</GestureDetector>;
}

const styles = StyleSheet.create({
  // Base Layout
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingPlaceholder: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
  },

  // Swipe Hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  swipeHintText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Content
  content: {
    flex: 1,
  },
  scrollJumpOverlay: {
    position: 'absolute',
    right: 16,
    gap: 10,
    alignItems: 'flex-end',
  },
  scrollJumpButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  scrollJumpEmoji: {
    fontSize: 18,
    lineHeight: 20,
  },

  // Hero Section
  heroSection: {
    position: 'relative',
  },
  mediaContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
  },
  heroVideo: {
    width: '100%',
    height: '100%',
  },
  noMediaHero: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  noMediaIcon: {
    fontSize: 48,
  },
  noMediaText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mediaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  mediaTopOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  countryFlag: {
    fontSize: 20,
  },
  liveBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  expandIcon: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 20,
  },

  // Post Content
  postContent: {
    padding: 20,
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  postTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 12,
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  postTextToggle: {
    marginTop: -10,
    marginBottom: 20,
    fontWeight: '700',
  },

  // Game/Event Info
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  gameDetails: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  gameTeams: {
    fontSize: 13,
  },

  // Team Info
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  teamDetails: {
    flex: 1,
  },
  teamTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamSport: {
    fontSize: 13,
  },

  // Author Section
  authorSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  defaultAvatar: {
    backgroundColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  postTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
  },
  followingButton: {},
  followText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followingText: {},

  // Stats & Actions
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  upvoteButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  upvoteButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextActive: {
    fontWeight: '700',
  },

  // Quick Links
  quickLinks: {
    paddingTop: 20,
    marginTop: 20,
    borderTopWidth: 1,
  },
  quickLinksTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Comments Section
  commentsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  commentsCount: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Add Comment
  addCommentWrapper: {},
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  replyingToText: {
    fontSize: 13,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    padding: 8,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Comments List
  commentsList: {
    paddingBottom: 16,
  },
  emptyComments: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyCommentsText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  commentCard: {
    padding: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  commentAuthorInfo: {
    flex: 1,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  commentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  commentActionBtn: {
    padding: 6,
    borderRadius: 6,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  // Edit Modal
  editModal: {
    flex: 1,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    // Color handled dynamically in component
  },
  editContent: {
    flex: 1,
    padding: 16,
  },
  editCommentInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Skeleton Loading Styles
  skeletonButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  skeletonTitle: {
    width: 120,
    height: 20,
    borderRadius: 4,
  },
  skeletonHero: {
    width: '100%',
    height: 280,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLineTitle: {
    width: '80%',
    height: 24,
    marginBottom: 12,
  },
  skeletonLineText: {
    width: '100%',
  },
  skeletonAuthorName: {
    width: '60%',
    height: 16,
    borderRadius: 4,
    marginBottom: 4,
  },
  skeletonAuthorTime: {
    width: '40%',
    height: 12,
    borderRadius: 4,
  },
  skeletonFollowButton: {
    width: 80,
    height: 32,
    borderRadius: 16,
  },
  skeletonCommentsTitle: {
    width: 100,
    height: 20,
    borderRadius: 4,
  },
  skeletonCommentsCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  skeletonCommentAuthor: {
    width: '50%',
    height: 14,
    borderRadius: 4,
    marginBottom: 2,
  },
  skeletonCommentDate: {
    width: '30%',
    height: 12,
    borderRadius: 4,
  },
  skeletonCommentText: {
    width: '90%',
    height: 14,
    borderRadius: 4,
    marginTop: 8,
  },

  // Fullscreen Media Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 24,
  },
  fullscreenRotateButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 24,
  },
  fullscreenImageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
});
