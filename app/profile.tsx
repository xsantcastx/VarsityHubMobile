import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await User.me();
      setUser(me);
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
          <Pressable 
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
            onPress={loadProfile}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <Text style={{ color: theme.text }}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = user?.display_name || user?.username || 'User';
  const bio = user?.bio || '';
  const role = user?.preferences?.role || user?.role || null;
  const verified = user?.verified || false;

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <Stack.Screen 
        options={{ 
          title: name,
          headerRight: () => (
            <Pressable 
              onPress={() => router.push('/settings')}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 12 })}
            >
              <Ionicons name="settings-outline" size={24} color={theme.text} />
            </Pressable>
          ),
        }} 
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={[styles.headerSection, { backgroundColor: theme.surface }]}>
          {/* Avatar */}
          <View style={[styles.avatarContainer, { backgroundColor: theme.border }]}>
            {user?.avatar_url ? (
              <Image 
                source={{ uri: user.avatar_url }} 
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.tint }]}>
                <Ionicons name="person" size={48} color="#ffffff" />
              </View>
            )}
          </View>

          {/* Name & Role */}
          <View style={styles.infoSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
              {verified && (
                <Ionicons name="checkmark-circle" size={20} color={theme.tint} />
              )}
            </View>
            
            {role && (
              <View style={[styles.roleBadge, { backgroundColor: theme.tint + '20' }]}>
                <Text style={[styles.roleText, { color: theme.tint }]}>
                  {role === 'coach' ? '🏆 Coach' : role === 'fan' ? '👥 Fan' : role}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bio */}
        {bio && (
          <View style={styles.bioSection}>
            <Text style={[styles.bio, { color: theme.text }]}>{bio}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={[styles.statsSection, { backgroundColor: theme.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {user?._count?.posts ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>Posts</Text>
          </View>
          
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {user?._count?.followers ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>Followers</Text>
          </View>
          
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {user?._count?.following ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>Following</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Pressable 
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
            onPress={() => router.push('/edit-profile')}
          >
            <Ionicons name="create-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* User Info Details */}
        <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
          {user?.username && (
            <DetailRow 
              icon="at" 
              label="Username" 
              value={user.username}
              theme={theme}
            />
          )}
          {user?.email && (
            <DetailRow 
              icon="mail" 
              label="Email" 
              value={user.email}
              theme={theme}
            />
          )}
          {user?.preferences?.position && (
            <DetailRow 
              icon="body" 
              label="Position" 
              value={user.preferences.position}
              theme={theme}
            />
          )}
          {user?.preferences?.jersey_number && (
            <DetailRow 
              icon="flag" 
              label="Jersey #" 
              value={String(user.preferences.jersey_number)}
              theme={theme}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, theme }: any) {
  return (
    <View style={styles.detailRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Ionicons name={icon as any} size={18} color={theme.mutedText} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.detailLabel, { color: theme.mutedText }]}>{label}</Text>
          <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Header Section
  headerSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Bio
  bioSection: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Stats
  statsSection: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },

  // Actions
  actionSection: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Details Section
  detailsSection: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
