import VideoPlayer from '@/components/VideoPlayer';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { Post as PostApi, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [voting, setVoting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, c] = await Promise.all([PostApi.get(id), PostApi.comments(id)]);
      setPost(p);
      setComments(Array.isArray(c) ? c : []);
    } catch (e: any) {
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpvote = async () => {
    if (!id || voting) return;
    setVoting(true);
    try {
      try { await User.me(); } catch { /* ignore */ }
      const r: any = await PostApi.toggleUpvote(id);
      setPost((p: any) => ({ ...(p || {}), upvotes_count: typeof r?.count === 'number' ? r.count : ((p?.upvotes_count || 0) + (r?.upvoted ? 1 : -1)) }));
    } catch {}
    setVoting(false);
  };

  const onAddComment = async () => {
    if (!id || !comment.trim()) return;
    try {
      try { await User.me(); } catch { /* ignore */ }
      const created = await PostApi.addComment(id, comment.trim());
      setComments((arr) => [created, ...arr]);
      setComment('');
    } catch {}
  };

  const isImage = post?.media_url ? /\.(jpg|jpeg|png|gif|webp)$/i.test(post.media_url) : false;
  const isVideo = post?.media_url ? /\.(mp4|mov|webm|m4v)$/i.test(post.media_url) : false;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Post' }} />
      {loading && <View style={styles.center}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {post && !loading && (
        <View style={{ gap: 10 }}>
          {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
          {isImage ? (
            <Image source={{ uri: post.media_url }} style={{ width: '100%', height: 240, borderRadius: 10 }} contentFit="cover" />
          ) : null}
          {isVideo ? (
            <VideoPlayer uri={post.media_url} style={{ width: '100%', height: 260, borderRadius: 10 }} />
          ) : null}
          {post.content ? <Text>{post.content}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={onUpvote} style={styles.likeBtn}>
              <Text style={{ color: 'white', fontWeight: '700' }}>{voting ? '...' : 'Upvote'}</Text>
            </Pressable>
            <Text style={{ color: '#6b7280' }}>{post.upvotes_count || 0} upvotes</Text>
          </View>

          <View style={styles.commentBox}>
            <Input value={comment} onChangeText={setComment} placeholder="Add a comment" style={{ flex: 1 }} />
            <Button variant="outline" onPress={onAddComment}><Text>Send</Text></Button>
          </View>
          <Text style={{ fontWeight: '800', marginTop: 8 }}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={{ color: '#6b7280' }}>No comments yet.</Text>
          ) : (
            comments.map((c) => (
              <Text key={String(c.id)} style={{ marginTop: 6 }}>{c.content}</Text>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c' },
  title: { fontSize: 20, fontWeight: '800' },
  likeBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  commentBox: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
});
