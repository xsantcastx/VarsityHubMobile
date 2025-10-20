import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi, User } from '@/api/entities';

export default function AdminTeamsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await User.me();
      const list = await TeamApi.list('', false); // Explicitly pass false for mine parameter to get all teams
      setTeams(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load teams'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTeamSelection = (teamId: string) => {
    const newSet = new Set(selectedTeams);
    if (newSet.has(teamId)) {
      newSet.delete(teamId);
    } else {
      newSet.add(teamId);
    }
    setSelectedTeams(newSet);
  };

  const selectAll = () => {
    if (selectedTeams.size === teams.length) {
      setSelectedTeams(new Set());
    } else {
      setSelectedTeams(new Set(teams.map(t => String(t.id))));
    }
  };

  const bulkDelete = async () => {
    if (selectedTeams.size === 0) return;
    
    Alert.alert(
      'Delete Teams',
      `Delete ${selectedTeams.size} team${selectedTeams.size > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Delete each selected team
              for (const teamId of Array.from(selectedTeams)) {
                try {
                  await TeamApi.delete(teamId);
                } catch (e) {
                  console.error('Failed to delete team:', teamId, e);
                }
              }
              Alert.alert('Success', `Deleted ${selectedTeams.size} team${selectedTeams.size > 1 ? 's' : ''}`);
              setSelectedTeams(new Set());
              setBulkMode(false);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete teams');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const theme = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Admin · All Teams',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12, marginRight: 8 }}>
              {bulkMode && (
                <>
                  <Pressable onPress={selectAll} style={{ padding: 8 }}>
                    <Text style={{ color: theme.tint, fontWeight: '600' }}>
                      {selectedTeams.size === teams.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={bulkDelete} 
                    disabled={selectedTeams.size === 0 || deleting}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ 
                      color: selectedTeams.size > 0 ? '#dc2626' : '#9ca3af', 
                      fontWeight: '600' 
                    }}>
                      Delete ({selectedTeams.size})
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setBulkMode(!bulkMode)} style={{ padding: 8 }}>
                <Ionicons 
                  name={bulkMode ? 'close' : 'checkmark-circle-outline'} 
                  size={24} 
                  color={bulkMode ? '#dc2626' : theme.tint} 
                />
              </Pressable>
              <Pressable onPress={() => router.push('/create-team')} style={{ padding: 8 }}>
                <Ionicons name="add-circle" size={24} color={theme.tint} />
              </Pressable>
            </View>
          )
        }} 
      />
      
      {loading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator color={theme.tint} />
        </View>
      ) : null}
      
      {error ? (
        <Text style={[styles.error, { color: '#dc2626' }]}>{error}</Text>
      ) : null}
      
      {!loading && !error && (
        <FlatList
          data={teams}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <Pressable 
              style={[
                styles.row, 
                { 
                  backgroundColor: theme.card, 
                  borderColor: theme.border 
                },
                bulkMode && selectedTeams.has(String(item.id)) && {
                  borderColor: theme.tint,
                  borderWidth: 2
                }
              ]}
              onPress={() => {
                if (bulkMode) {
                  toggleTeamSelection(String(item.id));
                } else {
                  router.push({ pathname: '/team-profile', params: { id: item.id } });
                }
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {bulkMode && (
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedTeams.has(String(item.id)) ? theme.tint : '#d1d5db',
                    backgroundColor: selectedTeams.has(String(item.id)) ? theme.tint : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedTeams.has(String(item.id)) && (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    )}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.text }]}>{item.name}</Text>
                  {item.description ? (
                    <Text style={[styles.meta, { color: theme.mutedText }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Text style={[styles.meta, { color: theme.mutedText }]}>
                      <Ionicons name="people" size={12} /> {item.members || 0} members
                    </Text>
                    {item.sport && (
                      <Text style={[styles.meta, { color: theme.mutedText }]}>
                        <Ionicons name="american-football" size={12} /> {item.sport}
                      </Text>
                    )}
                  </View>
                </View>
                {!bulkMode && (
                  <Pressable 
                    onPress={() => router.push({ pathname: '/edit-team', params: { id: item.id } })}
                    style={{ padding: 8 }}
                  >
                    <Ionicons name="pencil" size={20} color={theme.tint} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={64} color={theme.mutedText} />
              <Text style={{ color: theme.mutedText, fontSize: 16, marginTop: 16 }}>
                No teams found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  title: { 
    fontWeight: '800', 
    fontSize: 16,
    marginBottom: 4
  },
  meta: { 
    fontSize: 13,
    marginTop: 2
  },
  error: { 
    padding: 16,
    textAlign: 'center',
    fontWeight: '600'
  },
});

