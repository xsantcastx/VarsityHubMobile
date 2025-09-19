import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import VideoPlayer from './VideoPlayer';
import { Post } from '@/api/entities';

type PostCardProps = {
  post: any;
  onPress?: () => void;
};

export default function PostCard({ post, onPress }: PostCardProps) {
  const [bookmarked, setBookmarked] = useState<boolean>(!!post.has_bookmarked);
  const [bookmarksCount, setBookmarksCount] = useState<number>(post.bookmarks_count || 0);
  const [upvotesCount, setUpvotesCount] = useState<number>(post.upvotes_count || 0);

  const onUpvote = async () => {
    try {
      const r: any = await Post.toggleUpvote(String(post.id));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count);
      }
    } catch {}
  };
  const onBookmark = async () => {
    try {
      const r: any = await Post.toggleBookmark(String(post.id));
      if (r && typeof r.bookmarks_count === 'number') {
        setBookmarksCount(r.bookmarks_count);
      }
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch {}
  };
  const isImage = post?.media_url ? /\.(jpg|jpeg|png|gif|webp)$/i.test(post.media_url) : false;
  const isVideo = post?.media_url ? /\.(mp4|mov|webm|m4v)$/i.test(post.media_url) : false;
  const caption = useMemo(() => post.caption || post.content || '', [post.caption, post.content]);

  return (
    <Pressable onPress={onPress} style={styles.container}>
      {isImage ? (
        <Image source={{ uri: post.media_url }} style={styles.media} contentFit="cover" />
      ) : null}
      {isVideo ? (
        <VideoPlayer uri={post.media_url} style={styles.media} />
      ) : null}
      {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
      {caption ? <Text style={styles.content} numberOfLines={2}>{caption}</Text> : null}
      <View style={styles.footer}>
        <Pressable onPress={onUpvote} style={styles.upvoteBtn} accessibilityRole="button" accessibilityLabel="Upvote">
          <Ionicons name="arrow-up" size={14} color="#111827" />
          <Text style={styles.upvoteText}>{upvotesCount}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={styles.metaRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#6B7280" />
          <Text style={styles.metaText}>{post.comments_count || 0}</Text>
        </View>
        <Pressable onPress={onBookmark} style={styles.bookmarkBtn} accessibilityRole="button" accessibilityLabel="Bookmark">
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={16} color={bookmarked ? '#111827' : '#111827'} />
          <Text style={styles.bookmarkText}>{bookmarksCount}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  media: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  content: {
    fontSize: 14,
    color: '#4B5563',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  upvoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  upvoteText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  bookmarkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6', marginLeft: 8 },
  bookmarkText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { color: '#6B7280', fontWeight: '600', fontSize: 12 },
});
