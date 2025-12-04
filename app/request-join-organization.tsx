import { Organization, Team } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TeamData = {
  id: string;
  name: string;
  sport?: string;
  season?: string;
  logo_url?: string;
};

type OrgData = {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  teams?: any[];
};

export default function RequestJoinOrganizationScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ team_id: string; team_name?: string }>();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState<OrgData[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myTeam, setMyTeam] = useState<TeamData | null>(null);

  useEffect(() => {
    if (params.team_id) {
      // Load team details
      Team.get(params.team_id)
        .then((data) => {
          setMyTeam({
            id: data.id,
            name: data.name,
            sport: data.sport,
            season: data.season,
            logo_url: data.logo_url || data.avatar_url,
          });
        })
        .catch((err) => {
          console.error('[RequestJoinOrg] Error loading team:', err);
          setMyTeam({
            id: params.team_id,
            name: params.team_name || 'My Team',
          });
        });
    }
  }, [params.team_id, params.team_name]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setOrganizations([]);
      return;
    }

    setSearching(true);
    try {
      const results = await Organization.list(searchQuery.trim(), 20);
      setOrganizations(Array.isArray(results) ? results : []);
    } catch (err: any) {
      console.error('[RequestJoinOrg] Error searching organizations:', err);
      Alert.alert('Error', 'Failed to search organizations');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSubmitRequest = async () => {
    if (!selectedOrg || !myTeam) return;

    setSubmitting(true);
    try {
      await Organization.requestToJoin(
        selectedOrg.id,
        message.trim() || undefined,
        undefined
      );

      Alert.alert(
        'Request Sent',
        `Your request to join "${selectedOrg.name}" has been sent to their administrators.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      console.error('[RequestJoinOrg] Error submitting request:', err);
      Alert.alert('Error', err?.message || 'Failed to send join request');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedOrg && myTeam && !submitting;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Join Organization',
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Pressable onPress={() => void router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Join Organization</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Your Team Info */}
        {myTeam && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Team</Text>
            <View style={styles.teamInfoRow}>
              {myTeam.logo_url ? (
                <Image source={{ uri: myTeam.logo_url }} style={styles.teamLogo} contentFit="cover" />
              ) : (
                <View style={[styles.teamLogoPlaceholder, { backgroundColor: theme.surface }]}>
                  <Ionicons name="people" size={24} color={theme.mutedText} />
                </View>
              )}
              <View style={styles.teamInfoText}>
                <Text style={[styles.teamName, { color: theme.text }]}>{myTeam.name}</Text>
                {(myTeam.sport || myTeam.season) && (
                  <Text style={[styles.teamMeta, { color: theme.mutedText }]}>
                    {[myTeam.sport, myTeam.season].filter(Boolean).join(' • ')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Search Organizations */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Search Organization</Text>
          <Text style={[styles.sectionDescription, { color: theme.mutedText }]}>
            Find the school, club, or league you want to join
          </Text>
          
          <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={20} color={theme.mutedText} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="e.g., Stamford High School"
              placeholderTextColor={theme.mutedText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searching && <ActivityIndicator size="small" color={theme.tint} />}
          </View>

          {/* Search Results */}
          {organizations.length > 0 && (
            <View style={styles.resultsContainer}>
              {organizations.map((org) => {
                const isSelected = selectedOrg?.id === org.id;
                return (
                  <Pressable
                    key={org.id}
                    onPress={() => setSelectedOrg(org)}
                    style={[
                      styles.orgCard,
                      {
                        backgroundColor: isSelected ? theme.tint : theme.surface,
                        borderColor: isSelected ? theme.tint : theme.border,
                      },
                    ]}
                  >
                    <View style={styles.orgCardContent}>
                      {org.avatar_url ? (
                        <Image source={{ uri: org.avatar_url }} style={styles.orgLogo} contentFit="cover" />
                      ) : (
                        <View style={[styles.orgLogoPlaceholder, { backgroundColor: isSelected ? '#fff' : theme.background }]}>
                          <Ionicons
                            name="business"
                            size={20}
                            color={isSelected ? theme.tint : theme.mutedText}
                          />
                        </View>
                      )}
                      <View style={styles.orgInfo}>
                        <Text style={[styles.orgName, { color: isSelected ? '#fff' : theme.text }]}>
                          {org.name}
                        </Text>
                        {org.description && (
                          <Text
                            style={[styles.orgDescription, { color: isSelected ? '#fff' : theme.mutedText }]}
                            numberOfLines={1}
                          >
                            {org.description}
                          </Text>
                        )}
                        {org.teams && org.teams.length > 0 && (
                          <Text style={[styles.orgTeamCount, { color: isSelected ? '#fff' : theme.mutedText }]}>
                            {org.teams.length} team{org.teams.length === 1 ? '' : 's'}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {searchQuery.trim() && !searching && organizations.length === 0 && (
            <View style={styles.noResults}>
              <Ionicons name="search-outline" size={32} color={theme.mutedText} />
              <Text style={[styles.noResultsText, { color: theme.mutedText }]}>
                No organizations found
              </Text>
            </View>
          )}
        </View>

        {/* Optional Message */}
        {selectedOrg && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Message to {selectedOrg.name} (Optional)
            </Text>
            <TextInput
              style={[
                styles.messageInput,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Tell them why you want to join..."
              placeholderTextColor={theme.mutedText}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: theme.mutedText }]}>
              {message.length}/500
            </Text>
          </View>
        )}

        {/* Submit Button */}
        {selectedOrg && (
          <Pressable
            onPress={handleSubmitRequest}
            disabled={!canSubmit}
            style={[
              styles.submitButton,
              {
                backgroundColor: canSubmit ? theme.tint : theme.surface,
                opacity: canSubmit ? 1 : 0.5,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Send Join Request</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  teamInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamInfoText: {
    flex: 1,
    gap: 4,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
  },
  teamMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  resultsContainer: {
    gap: 8,
    marginTop: 4,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  orgCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  orgLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgInfo: {
    flex: 1,
    gap: 2,
  },
  orgName: {
    fontSize: 15,
    fontWeight: '600',
  },
  orgDescription: {
    fontSize: 13,
    fontWeight: '500',
  },
  orgTeamCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  noResultsText: {
    fontSize: 14,
  },
  messageInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
