import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export type ProfileIdentityProps = {
  user: any;
  theme: {
    background?: string;
    card?: string;
    border?: string;
    text?: string;
    mutedText?: string;
    tint?: string;
  };
  isAdmin?: boolean;
  _isOwnProfile?: boolean;
  isUploadingAvatar?: boolean;
  onPressAvatar?: () => void;
  onPressSettings?: () => void;
  showSettings?: boolean;
  actionSlot?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  coverImageUrl?: string;
  onPressCoverImage?: () => void;
};

const normalizeRole = (role?: string | null) => (role || '').toLowerCase();

export function ProfileIdentity({
  user,
  theme,
  isAdmin = false,
  _isOwnProfile = false,
  isUploadingAvatar = false,
  onPressAvatar,
  onPressSettings,
  showSettings = false,
  actionSlot,
  rightAccessory: _rightAccessory,
  style,
  coverImageUrl,
  onPressCoverImage,
}: ProfileIdentityProps) {
  const preferences = user?.preferences || {};
  const displayName = user?.display_name || user?.username || 'User';
  const username = user?.username;
  const role = normalizeRole(preferences?.role || user?.role);

  const renderAdminBadge = () => {
    if (!isAdmin) return null;
    return (
      <View style={styles.adminBadge}>
        <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
      </View>
    );
  };

  const renderRoleBadge = () => {
    if (!role) return null;
    const iconName = role === 'coach' ? 'flag' : role === 'athlete' ? 'barbell' : 'heart';
    return (
      <View style={[styles.roleBadge, role === 'coach' && styles.coachBadge, role === 'athlete' && styles.athleteBadge, role === 'fan' && styles.fanBadge]}>
        <Ionicons name={iconName as any} size={12} color="#ffffff" />
        <Text style={styles.roleText}>{role.toUpperCase()}</Text>
      </View>
    );
  };

  return (
    <View style={style}>
      {/* Cover Image Section */}
      <Pressable onPress={onPressCoverImage} disabled={!onPressCoverImage}>
        {coverImageUrl ? (
          <Image 
            source={{ uri: coverImageUrl }} 
            style={styles.coverImage} 
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[theme.tint || '#3B82F6', theme.tint ? theme.tint + 'CC' : '#3B82F688']}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.coverImage}
          />
        )}
        {_isOwnProfile && (
          <View style={[styles.coverImageButton, { backgroundColor: theme.tint || '#3B82F6' }]}>
            <Ionicons name="camera" size={20} color="#ffffff" />
          </View>
        )}
      </Pressable>

      {/* Profile Card (Avatar + Info) */}
      <View style={[styles.profileCard, { backgroundColor: theme.card || '#ffffff', borderColor: theme.border || '#e5e7eb' }]}>
        {/* Avatar Section - Negative margin to overlap cover image */}
        <View style={styles.avatarSection}>
          <Pressable onPress={onPressAvatar} disabled={!onPressAvatar} style={styles.avatarPressable}>
            {user?.avatar_url ? (
              <Image source={{ uri: String(user.avatar_url) }} style={styles.largeAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.largeAvatarPlaceholder, { backgroundColor: theme.tint || '#3B82F6' }]}>
                <Text style={styles.largeAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {isUploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </Pressable>

          {/* Name and Username Row */}
          <View style={styles.nameSection}>
            <View style={styles.nameRowMain}>
              <Text style={[styles.nameMain, { color: theme.text || '#0f172a' }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Ionicons name="checkmark-circle" size={20} color="#0ea5e9" />
              {renderAdminBadge()}
            </View>
            {username ? (
              <Text style={[styles.handleMain, { color: theme.mutedText || '#6b7280' }]}>@{username}</Text>
            ) : null}
            
            {/* Role Badge */}
            <View style={styles.roleBadgeRow}>
              {renderRoleBadge()}
            </View>
          </View>

          {/* Settings Button (top right) */}
          {showSettings && (
            <Pressable onPress={onPressSettings} style={styles.settingsButton} hitSlop={10}>
              <Ionicons name="settings-outline" size={24} color={theme.mutedText || '#6b7280'} />
            </Pressable>
          )}
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={[styles.statBox, { borderColor: theme.border || '#e5e7eb' }]}>
            <Text style={[styles.statCount, { color: theme.text || '#0f172a' }]}>0</Text>
            <Text style={[styles.statLabel2, { color: theme.mutedText || '#6b7280' }]}>POSTS</Text>
          </View>
          <View style={[styles.statBox, { borderColor: theme.border || '#e5e7eb' }]}>
            <Text style={[styles.statCount, { color: theme.text || '#0f172a' }]}>{user?.followers_count ?? 0}</Text>
            <Text style={[styles.statLabel2, { color: theme.mutedText || '#6b7280' }]}>FOLLOWERS</Text>
          </View>
          <View style={[styles.statBox, { borderColor: theme.border || '#e5e7eb' }]}>
            <Text style={[styles.statCount, { color: theme.text || '#0f172a' }]}>{user?.following_count ?? 0}</Text>
            <Text style={[styles.statLabel2, { color: theme.mutedText || '#6b7280' }]}>FOLLOWING</Text>
          </View>
        </View>

        {/* Action Slot */}
        {actionSlot && <View style={styles.actionSlotContainer}>{actionSlot}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cover image section
  coverImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#1f2937',
    position: 'relative',
  },
  coverImageButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Profile card containing avatar and stats
  profileCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: -60,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 5,
  },

  // Avatar section with name and badges
  avatarSection: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
    position: 'relative',
  },

  avatarPressable: {
    marginBottom: 12,
  },

  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#ffffff',
  },

  largeAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  largeAvatarInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
  },

  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },

  settingsButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },

  nameSection: {
    alignItems: 'center',
    marginBottom: 16,
  },

  nameRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 4,
  },

  nameMain: {
    fontSize: 24,
    fontWeight: '700',
  },

  handleMain: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },

  roleBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  coachBadge: { backgroundColor: '#0ea5e9' },
  athleteBadge: { backgroundColor: '#10b981' },
  fanBadge: { backgroundColor: '#6366f1' },

  roleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  adminBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  // Stats section
  statsSection: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  statBox: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
  },

  statCount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },

  statLabel2: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Action slot
  actionSlotContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

export default ProfileIdentity;
