import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Game, Highlights, Post, User } from '@/api/entities';
import { httpGet } from '@/api/http';

const { height: windowHeight, width: windowWidth } = Dimensions.get('window');

let FastImage: any = null;
try {
  FastImage = require('react-native-fast-image');
} catch (error) {
  FastImage = ({ source, style, resizeMode }: any) => (
    <Image
      source={source}
      style={style}
      contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
    />
  );
}

type VoteOption = 'A' | 'B';

export type FeedPost = {
  id: string;
  media_url: string | null;
  media_type: 'video' | 'image';
  caption: string | null;
  upvotes_count: number;
  comments_count: number;
  bookmarks_count: number;
  created_at: string | null;
  author: { id: string; display_name: string | null; avatar_url: string | null } | null;
  has_upvoted: boolean;
  has_bookmarked: boolean;
  is_following_author: boolean;
};

type CommentItem = {
  id: string;
  content: string;
  author?: { display_name?: string | null } | null;
  created_at?: string | null;
  optimistic?: boolean;
};

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;

const mapHighlightToFeedPost = (item: any): FeedPost | null => {
  const idValue = item?.id ?? item?.post_id ?? item?.highlight_id;
  if (!idValue) return null;
  const id = String(idValue);
  const mediaUrl = typeof item?.media_url === 'string' ? item.media_url : null;
  if (!mediaUrl) return null;
  const explicitType = typeof item?.media_type === 'string' ? item.media_type.toLowerCase() : null;
  const mediaType: 'video' | 'image' = explicitType === 'video' || explicitType === 'image'
    ? (explicitType as 'video' | 'image')
    : (VIDEO_EXT.test(mediaUrl) ? 'video' : 'image');
  return {
    id,
    media_url: mediaUrl,
    media_type: mediaType,
    caption: item?.caption ?? item?.title ?? null,
    upvotes_count: typeof item?.upvotes_count === 'number' ? item.upvotes_count : 0,
    comments_count: typeof item?._count?.comments === 'number' ? item._count.comments : (typeof item?.comments_count === 'number' ? item.comments_count : 0),
    bookmarks_count: typeof item?.bookmarks_count === 'number' ? item.bookmarks_count : 0,
    created_at: item?.created_at ?? null,
    author: item?.author ? {
      id: String(item.author.id ?? item.author.user_id ?? id),
      display_name: item.author.display_name ?? item.author.name ?? null,
      avatar_url: item.author.avatar_url ?? item.author.avatarUrl ?? null,
    } : null,
    has_upvoted: Boolean(item?.has_upvoted),
    has_bookmarked: Boolean(item?.has_bookmarked),
    is_following_author: Boolean(item?.is_following_author),
  };
};

type GameSummary = {
  id: string;
  title: string;
  date?: string | null;
};
type GameVerticalFeedScreenProps = {
  onClose?: () => void;
  gameId?: string | null;
  showHeader?: boolean;
  countryCode?: string | null;
  // When provided, the screen acts as a generic vertical viewer for these posts and will not fetch by game.
  initialPosts?: FeedPost[];
  startIndex?: number;
  title?: string | null;
};


const fetchCommentsPage = async (postId: string, cursor?: string | null) => {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return httpGet(`/posts/${encodeURIComponent(postId)}/comments${qs}`);
};

