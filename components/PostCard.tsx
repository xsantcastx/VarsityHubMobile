import { Post } from '@/api/entities';
import { Report } from '@/api/misc';
import { Colors } from '@/constants/Colors';
import { sanitizeTitle } from '@/lib/sanitizeTitle';
import { useAuth } from '@/context/AuthProvider';
import { usePostCache } from '@/context/PostCacheContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { optimizeImageUrl } from '@/utils/imageUrl';
import RankingBadge from './RankingBadge';

type PostCardProps = {
  post: any;
  onPress?: () => void;
  showAuthorHeader?: boolean; // show avatar + name at top of card
  onDeleted?: (postId: string) => void; // callback when post is deleted
  onUpdated?: (updatedPost: any) => void; // callback when post is updated
};

function PostCard({ post, onPress, showAuthorHeader = true, onDeleted, onUpdated }: PostCardProps) {
  // Determine badge type and position
  // Example: post.rankingType: 'trending' | 'recent' | 'top', post.rank: number
  const rankingType = post.rankingType || null; // e.g., 'trending', 'recent', 'top'
  const rank = typeof post.rank === 'number' ? post.rank : null;
  const router = useRouter();
  const { user: currentUser } = useAuth(); // Get user from auth context instead of API call
  const { remove: removeFromCache } = usePostCache();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [bookmarked, setBookmarked] = useState<boolean>(!!post.has_bookmarked);
  const [bookmarksCount, setBookmarksCount] = useState<number>(post.bookmarks_count || 0);
  const [upvotesCount, setUpvotesCount] = useState<number>(post.upvotes_count || 0);
  const [pressed, setPressed] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editTitle, setEditTitle] = useState(post.title || '');
  const [updating, setUpdating] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mediaError, setMediaError] = useState(false);

  // Cleanup delete timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const REPORT_REASONS = [
    { value: 'copyright', label: 'Copyright / broadcast footage' },
    { value: 'impersonation', label: 'Unauthorized use of my likeness' },
    { value: 'nudity', label: 'Inappropriate content' },
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'violence', label: 'Violence' },
    { value: 'false_information', label: 'False information' },
    { value: 'other', label: 'Other' },
  ];

  const handleReportPost = async (reason: string) => {
    setReportSubmitting(true);
    try {
      await Report.create({ target_type: 'post', target_id: String(post.id), reason });
      Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
    } catch (error: any) {
      if (error?.status === 409) {
        Alert.alert('Already Reported', 'You have already reported this post.');
      } else {
        Alert.alert('Error', error?.message || 'Failed to submit report. Please try again.');
      }
    } finally {
      setReportSubmitting(false);
      setShowReportMenu(false);
    }
  };

  const upvoteInFlight = useRef(false);
  const onUpvote = async () => {
    if (upvoteInFlight.current) return;
    upvoteInFlight.current = true;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const r: any = await Post.toggleUpvote(String(post.id));
      if (r && typeof r.count === 'number') {
        setUpvotesCount(r.count);
      }
    } catch (error) {
      if (__DEV__) console.error('[PostCard] Failed to toggle upvote:', error);
      Alert.alert('Error', 'Failed to update vote. Please try again.');
    } finally {
      upvoteInFlight.current = false;
    }
  };
  const bookmarkInFlight = useRef(false);
  const onBookmark = async () => {
    if (bookmarkInFlight.current) return;
    bookmarkInFlight.current = true;
    try {
      void Haptics.selectionAsync().catch(() => {});
      const r: any = await Post.toggleBookmark(String(post.id));
      if (r && typeof r.bookmarks_count === 'number') {
        setBookmarksCount(r.bookmarks_count);
      }
      if (r && typeof r.bookmarked === 'boolean') setBookmarked(r.bookmarked);
    } catch (error) {
      if (__DEV__) console.error('[PostCard] Failed to toggle bookmark:', error);
      Alert.alert('Error', 'Failed to bookmark post. Please try again.');
    } finally {
      bookmarkInFlight.current = false;
    }
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
              removeFromCache(String(post.id));
              onDeleted?.(String(post.id));
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
  const mediaUrl = post?.media_url || post?.mediaUrl || null;
  const previewUrl = post?.preview_url || post?.thumbnail_url || post?.previewUrl || null;
  const mediaType = typeof post?.media_type === 'string' ? post.media_type.toLowerCase() : null;
  const isImage = mediaType === 'image' || (mediaUrl ? /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl) : false);
  const isVideo = mediaType === 'video' || (mediaUrl ? /\.(mp4|mov|webm|m4v)$/i.test(mediaUrl) : false);
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
    const source = [String(sanitizeTitle(anyP.title) || ''), String(anyP.caption || anyP.content || '')].join(' \u2022 ');
    const parts = source.split(/\s+vs\.?\s+/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return { teamA: parts[0], teamB: parts[1] };
    return null;
  };
  const teamLabels = useMemo(() => deriveTeamLabels(post), [post]);

  const StatPill = ({ icon, value }: { icon: any; value: number }) => (
    <View style={styles.statPill}>
      <MaterialIcons name={icon} size={12} color="#fff" />
      <Text style={styles.statPillText}>{value}</Text>
    </View>
  );

  return (
    <View style={{ position: 'relative' }}>
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
      accessibilityRole="button"
      accessibilityLabel={`Post: ${caption || 'No caption'}`}
    >
      {/* Top-left round rank badge (e.g. #1, #2, #3, ...), only if rank is present */}
      {typeof rank === 'number' && (
        <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 20, backgroundColor: '#FFD600', borderRadius: 999, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>{`#${rank + 1}`}</Text>
        </View>
      )}
      {/* Top-right badge for category (Trending/Top/Recent) */}
      {rankingType && (
        <RankingBadge type={rankingType} position={typeof rank === 'number' ? rank + 1 : undefined} style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }} />
      )}

      {/* Card content */}
      <View>
      {showAuthorHeader && author ? (
        <View style={styles.authorRow}>
          <Pressable
            style={styles.authorInfo}
            onPress={() => { if (!author?.id) return; void router.push({ pathname: '/user-profile', params: { id: String(author.id), username: author.username || 'User' } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`View profile of ${author?.display_name || author?.username || 'User'}`}
          >
            <View style={styles.authorAvatarWrap}>
              {author?.avatar_url ? (
                <Image source={{ uri: optimizeImageUrl(String(author.avatar_url), 80) }} style={styles.authorAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.authorAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {(author?.display_name || author?.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={[styles.authorName, { color: Colors[colorScheme].text }]}>
              {author?.username ? `@${author.username}` : (author?.display_name || 'User')}
            </Text>
          </Pressable>
          {currentUser && (
            <Pressable
              style={styles.actionsButton}
              onPress={() => setShowActionsMenu(true)}
              accessibilityRole="button"
              accessibilityLabel="Post actions"
            >
              <MaterialIcons name="more-horiz" size={20} color={Colors[colorScheme].text} />
            </Pressable>
          )}
        </View>
      ) : null}
      {/* Top accent stripe */}
      <LinearGradient colors={["#1e293b", "#0f172a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topAccent} />

      {/* Media section */}
      {(isImage || isVideo) ? (
        <View style={styles.mediaWrap}>
          {isImage && mediaUrl && !mediaError ? (
            <Image source={{ uri: optimizeImageUrl(mediaUrl, 600) }} style={styles.media} contentFit="cover" onError={() => setMediaError(true)} />
          ) : isImage && mediaUrl && mediaError ? (
            <View style={[styles.media, { backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialIcons name="broken-image" size={36} color="#94a3b8" />
              <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Image unavailable</Text>
            </View>
          ) : isVideo && previewUrl ? (
            <Image source={{ uri: optimizeImageUrl(previewUrl, 600) }} style={styles.media} contentFit="cover" />
          ) : isVideo && mediaUrl ? (
            <View style={[styles.media, { backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialIcons name="videocam" size={36} color="#94a3b8" />
            </View>
          ) : null}
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
              <MaterialIcons name="play-arrow" size={24} color="#fff" />
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
        <Pressable 
          onPress={onUpvote} 
          style={[styles.upvoteBtn, { backgroundColor: Colors[colorScheme].tint }]} 
          accessibilityRole="button" 
          accessibilityLabel="Upvote"
        >
          <MaterialIcons name="arrow-upward" size={16} color={Colors[colorScheme].background} />
          <Text style={[styles.upvoteText, { color: Colors[colorScheme].background }]}>{upvotesCount}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={styles.metaRow}>
          <MaterialIcons name="chat-bubble-outline" size={16} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>{post.comments_count || 0}</Text>
        </View>
        <Pressable onPress={onBookmark} style={[styles.bookmarkBtn, { backgroundColor: Colors[colorScheme].surface }]} accessibilityRole="button" accessibilityLabel="Bookmark">
          <MaterialIcons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={Colors[colorScheme].text} />
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
          <View style={[styles.actionsMenu, { backgroundColor: theme.card }]}>
            {isAuthor ? (
              <>
                <Pressable
                  style={styles.actionItem}
                  onPress={() => {
                    setShowActionsMenu(false);
                    setEditModalVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit post"
                >
                  <MaterialIcons name="edit" size={20} color={theme.icon} />
                  <Text style={[styles.actionText, { color: theme.text }]}>Edit Post</Text>
                </Pressable>
                <View style={[styles.actionSeparator, { backgroundColor: theme.border }]} />
                <Pressable
                  style={styles.actionItem}
                  onPress={() => {
                    setShowActionsMenu(false);
                    void handleDeletePost().catch(() => {});
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Delete post"
                >
                  <MaterialIcons name="delete" size={20} color="#dc2626" />
                  <Text style={[styles.actionText, { color: '#dc2626' }]}>Delete Post</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={styles.actionItem}
                onPress={() => {
                  setShowActionsMenu(false);
                  setShowReportMenu(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Report post"
              >
                <MaterialIcons name="flag" size={20} color={theme.icon} />
                <Text style={[styles.actionText, { color: theme.text }]}>Report Post</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Report Reason Picker Modal */}
      <Modal
        visible={showReportMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !reportSubmitting && setShowReportMenu(false)}
        >
          <View style={[styles.actionsMenu, { backgroundColor: theme.card, minWidth: 220 }]}>
            <Text style={[styles.reportTitle, { color: theme.text }]}>Why are you reporting this?</Text>
            <View style={[styles.actionSeparator, { backgroundColor: theme.border }]} />
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.value}
                style={styles.actionItem}
                disabled={reportSubmitting}
                onPress={() => void handleReportPost(r.value)}
                accessibilityRole="button"
                accessibilityLabel={`Report for ${r.label}`}
              >
                <Text style={[styles.actionText, { color: theme.text, opacity: reportSubmitting ? 0.5 : 1 }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={[styles.editModal, { backgroundColor: theme.background }]}>
          <View style={[styles.editHeader, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setEditModalVisible(false)} accessibilityRole="button" accessibilityLabel="Cancel editing">
              <Text style={[styles.cancelButton, { color: theme.mutedText }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.editTitle, { color: theme.text }]}>Edit Post</Text>
            <Pressable onPress={handleEditPost} disabled={updating} accessibilityRole="button" accessibilityLabel={updating ? 'Saving post' : 'Save post'}>
              <Text style={[styles.saveButton, { color: theme.tint }, updating && styles.saveButtonDisabled]}>
                {updating ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.editContent}>
            <TextInput
              style={[styles.titleInput, { borderColor: theme.border, color: theme.text }]}
              placeholder="Title (optional)"
              placeholderTextColor={theme.mutedText}
              value={editTitle}
              onChangeText={setEditTitle}
              multiline
              accessibilityLabel="Post title"
            />
            <TextInput
              style={[styles.contentInput, { borderColor: theme.border, color: theme.text }]}
              placeholder="What's happening?"
              placeholderTextColor={theme.mutedText}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Post content"
            />
          </View>
        </View>
      </Modal>
      {/* This closes the card content View */}
      </View>
    </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  containerPressed: { transform: [{ scale: 0.995 }] },
  topAccent: { height: 4, borderRadius: 999, marginBottom: 10 },
  mediaWrap: { position: 'relative', borderRadius: 0, overflow: 'hidden', marginBottom: 10 },
  media: { width: '100%', height: 220 },
  mediaGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  captionOverlay: { position: 'absolute', left: 10, right: 10, bottom: 36, color: 'white', fontWeight: '700' },
  mediaStatsRow: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(17,24,39,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statPillText: { color: 'white', fontWeight: '800', fontSize: 12 },
  playOverlay: { position: 'absolute', top: '45%', left: '45%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  textTile: { height: 180, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 12, marginBottom: 10 },
  textTileCaption: { color: 'white', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  upvoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  upvoteText: { fontWeight: '800', fontSize: 13 },
  bookmarkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginLeft: 8 },
  bookmarkText: { fontWeight: '800', fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  metaText: { color: '#6B7280', fontWeight: '700', fontSize: 12 },
  // Team ribbon styles
  teamRowOverlay: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(238,242,255,0.95)', borderWidth: 1, borderColor: '#C7D2FE' },
  teamPillText: { fontWeight: '800', color: '#1E3A8A', fontSize: 12 },
  vsText: { marginHorizontal: 2, color: '#D1D5DB', fontWeight: '900' },
  teamPillAlt: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(220,252,231,0.95)', borderWidth: 1, borderColor: '#A7F3D0' },
  teamPillAltText: { fontWeight: '800', color: '#065F46', fontSize: 12 },
  // Author header styles
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  authorAvatarWrap: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
  authorAvatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  authorName: { fontWeight: '700', maxWidth: 220 },
  actionsButton: { padding: 4, borderRadius: 12 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  actionsMenu: { backgroundColor: 'white', borderRadius: 12, minWidth: 160, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  actionText: { fontSize: 16, fontWeight: '500', color: '#374151' },
  actionSeparator: { height: 1, backgroundColor: '#D1D5DB', marginHorizontal: 8 },
  
  // Edit modal styles
  editModal: { flex: 1, backgroundColor: 'white' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  editTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cancelButton: { fontSize: 16, color: '#6B7280' },
  saveButton: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  saveButtonDisabled: { color: '#9CA3AF' },
  editContent: { flex: 1, padding: 16 },
  titleInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, minHeight: 50 },
  contentInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, flex: 1, minHeight: 120 },

  // Report modal styles
  reportTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
});

export default React.memo(PostCard);
