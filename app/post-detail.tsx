import VideoPlayer from '@/components/VideoPlayer';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Post as PostApi, User } from '@/api/entities';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const timeAgo = (value?: string | Date | null) => {
  if (!value) return '';
  const ts = typeof value === 'string' ? new Date(value).getTime() : new Date(value).getTime();
  const diff = Math.max(0, Date.now() - ts) / 1000;
  const days = Math.floor(diff / 86400);
  if (days >= 30) return '1 month ago';
  if (days >= 7) return `${Math.floor(days / 7)}w ago`;
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes >= 1) return `${minutes}m ago`;
  return 'now';
};

const formatCount = (value?: number | null) => {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
};

const getCountryFlag = (countryCode?: string | null) => {
  const flags: { [key: string]: string } = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'AU': '🇦🇺', 'DE': '🇩🇪',
    'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'MX': '🇲🇽',
  };
  return flags[countryCode || ''] || '🌍';
};

const getSportCategory = (title?: string | null, content?: string | null) => {
  const text = (title + ' ' + content || '').toLowerCase();
  if (text.includes('football') || text.includes('nfl')) return { name: 'Football', icon: '🏈', color: '#8B5A2B' };
  if (text.includes('basketball') || text.includes('nba')) return { name: 'Basketball', icon: '🏀', color: '#FF6B35' };
  if (text.includes('baseball') || text.includes('mlb')) return { name: 'Baseball', icon: '⚾', color: '#2E8B57' };
  if (text.includes('soccer') || text.includes('fifa')) return { name: 'Soccer', icon: '⚽', color: '#4169E1' };
  if (text.includes('hockey') || text.includes('nhl')) return { name: 'Hockey', icon: '🏒', color: '#1C1C1C' };
  if (text.includes('tennis')) return { name: 'Tennis', icon: '🎾', color: '#228B22' };
  return { name: 'Sports', icon: '🏆', color: '#FF6B35' };
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [voting, setVoting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [updatingComment, setUpdatingComment] = useState(false);
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);

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
      
      // Handle comments response - it returns { items, nextCursor }
      let commentsArray = [];
      if (Array.isArray(c)) {
        commentsArray = c;
      } else if (c && Array.isArray(c.items)) {
        commentsArray = c.items;
      }
      setComments(commentsArray);
      
      // Initialize follow and save states from post data
      if (p) {
        if (typeof p.is_following_author === 'boolean') {
          setFollowing(p.is_following_author);
        }
        if (typeof p.has_bookmarked === 'boolean') {
          setSaved(p.has_bookmarked);
        }
        // Note: has_upvoted is stored directly in post state for UI
      }
    } catch (e: any) {
      setError('Failed to load post');
      console.error('Error loading post and comments:', e);
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
      const r: any = await PostApi.toggleUpvote(id);
      // Update post upvote count and user's upvote status
      setPost((p: any) => ({
        ...(p || {}),
        upvotes_count: typeof r?.count === 'number' ? r.count : r?.upvotes_count || (p?.upvotes_count || 0),
        has_upvoted: typeof r?.has_upvoted === 'boolean' ? r.has_upvoted : r?.upvoted || false
      }));
    } catch (error) {
      console.error('Error toggling upvote:', error);
      console.error('Upvote error details:', error?.response?.data || error?.message || error);
    } finally {
      setVoting(false);
    }
  };

  const onAddComment = async () => {
    if (!id || !comment.trim()) return;
    setCommenting(true);
    try {
      const created = await PostApi.addComment(id, comment.trim());
      setComments((arr) => [created, ...arr]);
      setComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      console.error('Comment error details:', error?.response?.data || error?.message || error);
    } finally {
      setCommenting(false);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${post?.title ? post.title : 'sports post'} on VarsityHub!`,
        url: `https://varsityhub.com/post/${id}`,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const onFollow = async () => {
    if (!post?.author_id) return;
    
    try {
      if (following) {
        // Unfollow
        await User.unfollow(post.author_id);
        setFollowing(false);
      } else {
        // Follow
        await User.follow(post.author_id);
        setFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert optimistic update on error
      setFollowing(following);
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
    } catch (error) {
      console.error('Error toggling save:', error);
      // Revert optimistic update on error
      setSaved(saved);
    }
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
  const category = getSportCategory(post?.title, post?.content);
  const hasMedia = !!post?.media_url;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) return null;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Post Details</Text>
        <Pressable style={styles.shareButton} onPress={onShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Media Section */}
        <View style={styles.heroSection}>
          {hasMedia ? (
            <View style={styles.mediaContainer}>
              {isImage && (
                <ExpoImage source={{ uri: post.media_url }} style={styles.heroImage} contentFit="cover" />
              )}
              {isVideo && (
                <View style={styles.videoContainer}>
                  <VideoPlayer uri={post.media_url} style={styles.heroVideo} />
                </View>
              )}
              
              {/* Media Overlay */}
              <LinearGradient 
                colors={['transparent', 'rgba(0,0,0,0.8)']} 
                style={styles.mediaOverlay}
              />
              
              {/* Category Badge */}
              <View style={styles.mediaTopOverlay}>
                <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={styles.categoryText}>{category.name}</Text>
                </View>
                <Text style={styles.countryFlag}>{getCountryFlag(post.country_code)}</Text>
              </View>
              
              {/* Live Badge */}
              {post.created_at && new Date(post.created_at).getTime() > Date.now() - 3600000 && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
          ) : (
            <LinearGradient 
              colors={[category.color + '40', category.color + '20']} 
              style={styles.noMediaHero}
            >
              <Text style={styles.noMediaIcon}>{category.icon}</Text>
              <Text style={styles.noMediaText}>Text Post</Text>
            </LinearGradient>
          )}
        </View>

        {/* Post Content */}
        <View style={styles.postContent}>
          {/* Title */}
          {post.title && (
            <Text style={styles.postTitle}>{post.title}</Text>
          )}
          
          {/* Content */}
          {post.content && (
            <Text style={styles.postText}>{post.content}</Text>
          )}

          {/* Author Info */}
          <View style={styles.authorSection}>
            <View style={styles.authorInfo}>
              {post.author?.avatar_url ? (
                <ExpoImage source={{ uri: post.author.avatar_url }} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorAvatar, styles.defaultAvatar]}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
              )}
              <View style={styles.authorDetails}>
                <Text style={styles.authorName}>
                  {post.author?.display_name || 'Anonymous'}
                </Text>
                <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
              </View>
            </View>
            
            {post.author_id && String(post.author_id) !== String(currentUser?.id) && (
              <Pressable 
                style={[styles.followButton, following && styles.followingButton]} 
                onPress={onFollow}
              >
                <Ionicons 
                  name={following ? "checkmark" : "person-add"} 
                  size={16} 
                  color={following ? "#10B981" : "#2563EB"} 
                />
                <Text style={[styles.followText, following && styles.followingText]}>
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Stats & Actions */}
          <View style={styles.statsSection}>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Ionicons name="arrow-up" size={18} color="#2563EB" />
                <Text style={styles.statText}>{formatCount(post.upvotes_count || 0)}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
                <Text style={styles.statText}>{formatCount(comments.length || 0)}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="eye-outline" size={18} color="#6B7280" />
                <Text style={styles.statText}>{formatCount((post.upvotes_count || 0) * 12)}</Text>
              </View>
            </View>
            
            <View style={styles.actions}>
              <Pressable 
                style={[
                  styles.actionButton, 
                  styles.upvoteButton,
                  post?.has_upvoted && styles.upvoteButtonActive
                ]} 
                onPress={onUpvote}
                disabled={voting}
              >
                <Ionicons 
                  name={post?.has_upvoted ? "arrow-up" : "arrow-up-outline"} 
                  size={20} 
                  color={post?.has_upvoted ? "#fff" : "#fff"} 
                />
                <Text style={[styles.actionText, post?.has_upvoted && styles.actionTextActive]}>
                  {voting ? '...' : (post?.has_upvoted ? 'Upvoted' : 'Upvote')}
                </Text>
              </Pressable>
              
              <Pressable style={styles.actionButton} onPress={onSave}>
                <Ionicons 
                  name={saved ? "bookmark" : "bookmark-outline"} 
                  size={20} 
                  color={saved ? "#FFB800" : "#6B7280"} 
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <Text style={styles.commentsCount}>{comments.length}</Text>
          </View>
          
          {/* Add Comment */}
          <View style={styles.addCommentContainer}>
            {currentUser?.avatar_url ? (
              <ExpoImage source={{ uri: currentUser.avatar_url }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                <Ionicons name="person" size={16} color="#fff" />
              </View>
            )}
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <Pressable 
              style={[styles.sendButton, (commenting || !comment.trim()) && styles.sendButtonDisabled]} 
              onPress={onAddComment}
              disabled={commenting || !comment.trim()}
            >
              <Ionicons 
                name="send" 
                size={18} 
                color={(commenting || !comment.trim()) ? "#94a3b8" : "#2563EB"} 
              />
            </Pressable>
          </View>

          {/* Comments List */}
          {comments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>Be the first to share your thoughts!</Text>
            </View>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((c) => (
                <View key={String(c.id)} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAuthor}>
                      {c.author?.avatar_url ? (
                        <ExpoImage source={{ uri: c.author.avatar_url }} style={styles.commentAvatar} />
                      ) : (
                        <View style={[styles.commentAvatar, styles.defaultAvatar]}>
                          <Ionicons name="person" size={16} color="#fff" />
                        </View>
                      )}
                      <View style={styles.commentAuthorInfo}>
                        <Text style={styles.commentAuthorName}>
                          {c.author?.display_name || 'User'}
                        </Text>
                        <Text style={styles.commentDate}>{timeAgo(c.created_at)}</Text>
                      </View>
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
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Comment Modal */}
      <Modal
        visible={editCommentId !== null}
        animationType="slide"
        onRequestClose={() => {
          setEditCommentId(null);
          setEditCommentText('');
        }}
      >
        <SafeAreaView style={styles.editModal}>
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
              style={styles.editCommentInput}
              placeholder="Edit your comment..."
              value={editCommentText}
              onChangeText={setEditCommentText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Base Layout
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
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
    color: '#DC2626',
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
    paddingVertical: 12,
    backgroundColor: '#111827',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
  },

  // Content
  content: {
    flex: 1,
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
    color: 'rgba(255, 255, 255, 0.9)',
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

  // Post Content
  postContent: {
    backgroundColor: '#fff',
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
    color: '#111827',
    lineHeight: 32,
    marginBottom: 12,
  },
  postText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 20,
  },

  // Author Section
  authorSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    color: '#111827',
    marginBottom: 2,
  },
  postTime: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 20,
  },
  followingButton: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  followText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  followingText: {
    color: '#10B981',
  },

  // Stats & Actions
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Comments Section
  commentsSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  commentsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Add Comment
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
    color: '#374151',
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  commentCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    color: '#374151',
    marginBottom: 2,
  },
  commentDate: {
    fontSize: 12,
    color: '#9CA3AF',
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
    color: '#111827',
    lineHeight: 20,
  },

  // Edit Modal
  editModal: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  saveButtonDisabled: {
    color: '#9CA3AF',
  },
  editContent: {
    flex: 1,
    padding: 16,
  },
  editCommentInput: {
    backgroundColor: '#fff',
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
});