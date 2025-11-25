import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTeamOptions } from '@/hooks/useTeamOptions';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
// Team entities are returned via useTeamOptions hook

interface TeamOption {
  id: string;
  name: string;
  logo_url?: string | null;
  city?: string | null;
  state?: string | null;
  league?: string | null;
  sport?: string | null;
  venue?: {
    place_id: string;
    lat: number;
    lng: number;
    address: string;
    updated_at?: string;
  } | null;
}

interface TeamSearchInputProps {
  label: string;
  value: string;
  onSelect: (team: TeamOption | null) => void;
  placeholder?: string;
  allowManualEntry?: boolean; // If true, allow typing custom name if no match
  showDeepLink?: boolean; // Show "View Team Page" link for selected team
  disabled?: boolean;
  error?: string;
}

export default function TeamSearchInput({
  label,
  value,
  onSelect,
  placeholder = 'Search teams...',
  allowManualEntry = false,
  showDeepLink = false,
  disabled = false,
  error,
}: TeamSearchInputProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const { teams: rawTeams, loading, refresh } = useTeamOptions(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamOption | null>(null);

  // Map API payload to TeamOption shape
  useEffect(() => {
    if (!Array.isArray(rawTeams)) {
      setTeams([]);
      return;
    }
    const mapped: TeamOption[] = rawTeams.map((team: any) => ({
      id: String(team.id),
      name: team.name || 'Team',
      logo_url: team.logo_url || team.avatar_url,
      city: team.city || team.school_city || null,
      state: team.state || team.school_state || null,
      league: team.league || null,
      sport: team.sport || null,
      venue: team.venue || null,
    }));
    setTeams(mapped);
  }, [rawTeams]);

  // Load teams when picker opens
  useEffect(() => {
    if (showPicker && teams.length === 0) {
      refresh().catch(() => {});
    }
  }, [refresh, showPicker, teams.length]);

  // Debounced search
  useEffect(() => {
    if (!showPicker) return;
    const timer = setTimeout(() => {
      refresh(searchQuery.length > 0 ? searchQuery : undefined).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [refresh, searchQuery, showPicker]);

  const handleSelect = (team: TeamOption) => {
    setSelectedTeam(team);
    onSelect(team);
    setShowPicker(false);
    setSearchQuery('');
  };

  const handleManualEntry = () => {
    if (allowManualEntry && searchQuery.trim()) {
      // Create a pseudo-team object with just the name
      const manualTeam: TeamOption = {
        id: 'manual',
        name: searchQuery.trim(),
      };
      setSelectedTeam(manualTeam);
      onSelect(manualTeam);
      setShowPicker(false);
      setSearchQuery('');
    }
  };

  const handleClear = () => {
    setSelectedTeam(null);
    onSelect(null);
  };

  const handleViewTeamPage = () => {
    if (selectedTeam && selectedTeam.id !== 'manual') {
      router.push(`/team-profile?id=${selectedTeam.id}`);
    }
  };

  // Disambiguation: Show city/league/sport to help differentiate teams with similar names
  const renderDisambiguation = (team: TeamOption) => {
    const parts: string[] = [];
    if (team.city) parts.push(team.city);
    if (team.state) parts.push(team.state);
    if (team.league) parts.push(team.league);
    if (team.sport) parts.push(team.sport);
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  const renderTeamItem = ({ item }: { item: TeamOption }) => {
    const disambiguation = renderDisambiguation(item);
    
    return (
      <Pressable
        style={[styles.teamItem, { borderBottomColor: Colors[colorScheme].border }]}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.teamItemContent}>
          <View style={styles.teamItemLeft}>
            {item.logo_url ? (
              <View style={[styles.teamLogo, { backgroundColor: Colors[colorScheme].card }]}>
                <Text style={styles.teamLogoText}>{item.name.charAt(0)}</Text>
              </View>
            ) : (
              <View style={[styles.teamLogo, { backgroundColor: Colors[colorScheme].card }]}>
                <Ionicons name="shield" size={16} color={Colors[colorScheme].mutedText} />
              </View>
            )}
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: Colors[colorScheme].text }]}>
                {item.name}
              </Text>
              {disambiguation && (
                <Text style={[styles.teamDisambiguation, { color: Colors[colorScheme].mutedText }]}>
                  {disambiguation}
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors[colorScheme].mutedText} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={[styles.label, { color: Colors[colorScheme].text }]}>{label}</Text>

      {/* Selected Value Display */}
      <Pressable
        style={[
          styles.input,
          { 
            backgroundColor: Colors[colorScheme].card, 
            borderColor: error ? '#DC2626' : Colors[colorScheme].border 
          },
          disabled && styles.inputDisabled,
        ]}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        <Text 
          style={[
            styles.inputText, 
            { color: value ? Colors[colorScheme].text : Colors[colorScheme].mutedText }
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        {value && !disabled ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
          </Pressable>
        ) : (
          <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
        )}
      </Pressable>

      {/* Error Message */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Deep Link to Team Page */}
      {showDeepLink && selectedTeam && selectedTeam.id !== 'manual' && (
        <Pressable onPress={handleViewTeamPage} style={styles.deepLinkContainer}>
          <Ionicons name="open-outline" size={14} color={Colors[colorScheme].tint} />
          <Text style={[styles.deepLinkText, { color: Colors[colorScheme].tint }]}>
            View Team Page
          </Text>
        </Pressable>
      )}

      {/* Team Picker Modal */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={[styles.modalContainer, { 
          paddingTop: Math.max(insets.top, 16),
          backgroundColor: Colors[colorScheme].background 
        }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: Colors[colorScheme].border }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>
              {label}
            </Text>
            <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputContainer, { 
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border 
            }]}>
              <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
              <TextInput
                style={[styles.searchInput, { color: Colors[colorScheme].text }]}
                placeholder={placeholder}
                placeholderTextColor={Colors[colorScheme].mutedText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType={allowManualEntry ? 'done' : 'search'}
                onSubmitEditing={allowManualEntry ? handleManualEntry : undefined}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Manual Entry Option */}
          {allowManualEntry && searchQuery.trim() && teams.length === 0 && !loading && (
            <Pressable
              style={[styles.manualEntryButton, { borderColor: Colors[colorScheme].border }]}
              onPress={handleManualEntry}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors[colorScheme].tint} />
              <Text style={[styles.manualEntryText, { color: Colors[colorScheme].tint }]}>
                Use "{searchQuery}" (not in directory)
              </Text>
            </Pressable>
          )}

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
          )}

          {/* Team List */}
          {!loading && (
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={renderTeamItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
                    {searchQuery ? 'No teams found' : 'Start typing to search teams'}
                  </Text>
                  {allowManualEntry && searchQuery && (
                    <Text style={[styles.emptyHint, { color: Colors[colorScheme].mutedText }]}>
                      You can enter a custom opponent name
                    </Text>
                  )}
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  deepLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  deepLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  manualEntryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  listContent: {
    flexGrow: 1,
  },
  teamItem: {
    borderBottomWidth: 1,
  },
  teamItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  teamItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  teamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoText: {
    fontSize: 18,
    fontWeight: '700',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamDisambiguation: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
