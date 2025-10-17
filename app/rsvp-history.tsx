import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Event as EventApi } from '@/api/entities';

type Item = { id: string; created_at?: string; event?: { id: string; title?: string; date?: string; location?: string } };

export default function RsvpHistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const list: any[] = await EventApi.myRsvps();
        if (!mounted) return;
        setItems(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!mounted) return; setError('Failed to load RSVP history');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Filter items by search query and date
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const title = (item.event?.title || '').toLowerCase();
        const location = (item.event?.location || '').toLowerCase();
        return title.includes(q) || location.includes(q);
      });
    }

    // Apply date filter
    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      filtered = filtered.filter((item) => {
        if (!item.event?.date) return false;
        const eventDate = new Date(String(item.event.date));
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });
    }

    return filtered;
  }, [items, searchQuery, selectedDate]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return filteredItems.filter((i) => i.event?.date && new Date(String(i.event.date)).getTime() >= now);
  }, [filteredItems]);
  
  const past = useMemo(() => {
    const now = Date.now();
    return filteredItems.filter((i) => i.event?.date && new Date(String(i.event.date)).getTime() < now);
  }, [filteredItems]);

  const renderItem = ({ item }: { item: Item }) => (
    <Pressable style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => item.event?.id && router.push(`/event-detail?id=${item.event.id}`)}>
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{item.event?.title || 'Event'}</Text>
      <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>{item.event?.location || 'TBD'}</Text>
      <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>{item.event?.date ? new Date(String(item.event.date)).toLocaleString() : ''}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'RSVP History' }} />
      
      {/* Search and Filter Controls */}
      <View style={styles.filterSection}>
        <View style={[styles.searchContainer, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
          <TextInput
            style={[styles.searchInput, { color: Colors[colorScheme].text }]}
            placeholder="Search events by title or location..."
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
          )}
        </View>
        
        <Pressable 
          style={[styles.dateButton, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
          onPress={() => {
            if (selectedDate) {
              setSelectedDate(null); // Clear filter
            } else {
              setSelectedDate(new Date()); // Set to today
            }
          }}
        >
          <Ionicons name="calendar-outline" size={20} color={selectedDate ? Colors[colorScheme].tint : Colors[colorScheme].mutedText} />
          <Text style={[styles.dateButtonText, { color: selectedDate ? Colors[colorScheme].tint : Colors[colorScheme].mutedText }, selectedDate && styles.dateButtonTextActive]}>
            {selectedDate ? selectedDate.toLocaleDateString() : 'Filter by date'}
          </Text>
          {selectedDate && <Ionicons name="close-circle" size={16} color={Colors[colorScheme].tint} />}
        </Pressable>
      </View>

      <Text style={[styles.header, { color: Colors[colorScheme].text }]}>Upcoming</Text>
      {loading && <View style={{ paddingVertical: 10 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {!loading && upcoming.length === 0 && <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No upcoming RSVPs.</Text>}
      {!loading && upcoming.length > 0 && (
        <FlatList data={upcoming} keyExtractor={(i) => i.id} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} />
      )}
      <Text style={[styles.header, { marginTop: 12, color: Colors[colorScheme].text }]}>Past</Text>
      {!loading && past.length === 0 && <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No past RSVPs.</Text>}
      {!loading && past.length > 0 && (
        <FlatList data={past} keyExtractor={(i) => 'p-' + i.id} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  filterSection: { marginBottom: 16, gap: 10 },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 10, 
    borderWidth: StyleSheet.hairlineWidth, 
  },
  searchInput: { flex: 1, fontSize: 15 },
  dateButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 10, 
    borderWidth: StyleSheet.hairlineWidth, 
  },
  dateButtonText: { flex: 1, fontSize: 14, fontWeight: '600' },
  dateButtonTextActive: { color: '#2563EB' },
  header: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  error: { color: '#b91c1c' },
  muted: {},
  card: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  title: { fontWeight: '700' },
});