const FeedCard = memo(
  ({
    post,
    isActive,
    onToggleUpvote,
    onToggleBookmark,
    onOpenComments,
    onSharePost,
    onToggleFollow,
    onDoubleTap,
    registerVideo,
    insets,
  }: {
    post: FeedPost;
    isActive: boolean;
    onToggleUpvote: () => void;
    onToggleBookmark: () => void;
    onOpenComments: () => void;
    onSharePost: () => void;
    onToggleFollow: () => void;
    onDoubleTap: () => void;
    registerVideo: (id: string, ref: Video | null) => void;
    insets: { top: number; bottom: number };
  }) => {
    const videoRef = useRef<Video | null>(null);
    const lastTapRef = useRef(0);

    useEffect(() => {
      registerVideo(post.id, videoRef.current);
      return () => registerVideo(post.id, null);
    }, [post.id, registerVideo]);

    useEffect(() => {
      const ref = videoRef.current;
      if (!ref) return;
      if (isActive && post.media_type === 'video') {
        ref.playAsync().catch(() => {});
      } else {
        ref.pauseAsync().catch(() => {});
      }
    }, [isActive, post.media_type]);

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        onDoubleTap();
      }
      lastTapRef.current = now;
    };

    const authorLabel = post.author?.display_name || 'Anonymous';

    return (
      <View style={[styles.card, { height: windowHeight }]}>
        <Pressable style={styles.mediaContainer} onPress={handleTap}>
          {post.media_type === 'video' && post.media_url ? (
            <Video
              ref={videoRef}
              source={{ uri: post.media_url }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={isActive}
              isMuted
            />
          ) : post.media_url ? (
            <FastImage
              source={{ uri: post.media_url }}
              style={styles.media}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.media, styles.textOnlyCard]}>
              <LinearGradient
                colors={["#0b1120", "#020617"]}
                style={StyleSheet.absoluteFillObject as any}
              />
              <View style={styles.textOnlyBadge}>
                <Ionicons name="text" size={14} color="#fff" />
                <Text style={styles.textOnlyBadgeText}>TEXT POST</Text>
              </View>
              <Text style={styles.textOnlyCaption} numberOfLines={6}>
                {post.caption || 'No content'}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={[styles.headerOverlay, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => onToggleFollow()} style={styles.headerAvatar}>
            {post.author?.avatar_url ? (
              <FastImage source={{ uri: post.author.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarFallbackText}>{authorLabel.charAt(0).toUpperCase()}</Text></View>
            )}
            <Text style={styles.authorName}>{authorLabel}</Text>
            <View style={[styles.followBadge, post.is_following_author ? styles.followBadgeActive : null]}>
              <Text style={[styles.followBadgeText, post.is_following_author ? styles.followBadgeTextActive : null]}>{post.is_following_author ? 'Following' : 'Follow'}</Text>
            </View>
          </Pressable>
        </View>

        <View style={[styles.captionOverlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {post.caption ? <Text style={styles.captionText}>{post.caption}</Text> : null}
          <Text style={styles.captionMeta}>{post.created_at ? new Date(post.created_at).toLocaleString() : ''}</Text>
        </View>

        <View style={[styles.rail, { paddingBottom: Math.max(insets.bottom + 24, 96) }]}>
          <Pressable onPress={onToggleFollow} style={styles.railAvatarBtn}>
            {post.author?.avatar_url ? (
              <FastImage source={{ uri: post.author.avatar_url }} style={styles.railAvatarImg} />
            ) : (
              <View style={[styles.railAvatarImg, styles.avatarFallback]}><Text style={styles.avatarFallbackText}>{authorLabel.charAt(0).toUpperCase()}</Text></View>
            )}
            {!post.is_following_author ? (
              <View style={styles.railFollowPlus}>
                <Ionicons name="add" size={16} color="#fff" />
              </View>
            ) : null}
          </Pressable>

          <Pressable onPress={onToggleUpvote} style={styles.railBtn}>
            <Ionicons name={post.has_upvoted ? 'arrow-up' : 'arrow-up-outline'} size={30} color="#fff" />
            <Text style={styles.railLabel}>{post.upvotes_count}</Text>
          </Pressable>

          <Pressable onPress={onOpenComments} style={styles.railBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#fff" />
            <Text style={styles.railLabel}>{post.comments_count}</Text>
          </Pressable>

          <Pressable onPress={onSharePost} style={styles.railBtn}>
            <Ionicons name="share-outline" size={28} color="#fff" />
            <Text style={styles.railLabel}>Share</Text>
          </Pressable>

          <Pressable onPress={onToggleBookmark} style={styles.railBtn}>
            <Ionicons name={post.has_bookmarked ? 'bookmark' : 'bookmark-outline'} size={28} color="#fff" />
            <Text style={styles.railLabel}>{post.bookmarks_count}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
);
FeedCard.displayName = 'FeedCard';

export default function GameVerticalFeedScreen({ onClose, gameId: externalGameId, showHeader = true, countryCode, initialPosts, startIndex = 0, title }: GameVerticalFeedScreenProps = {}) {
  const { id: gameIdParam } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gameId = externalGameId ? String(externalGameId) : (gameIdParam ? String(gameIdParam) : null);
  const usingInitial = useMemo(() => Array.isArray(initialPosts) && initialPosts.length > 0, [initialPosts]);
  const normalizedCountry = useMemo(() => (countryCode ? String(countryCode).toUpperCase() : undefined), [countryCode]);
  const handleBack = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  }, [onClose, router]);

  const [game, setGame] = useState<GameSummary | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<FeedPost | null>(null);

  const videoRefs = useRef<Record<string, Video | null>>({});
  const isScreenFocusedRef = useRef(true);
  const flatListRef = useRef<FlatList<FeedPost>>(null);

  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  useEffect(() => {
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    cursorRef.current = null;
    hasMoreRef.current = true;
    setActiveIndex(0);
    setLoading(true);
    setRefreshing(false);
    setLoadingMore(false);
    setGame(null);
    setComments([]);
    setCommentsCursor(null);
    setCommentTarget(null);
    setCommentsError(null);
    setCommentInput('');
    setCommentSending(false);
    setCommentsVisible(false);
    setCommentsLoading(false);
  }, [gameId, usingInitial]);

  // If acting as a generic viewer with provided posts, seed posts and index.
  useEffect(() => {
    if (!usingInitial) return;
    const items = Array.isArray(initialPosts)
      ? initialPosts.filter((p) => !!p && !!p.id)
      : [];
    setPosts(items);
    setActiveIndex(Math.min(Math.max(0, startIndex || 0), Math.max(0, items.length - 1)));
    setCursor(null);
    cursorRef.current = null;
    setHasMore(false);
    hasMoreRef.current = false;
    setLoading(false);
  }, [usingInitial, initialPosts, startIndex]);

  const registerVideo = useCallback((id: string, ref: Video | null) => {
    if (!ref) {
      delete videoRefs.current[id];
    } else {
      videoRefs.current[id] = ref;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      return () => {
        isScreenFocusedRef.current = false;
        Object.values(videoRefs.current).forEach((ref) => {
          ref?.pauseAsync().catch(() => {});
        });
      };
    }, []),
  );

  useEffect(() => {
    if (usingInitial) return;
    if (!gameId) {
      setGame({ id: 'all-highlights', title: 'All Highlights', date: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const summary: any = await Game.summary(gameId).catch(() => null);
        if (!cancelled && summary) {
          setGame({ id: summary.id, title: summary.title || 'Game', date: summary.date ?? null });
        }
      } catch (error) {
        if (!cancelled) setGame(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, usingInitial]);

  const loadFeed = useCallback(
    async (reset = false) => {
      if (usingInitial) {
        // No-op: using provided posts
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }
      if (!gameId) {
        if (reset) {
          setRefreshing(true);
        }
        try {
          const response = await Highlights.fetch(normalizedCountry ? { country: normalizedCountry, limit: 40 } : { limit: 40 });
          const pools: any[] = [];
          if (Array.isArray(response?.nationalTop)) pools.push(...response.nationalTop);
          if (Array.isArray(response?.ranked)) pools.push(...response.ranked);
          const seen = new Set<string>();
          const mapped: FeedPost[] = [];
          for (const item of pools) {
            const mappedItem = mapHighlightToFeedPost(item);
            if (!mappedItem || !mappedItem.id) continue;
            if (seen.has(mappedItem.id)) continue;
            if (!mappedItem.media_url) continue;
            seen.add(mappedItem.id);
            mapped.push(mappedItem);
          }
          setPosts(mapped);
          cursorRef.current = null;
          setCursor(null);
          hasMoreRef.current = false;
          setHasMore(false);
        } catch (error) {
          if (__DEV__) console.warn('Global highlights feed load failed', error);
        } finally {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
        return;
      }

      if (reset) {
        setRefreshing(true);
      } else if (!hasMoreRef.current) {
        setLoadingMore(false);
        return;
      }

      const currentCursor = reset ? null : cursorRef.current;
      try {
        const page = await Post.feedForGame(gameId, {
          cursor: currentCursor,
          limit: 6,
          sort: 'trending',
        });
        const items = Array.isArray(page?.items) ? page.items : [];
        setPosts((prev) => (reset ? items : [...prev, ...items]));
        const nextCursor = page?.nextCursor ?? null;
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        const more = Boolean(page?.nextCursor);
        hasMoreRef.current = more;
        setHasMore(more);
      } catch (error) {
        if (__DEV__) console.warn('Feed load failed', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [gameId, normalizedCountry, usingInitial],
  );

  useEffect(() => {
    loadFeed(true);
  }, [loadFeed]);

  // When using initial posts, jump to the provided startIndex on mount/update
  useEffect(() => {
    if (!usingInitial) return;
    const target = Math.min(Math.max(0, startIndex || 0), Math.max(0, posts.length - 1));
    if (!posts.length) return;
    try {
      // Give FlatList a tick to mount
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: target, animated: false });
        setActiveIndex(target);
      });
    } catch {}
  }, [usingInitial, posts.length, startIndex]);

  const onEndReached = useCallback(() => {
    if (!gameId) return;
    if (!loading && !loadingMore && hasMoreRef.current) {
      setLoadingMore(true);
      loadFeed(false);
    }
  }, [gameId, loadFeed, loading, loadingMore]);

  const onRefresh = useCallback(() => {
    if (loading) return;
    cursorRef.current = null;
    hasMoreRef.current = true;
    setCursor(null);
    setHasMore(true);
    loadFeed(true);
  }, [loadFeed, loading]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      const first = viewableItems[0];
      const index = first?.index ?? 0;
      setActiveIndex(index);
    }
  }).current;

  useEffect(() => {
    const activeId = posts[activeIndex]?.id;
    Object.entries(videoRefs.current).forEach(([postId, ref]) => {
      if (!ref) return;
      if (postId === activeId && posts[activeIndex]?.media_type === 'video' && isScreenFocusedRef.current) {
        ref.playAsync().catch(() => {});
      } else {
        ref.pauseAsync().catch(() => {});
      }
    });
  }, [activeIndex, posts]);

  const updatePost = useCallback((postId: string, updater: (post: FeedPost) => FeedPost) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? updater(post) : post)));
  }, []);

  const optimisticUpdateAllFromAuthor = useCallback((authorId: string, updater: (post: FeedPost) => FeedPost) => {
    setPosts((prev) => prev.map((post) => (post.author?.id === authorId ? updater(post) : post)));
  }, []);

  const handleToggleUpvote = useCallback(
    async (post: FeedPost) => {
      const optimisticNext = !post.has_upvoted;
      updatePost(post.id, (p) => ({
        ...p,
        has_upvoted: optimisticNext,
        upvotes_count: Math.max(0, p.upvotes_count + (optimisticNext ? 1 : -1)),
      }));
      try {
        const res: any = await Post.toggleUpvote(post.id);
        updatePost(post.id, (p) => ({
          ...p,
          has_upvoted: Boolean(res?.has_upvoted ?? res?.upvoted),
          upvotes_count: typeof res?.upvotes_count === 'number' ? res.upvotes_count : typeof res?.count === 'number' ? res.count : p.upvotes_count,
        }));
      } catch (error) {
        updatePost(post.id, (p) => ({
          ...p,
          has_upvoted: post.has_upvoted,
          upvotes_count: p.upvotes_count + (post.has_upvoted ? 1 : -1),
        }));
      }
    },
    [updatePost],
  );

  const handleToggleBookmark = useCallback(
    async (post: FeedPost) => {
      const optimisticNext = !post.has_bookmarked;
      updatePost(post.id, (p) => ({
        ...p,
        has_bookmarked: optimisticNext,
        bookmarks_count: Math.max(0, p.bookmarks_count + (optimisticNext ? 1 : -1)),
      }));
      try {
        const res: any = await Post.toggleBookmark(post.id);
        updatePost(post.id, (p) => ({
          ...p,
          has_bookmarked: Boolean(res?.has_bookmarked ?? res?.bookmarked),
          bookmarks_count: typeof res?.bookmarks_count === 'number' ? res.bookmarks_count : p.bookmarks_count,
        }));
      } catch (error) {
        updatePost(post.id, (p) => ({
          ...p,
          has_bookmarked: post.has_bookmarked,
          bookmarks_count: p.bookmarks_count + (post.has_bookmarked ? 1 : -1),
        }));
      }
    },
    [updatePost],
  );

  const handleToggleFollow = useCallback(
    async (post: FeedPost) => {
      const authorId = post.author?.id;
      if (!authorId) return;
      const optimisticNext = !post.is_following_author;
      optimisticUpdateAllFromAuthor(authorId, (p) => ({ ...p, is_following_author: optimisticNext }));
      try {
        if (optimisticNext) {
          const res: any = await User.follow(authorId);
          const isFollowing = Boolean(res?.is_following_author ?? true);
          optimisticUpdateAllFromAuthor(authorId, (p) => ({ ...p, is_following_author: isFollowing }));
        } else {
          await User.unfollow(authorId);
          optimisticUpdateAllFromAuthor(authorId, (p) => ({ ...p, is_following_author: false }));
        }
      } catch (error) {
        optimisticUpdateAllFromAuthor(authorId, (p) => ({ ...p, is_following_author: post.is_following_author }));
      }
    },
    [optimisticUpdateAllFromAuthor],
  );

  const handleShare = useCallback((post: FeedPost) => {
   const deepLink = `${process.env.EXPO_PUBLIC_APP_BASE_URL || 'https://varsityhub.app'}/posts/${post.id}`;
   const message = post.caption ? `${post.caption}\n${deepLink}` : deepLink;
   Share.share({ message }).catch(() => {});
  }, []);

  const openComments = useCallback(
    async (post: FeedPost) => {
      setCommentTarget(post);
      setCommentsVisible(true);
      setComments([]);
      setCommentsCursor(null);
      setCommentsError(null);
      setCommentsLoading(true);
      try {
        const res: any = await fetchCommentsPage(post.id);
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setComments(items);
        setCommentsCursor(res?.nextCursor ?? null);
      } catch (error: any) {
        setCommentsError(error?.message || 'Failed to load comments');
      } finally {
        setCommentsLoading(false);
      }
    },
    [],
  );

  const loadMoreComments = useCallback(async () => {
    if (!commentTarget || !commentsCursor || commentsLoading) return;
    setCommentsLoading(true);
    try {
      const res: any = await fetchCommentsPage(commentTarget.id, commentsCursor);
      const items = Array.isArray(res?.items) ? res.items : [];
      setComments((prev) => [...prev, ...items]);
      setCommentsCursor(res?.nextCursor ?? null);
    } catch (error) {
      setCommentsCursor(null);
    } finally {
      setCommentsLoading(false);
    }
  }, [commentTarget, commentsCursor, commentsLoading]);

  const handleSendComment = useCallback(async () => {
    if (!commentTarget || !commentInput.trim() || commentSending) return;
    const optimistic: CommentItem = {
      id: `pending-${Date.now()}`,
      content: commentInput,
      optimistic: true,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);
    setCommentInput('');
    setCommentSending(true);
    try {
      const res: any = await Post.addComment(commentTarget.id, optimistic.content);
      setComments((prev) => [res, ...prev.filter((c) => !c.optimistic)]);
      updatePost(commentTarget.id, (p) => ({ ...p, comments_count: p.comments_count + 1 }));
    } catch (error) {
      setComments((prev) => prev.filter((c) => !c.optimistic));
      setCommentsError('Unable to send comment right now.');
    } finally {
      setCommentSending(false);
    }
  }, [commentInput, commentSending, commentTarget, updatePost]);

  const handleDoubleTap = useCallback(
    (post: FeedPost) => {
      if (!post.has_upvoted) {
        handleToggleUpvote(post);
      }
    },
    [handleToggleUpvote],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => (
      <FeedCard
        key={item.id}
        post={item}
        isActive={index === activeIndex}
        onToggleUpvote={() => handleToggleUpvote(item)}
        onToggleBookmark={() => handleToggleBookmark(item)}
        onOpenComments={() => openComments(item)}
        onSharePost={() => handleShare(item)}
        onToggleFollow={() => handleToggleFollow(item)}
        onDoubleTap={() => handleDoubleTap(item)}
        registerVideo={registerVideo}
        insets={{ top: insets.top, bottom: insets.bottom }}
      />
    ),
    [activeIndex, handleDoubleTap, handleShare, handleToggleBookmark, handleToggleFollow, handleToggleUpvote, insets.bottom, insets.top, openComments, registerVideo],
  );

  const keyExtractor = useCallback((item: FeedPost) => item.id, []);

  if (!gameId && !usingInitial) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>Missing game id</Text>
        <Pressable onPress={handleBack} style={styles.emptyStateBtn}>
          <Text style={styles.emptyStateBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <LinearGradient
        colors={['#0b1120', '#020617']}
        style={styles.backdrop}
        pointerEvents="none"
      />
      <FlatList
        ref={flatListRef as any}
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={windowHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        initialScrollIndex={usingInitial ? Math.min(Math.max(0, startIndex || 0), Math.max(0, posts.length - 1)) : undefined}
        getItemLayout={(_, index) => ({ length: windowHeight, offset: windowHeight * index, index })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}><ActivityIndicator color="#fff" /></View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No posts yet</Text>
              <Text style={styles.emptyStateCaption}>Be the first to create a post for this game.</Text>
            </View>
          )
        }
      />

      {showHeader ? (
        <View style={[styles.titleOverlay, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.titleTextWrap}>
            <Text style={styles.titleText}>{usingInitial ? (title || 'Posts') : (game?.title || 'Game')}</Text>
            {!usingInitial && game?.date ? <Text style={styles.titleSubtitle}>{new Date(game.date).toLocaleDateString()}</Text> : null}
          </View>
        </View>
      ) : null}

      <Modal
        visible={commentsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.commentModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.commentSheet, { maxHeight: windowHeight * 0.75 }]} pointerEvents="box-none"> 
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Comments</Text>
              <Pressable onPress={() => setCommentsVisible(false)} style={styles.commentCloseBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            {commentsLoading && comments.length === 0 ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />
            ) : null}
            {commentsError ? <Text style={styles.commentError}>{commentsError}</Text> : null}
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Text style={styles.commentAuthor}>{item.author?.display_name || 'Anonymous'}</Text>
                  <Text style={styles.commentBody}>{item.content}</Text>
                  {item.created_at ? <Text style={styles.commentTimestamp}>{new Date(item.created_at).toLocaleString()}</Text> : null}
                </View>
              )}
              onEndReached={loadMoreComments}
              onEndReachedThreshold={0.4}
              ListFooterComponent={commentsCursor ? <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} /> : null}
            />
            <View style={styles.commentComposer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#6b7280"
                value={commentInput}
                onChangeText={setCommentInput}
                editable={!commentSending}
              />
              <Pressable
                style={[styles.commentSendBtn, commentSending || !commentInput.trim() ? styles.commentSendDisabled : null]}
                onPress={handleSendComment}
                disabled={commentSending || !commentInput.trim()}
              >
                <Text style={styles.commentSendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: { width: windowWidth, backgroundColor: 'transparent' },
  mediaContainer: { flex: 1 },
  media: { width: '100%', height: '100%' },
  mediaFallback: { alignItems: 'center', justifyContent: 'center' },
  mediaFallbackText: { color: '#fff', fontWeight: '700' },
  textOnlyCard: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  textOnlyBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textOnlyBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11, marginLeft: 6 },
  textOnlyCaption: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 26 },
  headerOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  headerAvatar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#fff', fontWeight: '700' },
  authorName: { color: '#fff', marginLeft: 8, fontWeight: '700' },
  followBadge: {
    marginLeft: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f87171',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  followBadgeActive: { borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.15)' },
  followBadgeText: { color: '#f87171', fontWeight: '700', fontSize: 12 },
  followBadgeTextActive: { color: '#34d399' },
  captionOverlay: {
    position: 'absolute',
    left: 16,
    right: 88,
    bottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  captionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  captionMeta: { color: '#cbd5f5', fontSize: 12, marginTop: 6 },
  rail: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    alignItems: 'center',
  },
  railAvatarBtn: {
    marginBottom: 18,
  },
  railAvatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1f2937' },
  railFollowPlus: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  railBtn: { alignItems: 'center', marginBottom: 18 },
  railLabel: { color: '#fff', fontWeight: '600', marginTop: 4, fontSize: 13 },
  titleOverlay: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextWrap: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  titleText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  titleSubtitle: { color: '#cbd5f5', marginTop: 2, fontSize: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyStateTitle: { color: '#fff', fontWeight: '800', fontSize: 18 },
  emptyStateCaption: { color: '#cbd5f5', marginTop: 8, textAlign: 'center' },
  emptyStateBtn: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyStateBtnText: { color: '#fff', fontWeight: '700' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  commentModalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  commentSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    minHeight: windowHeight * 0.4,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  commentTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  commentCloseBtn: { position: 'absolute', right: 0, padding: 6 },
  commentError: { color: '#f97316', marginVertical: 8, textAlign: 'center' },
  commentRow: { marginBottom: 14 },
  commentAuthor: { color: '#fff', fontWeight: '700' },
  commentBody: { color: '#e5e7eb', marginTop: 4 },
  commentTimestamp: { color: '#9ca3af', marginTop: 4, fontSize: 12 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  commentInput: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 12,
  },
  commentSendBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  commentSendDisabled: { backgroundColor: '#475569' },
  commentSendText: { color: '#fff', fontWeight: '700' },
});

