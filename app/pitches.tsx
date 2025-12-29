import { listPitches, approvePitch, rejectPitch, normalizeApiError } from '@/api/events';
import { Button } from '@/shared/ui';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

type PitchItem = {
  id: string;
  title: string;
  date?: string;
  location?: string;
  approval_status?: string;
  creator?: { id: string; display_name?: string; avatar_url?: string };
  event_type?: string;
  is_pitch?: boolean;
};

export default function PitchesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [pitches, setPitches] = useState<PitchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: PitchItem[] = await listPitches();
      setPitches(Array.isArray(res) ? res : []);
    } catch (err: any) {
      Alert.alert('Load failed', normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await approvePitch(id);
      setPitches((prev) => prev.filter((p) => p.id !== id));
      Alert.alert('Approved', 'Pitch approved and published.');
    } catch (err: any) {
      Alert.alert('Approval failed', normalizeApiError(err));
    }
  };

  const reject = async (id: string) => {
    try {
      await rejectPitch(id);
      setPitches((prev) => prev.filter((p) => p.id !== id));
      Alert.alert('Rejected', 'Pitch rejected.');
    } catch (err: any) {
      Alert.alert('Rejection failed', normalizeApiError(err));
    }
  };

  const renderItem = ({ item }: { item: PitchItem }) => {
    const date = item.date ? new Date(item.date).toLocaleString() : 'TBD';
    return (
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
          {item.title || 'Untitled pitch'}
        </Text>
        <Text style={{ color: palette.mutedText, marginBottom: 4 }}>{date}</Text>
        {item.location ? (
          <Text style={{ color: palette.mutedText }} numberOfLines={2}>
            {item.location}
          </Text>
        ) : null}
        {item.creator?.display_name ? (
          <Text style={{ color: palette.mutedText, marginTop: 4 }}>By {item.creator.display_name}</Text>
        ) : null}
        <View style={styles.actions}>
          <Button variant="outline" onPress={() => reject(item.id)}>
            <Text>Reject</Text>
          </Button>
          <Button onPress={() => approve(item.id)}>
            <Text>Approve</Text>
          </Button>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.header, { color: palette.text }]}>Pending Pitches</Text>
      <FlatList
        data={pitches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.tint} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: palette.mutedText, textAlign: 'center', marginTop: 16 }}>
              No pending pitches.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 24, fontWeight: '800', padding: 16, paddingBottom: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  title: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
});
