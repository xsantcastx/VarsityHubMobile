import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { httpGet, httpPut } from '@/api/http';

type PendingEvent = {
  id: number;
  title: string;
  description?: string;
  event_type: string;
  location: string;
  date: string;
  linked_league?: string;
  max_attendees?: number;
  contact_info?: string;
  creator?: {
    id: number;
    display_name: string;
    avatar_url?: string;
  };
};

const EVENT_TYPE_LABELS: {[key: string]: string} = {
  game: '🏈 Game',
  watch_party: '📺 Watch Party',
  fundraiser: '💰 Fundraiser',
  tryout: '🏃 Tryout',
  bbq: '🍔 BBQ',
  other: '📌 Other',
};

export default function EventApprovalsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const loadPendingEvents = async () => {
    try {
      const response = await httpGet('/api/games?show_pending=true&approval_status=pending');
      if (response.ok) {
        const data = await response.json();
        // Filter only pending events
        const pendingEvents = (data || []).filter((event: any) => event.approval_status === 'pending');
        setEvents(pendingEvents);
      } else {
        throw new Error('Failed to load events');
      }
    } catch (e: any) {
      console.error('Error loading pending events:', e);
      Alert.alert('Error', 'Failed to load pending events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    loadPendingEvents();
  }, []);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPendingEvents();
  }, []);
  
  const handleApprove = async (eventId: number) => {
    setProcessingId(eventId);
    try {
      const response = await httpPut(`/api/games/${eventId}/approve`, {
        approval_status: 'approved'
      });
      if (response.ok) {
        Alert.alert('Event Approved', 'The event has been published!');
        // Remove from list
        setEvents(prev => prev.filter(e => e.id !== eventId));
      } else {
        throw new Error('Failed to approve event');
      }
    } catch (e: any) {
      console.error('Error approving event:', e);
      Alert.alert('Error', e?.message || 'Failed to approve event.');
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleReject = async (eventId: number) => {
    Alert.alert(
      'Reject Event',
      'Are you sure you want to reject this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(eventId);
            try {
              const response = await httpPut(`/api/games/${eventId}/approve`, {
                approval_status: 'rejected'
              });
              if (response.ok) {
                Alert.alert('Event Rejected', 'The event has been rejected.');
                // Remove from list
                setEvents(prev => prev.filter(e => e.id !== eventId));
              } else {
                throw new Error('Failed to reject event');
              }
            } catch (e: any) {
              console.error('Error rejecting event:', e);
              Alert.alert('Error', e?.message || 'Failed to reject event.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };
  
  const renderEventCard = ({ item }: { item: PendingEvent }) => {
    const isProcessing = processingId === item.id;
    const eventDate = new Date(item.date);
    
    return (
      <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.typeContainer}>
            <Text style={[styles.typeLabel, { color: Colors[colorScheme].tint }]}>
              {EVENT_TYPE_LABELS[item.event_type] || item.event_type}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: Colors[colorScheme].mutedText }]}>
            {eventDate.toLocaleDateString()}
          </Text>
        </View>
        
        {/* Title */}
        <Text style={[styles.eventTitle, { color: Colors[colorScheme].text }]}>{item.title}</Text>
        
        {/* Description */}
        {item.description && (
          <Text style={[styles.description, { color: Colors[colorScheme].mutedText }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        {/* Details */}
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.detailText, { color: Colors[colorScheme].mutedText }]}>{item.location}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.detailText, { color: Colors[colorScheme].mutedText }]}>
              {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          {item.linked_league && (
            <View style={styles.detailRow}>
              <Ionicons name="school" size={16} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.detailText, { color: Colors[colorScheme].mutedText }]}>{item.linked_league}</Text>
            </View>
          )}
          
          {item.max_attendees && (
            <View style={styles.detailRow}>
              <Ionicons name="people" size={16} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.detailText, { color: Colors[colorScheme].mutedText }]}>Max: {item.max_attendees}</Text>
            </View>
          )}
        </View>
        
        {/* Creator */}
        {item.creator && (
          <View style={styles.creatorRow}>
            <Ionicons name="person-circle" size={20} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.creatorText, { color: Colors[colorScheme].mutedText }]}>
              Created by {item.creator.display_name}
            </Text>
          </View>
        )}
        
        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.actionButton,
              styles.approveButton,
              { borderColor: '#10B981' },
              isProcessing && styles.actionButtonDisabled,
            ]}
            onPress={() => handleApprove(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={[styles.actionButtonText, { color: '#10B981' }]}>Approve</Text>
              </>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.actionButton,
              styles.rejectButton,
              { borderColor: '#DC2626' },
              isProcessing && styles.actionButtonDisabled,
            ]}
            onPress={() => handleReject(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#DC2626" />
                <Text style={[styles.actionButtonText, { color: '#DC2626' }]}>Reject</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-done-circle" size={64} color={Colors[colorScheme].mutedText} />
      <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>All Caught Up!</Text>
      <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
        No pending events to review at this time.
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Event Approvals', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme].tint}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  details: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  creatorText: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  approveButton: {},
  rejectButton: {},
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
