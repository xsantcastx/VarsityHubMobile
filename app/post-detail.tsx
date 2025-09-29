import VideoPlayer from '@/components/VideoPlayer';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore
import { Post as PostApi, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ionicons } from '@expo/vector-icons';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [voting, setVoting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [updatingComment, setUpdatingComment] = useState(false);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      }
    };
    loadUser();
  }, []);

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

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return;
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PostApi.deleteComment(id, commentId);
              setComments(prevComments => prevComments.filter(c => String(c.id) !== commentId));
              Alert.alert('Success', 'Comment deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  const handleEditComment = async () => {
    if (!id || !editCommentId || !editCommentText.trim()) return;
    setUpdatingComment(true);
    try {
      await PostApi.updateComment(id, editCommentId, editCommentText.trim());
      setComments(prevComments => prevComments.map(c => 
        String(c.id) === editCommentId ? { ...c, content: editCommentText.trim() } : c
      ));
      setEditCommentId(null);
      setEditCommentText('');
      Alert.alert('Success', 'Comment updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update comment');
    } finally {
      setUpdatingComment(false);
    }
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
              <View key={String(c.id)} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthor}>
                    <Text style={styles.commentAuthorName}>
                      {c.author?.display_name || 'User'}
                    </Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {currentUser && c.author_id && String(currentUser.id) === String(c.author_id) && (
                    <View style={styles.commentActions}>
                      <Pressable
                        style={styles.commentActionBtn}
                        onPress={() => {
                          setEditCommentId(String(c.id));
                          setEditCommentText(c.content || '');
                        }}
                      >
                        <Ionicons name="pencil" size={16} color="#6B7280" />
                      </Pressable>
                      <Pressable
                        style={styles.commentActionBtn}
                        onPress={() => handleDeleteComment(String(c.id))}
                      >
                        <Ionicons name="trash" size={16} color="#DC2626" />
                      </Pressable>
                    </View>
                  )}
                </View>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            ))
          )}

          {/* Edit Comment Modal */}
          <Modal
            visible={editCommentId !== null}
            animationType="slide"
            onRequestClose={() => {
              setEditCommentId(null);
              setEditCommentText('');
            }}
          >
            <View style={styles.editModal}>
              <View style={styles.editHeader}>
                <Pressable onPress={() => {
                  setEditCommentId(null);
                  setEditCommentText('');
                }}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </Pressable>
                <Text style={styles.editTitle}>Edit Comment</Text>
                <Pressable onPress={handleEditComment} disabled={updatingComment}>
                  <Text style={[styles.saveButton, updatingComment && styles.saveButtonDisabled]}>
                    {updatingComment ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.editContent}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Edit your comment..."
                  value={editCommentText}
                  onChangeText={setEditCommentText}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
              </View>
            </View>
          </Modal>
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
  
  // Comment styles
  commentCard: { 
    backgroundColor: '#F9FAFB', 
    borderRadius: 8, 
    padding: 12, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  commentHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 6 
  },
  commentAuthor: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    flex: 1
  },
  commentAuthorName: { 
    fontWeight: '600', 
    color: '#374151',
    fontSize: 14
  },
  commentDate: { 
    color: '#6B7280', 
    fontSize: 12 
  },
  commentActions: { 
    flexDirection: 'row', 
    gap: 8 
  },
  commentActionBtn: { 
    padding: 4,
    borderRadius: 4
  },
  commentText: { 
    color: '#111827',
    fontSize: 15,
    lineHeight: 20
  },
  
  // Edit modal styles
  editModal: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  editHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E5E7EB' 
  },
  editTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827' 
  },
  cancelButton: { 
    fontSize: 16, 
    color: '#6B7280' 
  },
  saveButton: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#2563EB' 
  },
  saveButtonDisabled: { 
    color: '#9CA3AF' 
  },
  editContent: { 
    flex: 1, 
    padding: 16 
  },
  commentInput: { 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 16, 
    minHeight: 100,
    textAlignVertical: 'top'
  },
});
