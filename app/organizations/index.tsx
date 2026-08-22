import { Organization } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureSeededOrganizations } from '@/data/seedOrganizations';
import { captureException } from '@/utils/sentry';
import { safeGoBack } from '@/utils/navigation';

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  formatted_address?: string | null;
  org_type?: string | null;
  _count?: { teams: number; memberships: number };
}

function OrganizationsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [featured, setFeatured] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await Organization.list(undefined, 20);
        if (!cancelled) {
          const orgList = Array.isArray(data) ? data : data.items || [];
          // Seeded demo orgs are an empty-state fallback only — never mix
          // them into real results (search can't return them, so browse and
          // search would disagree about which orgs exist).
          const combined =
            orgList.length > 0
              ? (orgList as Organization[])
              : ensureSeededOrganizations<Organization>([]);
          setOrgs(combined);
          setFeatured(combined[0] || null);
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), {
          context: 'organizations-list-load',
        });
        if (!cancelled) {
          const fallback = ensureSeededOrganizations<Organization>([]);
          setOrgs(fallback);
          setFeatured(fallback[0] || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Every screen owns its back button (global headerShown: false). Without this
  // the browse page was a dead end — reached via Discover's "Browse
  // organizations" push with no way back — and its title collided with the
  // status bar for lack of a top inset.
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => safeGoBack(router, '/(tabs)/discover')}
        style={styles.backButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <MaterialIcons name="arrow-back" size={24} color={Colors[colorScheme].text} />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>
          Organizations
        </Text>
        <Text style={styles.subtitle}>Browse schools, clubs, and organizations on VarsityHub.</Text>

        {featured && (
          <View style={styles.featuredCard}>
            <View style={styles.featuredBadge}>
              <MaterialIcons name="star" size={14} color="#fff" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
            <Text style={styles.featuredName}>{featured.name}</Text>
            {featured.formatted_address && (
              <View style={styles.featuredLocationRow}>
                <MaterialIcons name="location-on" size={16} color={Colors[colorScheme].mutedText} />
                <Text style={styles.featuredLocation}>{featured.formatted_address}</Text>
              </View>
            )}
            {featured.description && (
              <Text style={styles.featuredDescription}>{featured.description}</Text>
            )}
            <View style={styles.featuredMetaRow}>
              {featured._count?.teams ? (
                <Text style={styles.featuredMeta}>
                  {featured._count.teams} team{featured._count.teams !== 1 ? 's' : ''}
                </Text>
              ) : null}
              {featured._count?.memberships ? (
                <Text style={styles.featuredMeta}>
                  {featured._count.memberships} member{featured._count.memberships !== 1 ? 's' : ''}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.featuredButton}
              // "View Page" = see the org exactly as the public does (preview=1),
              // even for the owner — never their management/edit view.
              onPress={() => router.push(`/organizations/${featured.id}?preview=1`)}
            >
              <Text style={styles.featuredButtonText}>View Page</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>All Organizations</Text>
        {orgs.length === 0 ? (
          <Text style={styles.emptyText}>No organizations found.</Text>
        ) : (
          orgs.map(org => (
            <Pressable
              key={org.id}
              style={styles.orgCard}
              onPress={() => router.push(`/organizations/${org.id}`)}
              accessibilityRole="button"
            >
              <View style={styles.orgCardContent}>
                <Text style={styles.orgCardName}>{org.name}</Text>
                {org.formatted_address && (
                  <Text style={styles.orgCardLocation}>{org.formatted_address}</Text>
                )}
                {org.org_type && <Text style={styles.orgCardType}>{org.org_type}</Text>}
                {org._count && (
                  <Text style={styles.orgCardMeta}>
                    {org._count.teams || 0} teams • {org._count.memberships || 0} members
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 8,
      backgroundColor: Colors[colorScheme].background,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    container: {
      padding: 16,
      backgroundColor: Colors[colorScheme].background,
      flexGrow: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].background,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors[colorScheme].text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: Colors[colorScheme].mutedText,
      marginBottom: 24,
    },
    featuredCard: {
      backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F9FAFB',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 2,
      borderColor: Colors[colorScheme].tint,
    },
    featuredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: Colors[colorScheme].tint,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      marginBottom: 12,
      gap: 4,
    },
    featuredBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    featuredName: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors[colorScheme].text,
      marginBottom: 8,
    },
    featuredLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    featuredLocation: {
      fontSize: 14,
      color: Colors[colorScheme].mutedText,
      flex: 1,
    },
    featuredDescription: {
      fontSize: 14,
      color: Colors[colorScheme].mutedText,
      marginBottom: 12,
      lineHeight: 20,
    },
    featuredMetaRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    featuredMeta: {
      fontSize: 13,
      color: Colors[colorScheme].mutedText,
    },
    featuredButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].tint,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      gap: 8,
    },
    featuredButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: Colors[colorScheme].text,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 15,
      color: Colors[colorScheme].mutedText,
      textAlign: 'center',
      marginTop: 20,
    },
    orgCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#D1D5DB',
    },
    orgCardContent: {
      flex: 1,
    },
    orgCardName: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors[colorScheme].text,
      marginBottom: 4,
    },
    orgCardLocation: {
      fontSize: 13,
      color: Colors[colorScheme].mutedText,
      marginBottom: 2,
    },
    orgCardType: {
      fontSize: 13,
      color: Colors[colorScheme].mutedText,
      marginBottom: 2,
      textTransform: 'capitalize',
    },
    orgCardMeta: {
      fontSize: 12,
      color: Colors[colorScheme].mutedText,
    },
  });

export default OrganizationsIndexScreen;
