import { JerseyBadge, Sport } from '@/components/JerseyBadge';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
};

const getSportEmoji = (sport: string): string => {
  const emojiMap: Record<string, string> = {
    basketball: '🏀',
    football: '🏈',
    baseball: '⚾',
    soccer: '⚽',
    volleyball: '🏐',
    other: '🏆',
  };
  const key = sport?.toLowerCase?.() || 'other';
  return emojiMap[key] || '🏆';
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
  showSettings,
  actionSlot,
  rightAccessory,
  style,
}: ProfileIdentityProps) {
  const preferences = user?.preferences || {};
  const displayName = user?.display_name || user?.username || 'User';
  const username = user?.username;
  const bio = user?.bio || preferences?.bio;
  const role = normalizeRole(preferences?.role || user?.role);
  const plan = preferences?.plan ? String(preferences.plan) : null;
  const jerseyNumber = preferences?.jersey_number ?? user?.jersey_number;
  const position = preferences?.position ?? user?.position;
  const gradeLevel = preferences?.grade_level ?? user?.grade_level;
  const graduationYear = preferences?.graduation_year ?? user?.graduation_year;
  const accolades = Array.isArray(preferences?.accolades)
    ? preferences.accolades
    : typeof preferences?.accolades === 'string'
      ? preferences.accolades.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
  const primarySport = (preferences?.primary_sport || preferences?.sport || 'other') as Sport;
  const themeColor = preferences?.theme_color || '#3B82F6';
  const isAthlete = Boolean(position || jerseyNumber || gradeLevel || graduationYear || accolades.length > 0);

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

  const renderPlanBadge = () => {
    if (!plan) return null;
    const kind = plan.toLowerCase();
    const icon = kind === 'veteran' ? '🏆' : kind === 'legend' ? '🥇' : null;
    return (
      <View style={[styles.planBadge, kind === 'rookie' && styles.rookieBadge, kind === 'veteran' && styles.veteranBadge, kind === 'legend' && styles.legendBadge]}>
        {icon ? <Text style={{ fontSize: 12 }}>{icon}</Text> : <Ionicons name="shield" size={12} color="#ffffff" />}
        <Text style={styles.planBadgeText}>{plan.toUpperCase()}</Text>
      </View>
    );
  };

  const renderAdminBadge = () => {
    if (!isAdmin) return null;
    return (
      <View style={styles.adminBadge}>
        <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
      </View>
    );
  };

  const credentials = [
    gradeLevel,
    accolades[0],
    graduationYear ? `Class of ${graduationYear}` : null,
  ].filter(Boolean).join(' | ');

  return (
    <View style={[styles.card, { backgroundColor: theme.card || '#ffffff', borderColor: theme.border || '#e5e7eb' }, style]}>
      {showSettings && (
        <Pressable onPress={onPressSettings} style={styles.settingsButton} hitSlop={10}>
          <Ionicons name="settings-outline" size={20} color={theme.mutedText || '#6b7280'} />
        </Pressable>
      )}

      <View style={styles.headerRow}>
        <Pressable onPress={onPressAvatar} disabled={!onPressAvatar} style={styles.avatarContainer}>
          {user?.avatar_url ? (
            <Image source={{ uri: String(user.avatar_url) }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {isUploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}
        </Pressable>

        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text || '#0f172a' }]} numberOfLines={1}>{displayName}</Text>
            {renderAdminBadge()}
          </View>
          {username ? <Text style={[styles.handle, { color: theme.mutedText || '#6b7280' }]}>@{username}</Text> : null}
          <View style={styles.badgesRow}>
            {renderRoleBadge()}
            {renderPlanBadge()}
          </View>
          {isAthlete && position ? (
            <View style={styles.positionBadge}>
              <Text style={styles.positionText}>{String(position).toUpperCase()}</Text>
            </View>
          ) : null}
          {isAthlete && credentials ? (
            <Text style={[styles.credentialsText, { color: theme.mutedText || '#6b7280' }]}> 
              {credentials}
              {primarySport && primarySport !== 'other' ? ` ${getSportEmoji(primarySport)}` : ''}
            </Text>
          ) : null}
          {bio ? <Text style={[styles.bio, { color: theme.mutedText || '#6b7280' }]} numberOfLines={3}>{bio}</Text> : null}
          {actionSlot ? <View style={styles.actionSlot}>{actionSlot}</View> : null}
        </View>

        {jerseyNumber ? (
          <View style={styles.jerseyContainer}>
            <JerseyBadge jerseyNumber={jerseyNumber} sport={primarySport} teamColor={themeColor} size="medium" />
          </View>
        ) : rightAccessory ? rightAccessory : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  settingsButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e7eb',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoColumn: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  handle: {
    fontSize: 14,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  coachBadge: { backgroundColor: '#0ea5e9' },
  athleteBadge: { backgroundColor: '#10b981' },
  fanBadge: { backgroundColor: '#6366f1' },
  roleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  planBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  rookieBadge: { backgroundColor: '#0ea5e9' },
  veteranBadge: { backgroundColor: '#f97316' },
  legendBadge: { backgroundColor: '#111827' },
  adminBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    marginTop: 4,
  },
  positionText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.4,
    fontSize: 12,
  },
  credentialsText: {
    marginTop: 4,
    fontSize: 13,
  },
  bio: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  actionSlot: {
    marginTop: 12,
  },
  jerseyContainer: {
    marginLeft: 8,
    alignItems: 'center',
  },
});

export default ProfileIdentity;
