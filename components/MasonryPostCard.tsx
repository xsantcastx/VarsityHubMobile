import { Post } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PollCard from './PollCard';
import VideoPlayer from './VideoPlayer';

type MasonryPostCardProps = {
  post: any;
  onPress?: () => void;
  onDeleted?: (postId: string) => void;
  onUpdated?: (updatedPost: any) => void;
};

export default function MasonryPostCard({ post, onPress, onDeleted, onUpdated }: MasonryPostCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [bookmarked, setBookmarked] = useState<boolean>(!!post.has_bookmarked);
  const [upvotesCount, setUpvotesCount] = useState<number>(post.upvotes_count || 0);
  const [pressed, setPressed] = useState(false);

  const onUpvote = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const r: any = await Post.toggleUpvote(String(post.id));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count);
      }
    } catch {}
  };

  const onBookmark = async () => {
    try {
      void Haptics.selectionAsync();
      const r: any = await Post.toggleBookmark(String(post.id));
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch {}
  };

  const isImage = post?.media_url ? /\.(jpg|jpeg|png|gif|webp)$/i.test(post.media_url) : false;
  const isVideo = post?.media_url ? /\.(mp4|mov|webm|m4v)$/i.test(post.media_url) : false;
  const caption = useMemo(() => post.caption || post.content || '', [post.caption, post.content]);
  const author = post?.author || null;
  const hasPoll = !!post.poll;

  // Calculate dynamic height based on content
  const mediaHeight = useMemo(() => {
    if (!post.media_url) return 0;
    // Randomize heights for Pinterest-style masonry
    const heights = [180, 220, 260, 300, 340, 280, 240, 200];
    const hash = post.id ? String(post.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    return heights[hash % heights.length];
  }, [post.id, post.media_url]);

  const handleVotePoll = async (pollId: string, optionId: string) => {
    // TODO: Implement API call to vote on poll
    // For now, return a mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        const updatedOptions = post.poll.options.map((opt: any) => 
          opt.id === optionId 
            ? { ...opt, votes: opt.votes + 1 }
            : opt
        );
        resolve({
          options: updatedOptions,
          totalVotes: (post.poll.totalVotes || 0) + 1,
        });
      }, 300);
    });
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
              router.push({ pathname: '/user-profile', params: { id: String(author.id), username: author.username || 'User' } });
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
          {isImage ? (
            <Image source={{ uri: post.media_url }} style={styles.media} contentFit="cover" />
          ) : (
            <VideoPlayer uri={post.media_url} style={styles.media} />
          )}
          {isVideo && (
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          )}
        </View>
      )}

      {/* Poll Section */}
      {hasPoll && <PollCard poll={post.poll} onVote={handleVotePoll} />}

      {/* Caption */}
      {caption && !hasPoll ? (
        <Text numberOfLines={4} style={[styles.caption, { color: Colors[colorScheme].text }]}>
          {caption}
        </Text>
      ) : null}

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Pressable 
          onPress={onUpvote} 
          style={[styles.actionBtn, { backgroundColor: Colors[colorScheme].tint }]}
        >
          <Ionicons name="arrow-up" size={14} color="#fff" />
          <Text style={styles.actionText}>{upvotesCount}</Text>
        </Pressable>
        
        <View style={styles.metaRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>
            {post.comments_count || 0}
          </Text>
        </View>
        
        <View style={{ flex: 1 }} />
        
        <Pressable onPress={onBookmark} style={styles.bookmarkBtn}>
          <Ionicons 
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
