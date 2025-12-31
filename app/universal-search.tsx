import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Organization, Team, User } from '../api/entities';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

type SearchResult = {
  id: string;
  type: 'user' | 'team' | 'organization';
  name: string;
  avatar?: string;
  description?: string;
};

export default function UniversalSearchScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userResults, setUserResults] = useState<SearchResult[]>([]);
  const [teamResults, setTeamResults] = useState<SearchResult[]>([]);
  const [orgResults, setOrgResults] = useState<SearchResult[]>([]);
  const [eventResults, setEventResults] = useState<SearchResult[]>([]);
  const [highlightResults, setHighlightResults] = useState<SearchResult[]>([]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setUserResults([]);
      setTeamResults([]);
      setOrgResults([]);
      return;
    }

    setLoading(true);
    try {
      const [usersData, teamsData, orgsData] = await Promise.allSettled([
        User.listAll(searchQuery, 20),
        Team.list(searchQuery, false, { limit: 20 }),
        Organization.list(searchQuery, 20),
      ]);

      const users: SearchResult[] = [];
      const teams: SearchResult[] = [];
      const orgs: SearchResult[] = [];

      // Process users
      if (usersData.status === 'fulfilled' && Array.isArray(usersData.value)) {
        usersData.value.forEach((u: any) => {
          users.push({
            id: u.id || u.user_id,
            type: 'user',
            name: u.display_name || u.username || 'Unknown',
            avatar: u.avatar_url,
            description: u.bio || undefined,
          });
        });
      }

      // Process teams
      if (teamsData.status === 'fulfilled' && Array.isArray(teamsData.value)) {
        teamsData.value.forEach((t: any) => {
          teams.push({
            id: t.id,
            type: 'team',
            name: t.name || 'Unknown',
            avatar: t.logo_url,
            description: t.description || undefined,
          });
        });
      }

      // Process organizations
      if (orgsData.status === 'fulfilled' && Array.isArray(orgsData.value)) {
        orgsData.value.forEach((o: any) => {
          orgs.push({
            id: o.id,
            type: 'organization',
            name: o.name || 'Unknown',
            avatar: o.logo_url,
            description: o.description || undefined,
          });
        });
      }

      // If you want to keep the new backend logic, use this block instead:
      // const res = await Search.universal(searchQuery, { limit: 20 });
      // ...parse users, teams, orgs, events, highlights from res...

      setUserResults(users);
      setTeamResults(teams);
      setOrgResults(orgs);
      setEventResults([]); // No events from old logic
      setHighlightResults([]); // No highlights from old logic
      setResults([...users, ...teams, ...orgs]);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResultPress = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'user':
        router.push(`/user-profile?id=${result.id}`);
        break;
      case 'team':
        router.push(`/team-page?id=${result.id}&name=${encodeURIComponent(result.name)}`);
        break;
      case 'organization':
        router.push(`/organization?id=${result.id}`);
        break;
      case 'event':
        router.push(`/event-detail?id=${result.id}`);
        break;
      case 'highlight':
        router.push(`/post-detail?id=${result.id}`);
        break;
    }
  }, [router]);

  const renderResultItem = ({ item }: { item: SearchResult }) => {
    let badgeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    let badgeColor = '#F59E0B';
    let iconName = 'briefcase';
    switch (item.type) {
      case 'user':
        badgeColor = '#3B82F6';
        iconName = 'person';
        break;
      case 'team':
        badgeColor = '#10B981';
        iconName = 'people';
        break;
      case 'organization':
        badgeColor = '#F59E0B';
        iconName = 'briefcase';
        break;
      case 'event':
        badgeColor = '#6366F1';
        iconName = 'calendar';
        badgeLabel = 'Event';
        break;
      case 'highlight':
        badgeColor = '#EF4444';
        iconName = 'star';
        badgeLabel = 'Highlight';
        break;
    }

    return (
      <Pressable
        style={[
          styles.resultItem,
          { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
        ]}
        onPress={() => handleResultPress(item)}
      >
        {item.avatar ? (
          <Image
            source={{ uri: item.avatar }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: Colors[colorScheme].surface }]}> 
            <Ionicons
              name={iconName}
              size={20}
              color={Colors[colorScheme].mutedText}
            />
          </View>
        )}
        <View style={styles.content}>
          <Text style={[styles.name, { color: Colors[colorScheme].text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description && (
            <Text
              style={[styles.description, { color: Colors[colorScheme].mutedText }]}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors[colorScheme].mutedText} />
      </Pressable>
    );
  };

  const renderSection = (title: string, data: SearchResult[]) => {
    if (data.length === 0) return null;
    return (
      <View key={title}>
        <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
          {title} ({data.length})
        </Text>
        {data.map((item) => (
          <View key={`${item.type}-${item.id}`}>
            {renderResultItem({ item })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Search',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].tint} />
            </Pressable>
          ),
        }}
      />

      {/* Search Input */}
      <View style={[styles.searchBox, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
        <TextInput
          style={[styles.searchInput, { color: Colors[colorScheme].text }]}
          placeholder="Search teams, organizations, people..."
          placeholderTextColor={Colors[colorScheme].mutedText}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            void handleSearch(text);
          }}
          autoFocus
          returnKeyType="search"
        />
        {query && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors[colorScheme].tint} size="large" />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
            Searching...
          </Text>
        </View>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={40} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
            Try searching with different keywords
          </Text>
        </View>
      )}

      {!loading && query.trim() && results.length > 0 && (
        <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsContent}>
          {renderSection('People', userResults)}
          {renderSection('Teams', teamResults)}
          {renderSection('Organizations', orgResults)}
          {renderSection('Events', eventResults)}
          {renderSection('Highlights', highlightResults)}
        </ScrollView>
      )}

      {!loading && !query.trim() && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={40} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
            Start searching
          </Text>
          <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
            Find teams, organizations, and people on VarsityHub
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
