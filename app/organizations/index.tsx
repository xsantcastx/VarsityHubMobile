import { Organization } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { ensureSeededOrganizations } from '@/data/seedOrganizations';

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
          const combined = ensureSeededOrganizations(orgList as Organization[]);
          setOrgs(combined);
          const westhill =
            combined.find((o) => o.name.toLowerCase().includes('westhill')) || combined[0] || null;
          setFeatured(westhill);
        }
      } catch {
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
    return () => { cancelled = true; };
  }, []);

  const styles = createStyles(colorScheme);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Organizations</Text>
      <Text style={styles.subtitle}>
        Browse schools, clubs, and organizations on VarsityHub.
      </Text>

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
            onPress={() => router.push(`/organizations/${featured.id}`)}
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
        orgs.map((org) => (
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
              {org.org_type && (
                <Text style={styles.orgCardType}>{org.org_type}</Text>
              )}
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
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
