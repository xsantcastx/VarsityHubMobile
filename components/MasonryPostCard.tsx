import { Post, Report } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import PollCard from './PollCard';
import { showErrorToast } from './ErrorToast';

type MasonryPostCardProps = {
  post: any;
  onPress?: () => void;
  onDeleted?: (postId: string) => void;
  onUpdated?: (updatedPost: any) => void;
};

export default function MasonryPostCard({ post, onPress, onDeleted: _onDeleted, onUpdated: _onUpdated }: MasonryPostCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [bookmarked, setBookmarked] = useState<boolean>(!!post.has_bookmarked);
  const [upvotesCount, setUpvotesCount] = useState<number>(post.upvotes_count || 0);
  const [pressed, setPressed] = useState(false);

  const upvoteInFlight = useRef(false);
  const onUpvote = async () => {
    if (upvoteInFlight.current) return;
    upvoteInFlight.current = true;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const r: any = await Post.toggleUpvote(String(post.id));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count);
      }
    } catch (error) {
      if (__DEV__) console.error('[MasonryPostCard] Failed to toggle upvote:', error);
      showErrorToast('Failed to update vote');
    } finally {
      upvoteInFlight.current = false;
    }
  };

  const bookmarkInFlight = useRef(false);
  const onBookmark = async () => {
    if (bookmarkInFlight.current) return;
    bookmarkInFlight.current = true;
    try {
      void Haptics.selectionAsync();
      const r: any = await Post.toggleBookmark(String(post.id));
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch (error) {
      if (__DEV__) console.error('[MasonryPostCard] Failed to toggle bookmark:', error);
      showErrorToast('Failed to save bookmark');
    } finally {
      bookmarkInFlight.current = false;
    }
  };

  const mediaUrl = post?.media_url || post?.mediaUrl || null;
  const previewUrl = post?.preview_url || post?.thumbnail_url || post?.previewUrl || null;
  const mediaType = typeof post?.media_type === 'string' ? post.media_type.toLowerCase() : null;
  const isImage = mediaType === 'image' || (mediaUrl ? /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl) : false);
  const isVideo = mediaType === 'video' || (mediaUrl ? /\.(mp4|mov|webm|m4v)$/i.test(mediaUrl) : false);
  const caption = useMemo(() => post.caption || post.content || '', [post.caption, post.content]);
  const author = post?.author || null;
  const hasPoll = !!post.poll;

  // Calculate dynamic height based on content
  const mediaHeight = useMemo(() => {
    if (!mediaUrl) return 0;
    // Randomize heights for Pinterest-style masonry
    const heights = [180, 220, 260, 300, 340, 280, 240, 200];
    const hash = post.id ? String(post.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    return heights[hash % heights.length];
  }, [post.id, mediaUrl]);

  const handleVotePoll = async (pollId: string, optionId: string) => {
    return Post.voteOnPoll(pollId, optionId);
  };

  const handleReport = () => {
    const reasons = [
      { text: 'Copyright infringement', value: 'copyright' },
      { text: 'Broadcast footage', value: 'broadcast_footage' },
      { text: 'Unauthorized use of my likeness', value: 'unauthorized_likeness' },
      { text: 'Inappropriate content', value: 'inappropriate' },
      { text: 'Spam', value: 'spam' },
      { text: 'Cancel', value: '' },
    ];
    Alert.alert('Report Post', 'Select a reason:', reasons.map(r => ({
      text: r.text,
      style: r.value === '' ? 'cancel' as const : 'default' as const,
      onPress: r.value ? async () => {
        try {
          await Report.create({ target_type: 'post', target_id: String(post.id), reason: r.value });
          Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
        } catch (error: any) {
          if (error?.status === 409) {
            Alert.alert('Already Reported', 'You have already reported this post.');
          } else {
            Alert.alert('Error', error?.message || 'Failed to submit report. Please try again.');
          }
        }
      } : undefined,
    })));
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.container,
        {
          backgroundColor: Colors[colorScheme].card,
          borderColor: Colors[colorScheme].border
        },
        pressed && styles.containerPressed
      ]}
    >
      {/* Author Header */}
      {author ? (
        <View style={styles.authorRow}>
          <Pressable
            style={styles.authorInfo}
            onPress={() => {
              if (!author?.id) return;
              router.push({ pathname: '/(tabs)/user-profile', params: { id: String(author.id), username: author.username || 'User' } });
            }}
          >
            <View style={styles.authorAvatarWrap}>
              {author?.avatar_url ? (
                <Image source={{ uri: String(author.avatar_url) }} style={styles.authorAvatar} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.authorAvatar} />
              )}
            </View>
            <Text numberOfLines={1} style={[styles.authorName, { color: Colors[colorScheme].text }]}>
              {author?.username ? `@${author.username}` : 'User'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Media Section */}
      {(isImage || isVideo) && (
        <View style={[styles.mediaWrap, { height: mediaHeight }]}>
          {isImage && mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="cover" />
          ) : isVideo && previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.media} contentFit="cover" />
          ) : isVideo && mediaUrl ? (
            <View style={[styles.media, { backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialIcons name="videocam" size={28} color="#94a3b8" />
            </View>
          ) : null}
          {isVideo && (
            <View style={styles.playOverlay}>
              <MaterialIcons name="play-arrow" size={24} color="#fff" />
            </View>
          )}
        </View>
      )}

      {/* Poll Section */}
      {hasPoll && <PollCard poll={post.poll} onVote={handleVotePoll} />}

      {/* Caption - show under poll if poll exists, otherwise show normally */}
      {caption && (
        <Text numberOfLines={4} style={[styles.caption, { color: Colors[colorScheme].text }]}>
          {caption}
        </Text>
      )}

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Pressable 
          onPress={onUpvote} 
          style={[styles.actionBtn, { backgroundColor: Colors[colorScheme].tint }]}
        >
          <MaterialIcons name="arrow-upward" size={14} color="#fff" />
          <Text style={styles.actionText}>{upvotesCount}</Text>
        </Pressable>
        
        <View style={styles.metaRow}>
          <MaterialIcons name="chat-bubble-outline" size={14} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>
            {post.comments_count || 0}
          </Text>
        </View>
        
        <View style={{ flex: 1 }} />

        <Pressable onPress={handleReport} style={styles.bookmarkBtn}>
          <MaterialIcons name="flag" size={14} color={Colors[colorScheme].mutedText} />
        </Pressable>

        <Pressable onPress={onBookmark} style={styles.bookmarkBtn}>
          <MaterialIcons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={Colors[colorScheme].text}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 2,
  },
  containerPressed: { 
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorName: {
    fontWeight: '600',
    fontSize: 13,
  },
  mediaWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  metaText: {
    fontWeight: '600',
    fontSize: 12,
  },
  bookmarkBtn: {
    padding: 4,
  },
});
