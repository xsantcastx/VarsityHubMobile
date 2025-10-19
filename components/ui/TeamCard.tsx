import { Colors } from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from './card';

export interface Team {
  id: string;
  name: string;
  sport?: string;
  season?: string;
  logo_url?: string;
  banner_url?: string;
  member_count?: number;
  role?: 'coach' | 'player' | 'fan' | 'parent';
}

export interface TeamCardProps {
  team: Team;
  onPress?: (team: Team) => void;
  showRole?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable Team Card Component
 * Replaces 8+ duplicated team card implementations
 * 
 * @example
 * <TeamCard 
 *   team={team}
 *   onPress={handlePress}
 *   showRole={true}
 * />
 */
export function TeamCard({ 
  team, 
  onPress, 
  showRole = false,
  style 
}: TeamCardProps) {
  const colorScheme = useColorScheme() ?? 'light';

  // Get role badge color
  const getRoleBadge = () => {
    if (!showRole || !team.role) return null;

    let backgroundColor = Colors[colorScheme].surface;
    let textColor = Colors[colorScheme].text;

    if (team.role === 'coach') {
      backgroundColor = '#e3f2fd';
      textColor = '#1976d2';
    } else if (team.role === 'player') {
      backgroundColor = '#e8f5e9';
      textColor = '#388e3c';
    } else if (team.role === 'parent') {
      backgroundColor = '#fff3e0';
      textColor = '#f57c00';
    } else if (team.role === 'fan') {
      backgroundColor = '#fce4ec';
      textColor = '#c2185b';
    }

    return (
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={[styles.badgeText, typography.caption, { color: textColor }]}>
          {team.role.charAt(0).toUpperCase() + team.role.slice(1)}
        </Text>
      </View>
    );
  };

  return (
    <Card
      variant="outlined"
      pressable={!!onPress}
      onPress={onPress ? () => onPress(team) : undefined}
      style={style}
    >
      <View style={styles.header}>
        {/* Team Logo */}
        {team.logo_url ? (
          <Image 
            source={{ uri: team.logo_url }} 
            style={styles.logo}
          />
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: Colors[colorScheme].surface }]}>
            <Ionicons name="shield-outline" size={24} color={Colors[colorScheme].icon} />
          </View>
        )}

        {/* Team Info */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text 
              style={[
                styles.teamName, 
                typography.heading,
                { color: Colors[colorScheme].text }
              ]}
              numberOfLines={1}
            >
              {team.name}
            </Text>
            {getRoleBadge()}
          </View>

          {/* Sport and Season */}
          {(team.sport || team.season) && (
            <View style={styles.metaRow}>
              {team.sport && (
                <View style={styles.metaItem}>
                  <Ionicons 
                    name="basketball-outline" 
                    size={14} 
                    color={Colors[colorScheme].mutedText} 
                  />
                  <Text 
                    style={[
                      styles.metaText, 
                      typography.caption,
                      { color: Colors[colorScheme].mutedText }
                    ]}
                  >
                    {team.sport}
                  </Text>
                </View>
              )}
              {team.season && (
                <View style={styles.metaItem}>
                  <Ionicons 
                    name="calendar-outline" 
                    size={14} 
                    color={Colors[colorScheme].mutedText} 
                  />
                  <Text 
                    style={[
                      styles.metaText, 
                      typography.caption,
                      { color: Colors[colorScheme].mutedText }
                    ]}
                  >
                    {team.season}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Member Count */}
          {team.member_count !== undefined && (
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons 
                  name="people-outline" 
                  size={14} 
                  color={Colors[colorScheme].mutedText} 
                />
                <Text 
                  style={[
                    styles.metaText, 
                    typography.caption,
                    { color: Colors[colorScheme].mutedText }
                  ]}
                >
                  {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Chevron */}
        {onPress && (
          <Ionicons 
            name="chevron-forward" 
            size={24} 
            color={Colors[colorScheme].mutedText} 
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  teamName: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    // Style from typography
  },
});
