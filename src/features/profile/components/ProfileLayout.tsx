import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type ProfileStat = { label: string; value: number | string };

export type ProfileTab = { key: string; label: string };

export type ProfileAction =
  | {
      label: string;
      onPress: () => void;
      icon?: keyof typeof Ionicons.glyphMap;
      variant?: 'solid' | 'outline';
    }
  | undefined;

type Props = {
  loading?: boolean;
  error?: string | null;
  coverUri?: string | null;
  avatarUri?: string | null;
  avatarFallbackIcon?: keyof typeof Ionicons.glyphMap;
  name: string;
  handle?: string | null;
  subtitle?: string | null;
  joinedText?: string | null;
  bio?: string | null;
  stats: ProfileStat[];
  tabs: ProfileTab[];
  activeTab: string;
  onChangeTab: (key: string) => void;
  primaryAction?: ProfileAction;
  secondaryAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void } | undefined;
  children: React.ReactNode;
};

export function ProfileLayout({
  loading,
  error,
  coverUri,
  avatarUri,
  avatarFallbackIcon = 'person',
  name,
  handle,
  subtitle,
  joinedText,
  bio,
  stats,
  tabs,
  activeTab,
  onChangeTab,
  primaryAction,
  secondaryAction,
  children,
}: Props) {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Cover */}
      <View style={styles.coverContainer}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <LinearGradient colors={[theme.tint, theme.card]} style={styles.coverImage} />
        )}
        <View style={styles.coverOverlay}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name={avatarFallbackIcon} size={48} color={theme.mutedText} />
              </View>
            )}
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.displayName, { color: theme.onTint }]} numberOfLines={1}>
              {name || 'Untitled'}
            </Text>
            {handle ? (
              <Text style={[styles.username, { color: theme.mutedText }]} numberOfLines={1}>
                @{handle}
              </Text>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            {primaryAction ? (
              <Pressable
                onPress={primaryAction.onPress}
                style={[
                  styles.primaryButton,
                  primaryAction.variant === 'outline'
                    ? { backgroundColor: 'transparent', borderColor: theme.onTint, borderWidth: 1 }
                    : { backgroundColor: theme.onTint },
                ]}
              >
                {primaryAction.icon ? (
                  <Ionicons
                    name={primaryAction.icon}
                    size={16}
                    color={primaryAction.variant === 'outline' ? theme.onTint : theme.tint}
                  />
                ) : null}
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: primaryAction.variant === 'outline' ? theme.onTint : theme.tint },
                  ]}
                >
                  {primaryAction.label}
                </Text>
              </Pressable>
            ) : null}

            {secondaryAction ? (
              <Pressable
                onPress={secondaryAction.onPress}
                style={[styles.iconButton, { borderColor: theme.onTint, backgroundColor: theme.elevated }]} 
                hitSlop={8}
              >
                <Ionicons name={secondaryAction.icon} size={18} color={theme.onTint} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <View style={{ alignItems: 'center', paddingHorizontal: 16, gap: 6, marginBottom: 12 }}>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.text }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          {joinedText ? (
            <View style={styles.joinedRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.mutedText} />
              <Text style={[styles.joinedText, { color: theme.mutedText }]} numberOfLines={1}>
                {joinedText}
              </Text>
            </View>
          ) : null}
        </View>

      {bio ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <Text style={[styles.bio, { color: theme.text }]} numberOfLines={3}>
            {bio}
          </Text>
        </View>
      ) : null}

      <View style={[styles.statsRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
        {stats.map((stat, idx) => (
          <React.Fragment key={`${stat.label}-${idx}`}>
            <View style={styles.statCell}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{stat.value ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>{stat.label}</Text>
            </View>
            {idx < stats.length - 1 ? (
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            ) : null}
          </React.Fragment>
        ))}
      </View>

      <View style={[styles.tabsContainer, { borderColor: theme.border, backgroundColor: theme.card }]}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                isActive && { borderBottomColor: theme.tint },
              ]}
              onPress={() => onChangeTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive ? { color: theme.tint, fontWeight: '700' } : { color: theme.mutedText },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 16 }}>{children}</View>
      </View>
    </ScrollView>
  );
}

const COVER_HEIGHT = Math.max(200, Math.min(240, Math.floor(Dimensions.get('window').height * 0.28)));

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, fontWeight: '600' },
  coverContainer: { position: 'relative', height: COVER_HEIGHT, marginBottom: 16 },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  body: { paddingBottom: 16 },
  avatarContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    borderWidth: 2,
    // borderColor and backgroundColor moved to inline styles for theme support
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 52,
  },
  titleBlock: { flex: 1, marginLeft: 12, gap: 4 },
  displayName: { fontSize: 24, fontWeight: '800' },
  username: { fontSize: 14 },
  subtitle: { fontSize: 15, textAlign: 'center' },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'center' },
  joinedText: { fontSize: 13 },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNumber: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' },
  statDivider: { width: 1 },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    marginHorizontal: 0,
    marginBottom: 16,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2 },
  tabText: { fontSize: 15, fontWeight: '500' },
});
