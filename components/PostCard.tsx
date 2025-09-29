import { Post, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Alert, Modal, TextInput } from 'react-native';
import VideoPlayer from './VideoPlayer';

type PostCardProps = {
  post: any;
  onPress?: () => void;
  showAuthorHeader?: boolean; // show avatar + name at top of card
  onDeleted?: (postId: string) => void; // callback when post is deleted
  onUpdated?: (updatedPost: any) => void; // callback when post is updated
};

export default function PostCard({ post, onPress, showAuthorHeader = true, onDeleted, onUpdated }: PostCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [bookmarked, setBookmarked] = useState<boolean>(!!post.has_bookmarked);
  const [bookmarksCount, setBookmarksCount] = useState<number>(post.bookmarks_count || 0);
  const [upvotesCount, setUpvotesCount] = useState<number>(post.upvotes_count || 0);
  const [pressed, setPressed] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editTitle, setEditTitle] = useState(post.title || '');
  const [updating, setUpdating] = useState(false);

  // Load current user to check ownership
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        // User not logged in or error occurred
        setCurrentUser(null);
      }
    };
    loadUser();
  }, []);

  const onUpvote = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const r: any = await Post.toggleUpvote(String(post.id));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count);
      }
    } catch {}
  };
  const onBookmark = async () => {
    try {
      Haptics.selectionAsync();
      const r: any = await Post.toggleBookmark(String(post.id));
      if (r && typeof r.bookmarks_count === 'number') {
        setBookmarksCount(r.bookmarks_count);
      }
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch {}
  };

  const handleDeletePost = async () => {
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
              await Post.delete(String(post.id));
              onDeleted?.(String(post.id));
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  const handleEditPost = async () => {
    if (!editContent.trim() && !editTitle.trim()) {
      Alert.alert('Error', 'Post must have content or title');
      return;
    }
    setUpdating(true);
    try {
      const updateData: { content?: string; title?: string } = {};
      if (editContent.trim()) updateData.content = editContent.trim();
      if (editTitle.trim()) updateData.title = editTitle.trim();
      
      await Post.update(String(post.id), updateData);
      const updatedPost = { ...post, ...updateData };
      onUpdated?.(updatedPost);
      setEditModalVisible(false);
      Alert.alert('Success', 'Post updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update post');
    } finally {
      setUpdating(false);
    }
  };

  // Check if current user is the author of this post
  const isAuthor = currentUser && post.author_id && String(currentUser.id) === String(post.author_id);
  const isImage = post?.media_url ? /\.(jpg|jpeg|png|gif|webp)$/i.test(post.media_url) : false;
  const isVideo = post?.media_url ? /\.(mp4|mov|webm|m4v)$/i.test(post.media_url) : false;
  const caption = useMemo(() => post.caption || post.content || '', [post.caption, post.content]);
  const author = post?.author || null;

  // Try to derive team labels (Team A vs Team B) for a sports ribbon
  const deriveTeamLabels = (p: any): { teamA: string; teamB: string } | null => {
    if (!p) return null;
    const anyP: any = p as any;
    // Structured
    if (Array.isArray(anyP.teams) && anyP.teams.length >= 2) {
      const a = String(anyP.teams[0]?.name || '').trim();
      const b = String(anyP.teams[1]?.name || '').trim();
      if (a || b) return { teamA: a || 'Team A', teamB: b || 'Team B' };
    }
    const a = anyP.team_a?.name || anyP.teamA?.name || anyP.team_a_name || anyP.teamAName;
    const b = anyP.team_b?.name || anyP.teamB?.name || anyP.team_b_name || anyP.teamBName;
    if (a || b) return { teamA: String(a || 'Team A'), teamB: String(b || 'Team B') };
    // From title/caption using vs
    const source = [String(anyP.title || ''), String(anyP.caption || anyP.content || '')].join(' \u2022 ');
    const parts = source.split(/\s+vs\.?\s+/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return { teamA: parts[0], teamB: parts[1] };
    return null;
  };
  const teamLabels = useMemo(() => deriveTeamLabels(post), [post]);

  const StatPill = ({ icon, value }: { icon: any; value: number }) => (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={12} color="#fff" />
      <Text style={styles.statPillText}>{value}</Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.container, pressed && styles.containerPressed]}
    >
      {showAuthorHeader && author ? (
        <View style={styles.authorRow}>
          <Pressable
            style={styles.authorInfo}
            onPress={() => {
              if (!author?.id) return;
              router.push({ pathname: '/user-profile', params: { id: String(author.id), username: author.display_name || 'User' } });
            }}
          >
            <View style={styles.authorAvatarWrap}>
              {author?.avatar_url ? (
                <Image source={{ uri: String(author.avatar_url) }} style={styles.authorAvatar} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.authorAvatar} />
              )}
            </View>
            <Text numberOfLines={1} style={[styles.authorName, { color: Colors[colorScheme].text }]}>{author?.display_name || 'User'}</Text>
          </Pressable>
          {isAuthor && (
            <Pressable
              style={styles.actionsButton}
              onPress={() => setShowActionsMenu(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={Colors[colorScheme].text} />
            </Pressable>
          )}
        </View>
      ) : null}
      {/* Top accent stripe */}
      <LinearGradient colors={["#1e293b", "#0f172a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topAccent} />

      {/* Media section */}
      {(isImage || isVideo) ? (
        <View style={styles.mediaWrap}>
          {isImage ? (
            <Image source={{ uri: post.media_url }} style={styles.media} contentFit="cover" />
          ) : (
            <VideoPlayer uri={post.media_url} style={styles.media} />
          )}
          {/* Overlays */}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.mediaGradient} />
          {teamLabels ? (
            <View style={styles.teamRowOverlay}>
              <View style={styles.teamPill}><Text style={styles.teamPillText}>{teamLabels.teamA}</Text></View>
              <Text style={styles.vsText}>vs</Text>
              <View style={styles.teamPillAlt}><Text style={styles.teamPillAltText}>{teamLabels.teamB}</Text></View>
            </View>
          ) : null}
          {caption ? (
            <Text numberOfLines={2} style={styles.captionOverlay}>{caption}</Text>
          ) : null}
          <View style={styles.mediaStatsRow}>
            <StatPill icon="arrow-up" value={upvotesCount} />
            <StatPill icon="chatbubble-ellipses" value={post.comments_count || 0} />
          </View>
          {isVideo ? (
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          ) : null}
        </View>
      ) : (
        // Text-only sport-styled tile
        <View style={styles.textTile}>
          <LinearGradient colors={["#0b1120", "#0b1120", "#020617"]} style={StyleSheet.absoluteFillObject as any} />
          {teamLabels ? (
            <View style={[styles.teamRowOverlay, { top: 8, left: 8, right: 8, position: 'absolute' }]}>
              <View style={styles.teamPill}><Text style={styles.teamPillText}>{teamLabels.teamA}</Text></View>
              <Text style={styles.vsText}>vs</Text>
              <View style={styles.teamPillAlt}><Text style={styles.teamPillAltText}>{teamLabels.teamB}</Text></View>
            </View>
          ) : null}
          <Text numberOfLines={4} style={styles.textTileCaption}>{caption || 'Post'}</Text>
          <View style={styles.mediaStatsRow}>
            <StatPill icon="arrow-up" value={upvotesCount} />
            <StatPill icon="chatbubble-ellipses" value={post.comments_count || 0} />
          </View>
        </View>
      )}

      {/* Meta + actions footer */}
      <View style={styles.footer}>
        <Pressable onPress={onUpvote} style={styles.upvoteBtn} accessibilityRole="button" accessibilityLabel="Upvote">
          <Ionicons name="arrow-up" size={16} color="#fff" />
          <Text style={styles.upvoteText}>{upvotesCount}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={styles.metaRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>{post.comments_count || 0}</Text>
        </View>
        <Pressable onPress={onBookmark} style={[styles.bookmarkBtn, { backgroundColor: Colors[colorScheme].surface }]} accessibilityRole="button" accessibilityLabel="Bookmark">
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={Colors[colorScheme].text} />
          <Text style={[styles.bookmarkText, { color: Colors[colorScheme].text }]}>{bookmarksCount}</Text>
        </Pressable>
      </View>

      {/* Actions Menu Modal */}
      <Modal
        visible={showActionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowActionsMenu(false)}
        >
          <View style={styles.actionsMenu}>
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                setShowActionsMenu(false);
                setEditModalVisible(true);
              }}
            >
              <Ionicons name="pencil" size={20} color="#374151" />
              <Text style={styles.actionText}>Edit Post</Text>
            </Pressable>
            <View style={styles.actionSeparator} />
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                setShowActionsMenu(false);
                handleDeletePost();
              }}
            >
              <Ionicons name="trash" size={20} color="#dc2626" />
              <Text style={[styles.actionText, { color: '#dc2626' }]}>Delete Post</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModal}>
          <View style={styles.editHeader}>
            <Pressable onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </Pressable>
            <Text style={styles.editTitle}>Edit Post</Text>
            <Pressable onPress={handleEditPost} disabled={updating}>
              <Text style={[styles.saveButton, updating && styles.saveButtonDisabled]}>
                {updating ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.editContent}>
            <TextInput
              style={styles.titleInput}
              placeholder="Title (optional)"
              value={editTitle}
              onChangeText={setEditTitle}
              multiline
            />
            <TextInput
              style={styles.contentInput}
              placeholder="What's happening?"
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  containerPressed: { transform: [{ scale: 0.995 }] },
  topAccent: { height: 4, borderRadius: 999, marginBottom: 10 },
  mediaWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  media: { width: '100%', height: 220 },
  mediaGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  captionOverlay: { position: 'absolute', left: 10, right: 10, bottom: 10, color: 'white', fontWeight: '700' },
  mediaStatsRow: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(17,24,39,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statPillText: { color: 'white', fontWeight: '800', fontSize: 12 },
  playOverlay: { position: 'absolute', top: '45%', left: '45%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  textTile: { height: 180, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 12, marginBottom: 10 },
  textTileCaption: { color: 'white', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  upvoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#111827' },
  upvoteText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  bookmarkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', marginLeft: 8 },
  bookmarkText: { color: '#111827', fontWeight: '800', fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  metaText: { color: '#6B7280', fontWeight: '700', fontSize: 12 },
  // Team ribbon styles
  teamRowOverlay: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(238,242,255,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#C7D2FE' },
  teamPillText: { fontWeight: '800', color: '#1E3A8A', fontSize: 12 },
  vsText: { marginHorizontal: 2, color: '#E5E7EB', fontWeight: '900' },
  teamPillAlt: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(220,252,231,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#A7F3D0' },
  teamPillAltText: { fontWeight: '800', color: '#065F46', fontSize: 12 },
  // Author header styles
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  authorAvatarWrap: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  authorAvatar: { width: 28, height: 28, borderRadius: 14 },
  authorName: { fontWeight: '700', color: '#111827', maxWidth: 220 },
  actionsButton: { padding: 4, borderRadius: 12 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  actionsMenu: { backgroundColor: 'white', borderRadius: 12, minWidth: 160, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  actionText: { fontSize: 16, fontWeight: '500', color: '#374151' },
  actionSeparator: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  
  // Edit modal styles
  editModal: { flex: 1, backgroundColor: 'white' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  editTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cancelButton: { fontSize: 16, color: '#6B7280' },
  saveButton: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  saveButtonDisabled: { color: '#9CA3AF' },
  editContent: { flex: 1, padding: 16 },
  titleInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, minHeight: 50 },
  contentInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, flex: 1, minHeight: 120 },
});
