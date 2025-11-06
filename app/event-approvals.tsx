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
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { httpGet, httpPut } from '@/api/http';
// @ts-ignore JS exports
import { Game, User } from '@/api/entities';
import QuickAddGameModal, { QuickGameData } from '@/components/QuickAddGameModal';

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
  
  const [sectionTab, setSectionTab] = useState<'team-hub' | 'create-event' | 'approvals' | 'organization'>('approvals');
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  
  const loadPendingEvents = async () => {
    try {
      // Load user data for modal
      try {
        const user = await User.me();
        setMe(user);
      } catch (err) {
        console.warn('Unable to fetch user data:', err);
      }

      const response = await httpGet('/games?show_pending=true&approval_status=pending');
      if (response.ok) {
        const data = await response.json();
        // Filter only pending events
        const pendingEvents = (data || []).filter((event: any) => event.approval_status === 'pending');
        setEvents(pendingEvents);
      } else {
        console.warn('Failed to load events, using empty list');
        setEvents([]);
      }
    } catch (e: any) {
      console.warn('Error loading pending events (backend may be deploying):', e?.message || e);
      setEvents([]);
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
      const response = await httpPut(`/games/${eventId}/approve`, {
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
              const response = await httpPut(`/games/${eventId}/approve`, {
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
      ]
    );
  };

  const handleQuickGameSave = useCallback(async (data: QuickGameData) => {
    try {
      // Parse date and time
      const [year, month, day] = data.date.split('-').map(Number);
      const timeParts = data.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeParts) throw new Error('Invalid time format');
      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const isPM = timeParts[3].toUpperCase() === 'PM';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      const gameDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));

      // Create game payload
      const gamePayload: Record<string, any> = {
        title: data.isCompetitive 
          ? `${data.currentTeam} vs ${data.opponent}`
          : `${data.currentTeam} Event`,
        date: gameDateTime.toISOString(),
        description: data.description || (data.isCompetitive
          ? `${data.type === 'home' ? 'Home' : 'Away'} game: ${data.currentTeam} vs ${data.opponent}`
          : `Event for ${data.currentTeam}`),
      };

      // Only add team fields if this is a competitive game
      if (data.isCompetitive) {
        gamePayload.home_team = data.type === 'home' ? data.currentTeam : data.opponent;
        gamePayload.away_team = data.type === 'home' ? data.opponent : data.currentTeam;
        
        if (data.currentTeamId) gamePayload.home_team_id = data.type === 'home' ? data.currentTeamId : null;
        if (data.opponentTeamId) {
          gamePayload.away_team_id = data.type === 'home' ? data.opponentTeamId : data.currentTeamId;
        } else if (data.opponent) {
          gamePayload.away_team_name = data.opponent;
        }
      } else {
        // For non-competitive events, still send home_team_id for approval workflow
        if (data.currentTeamId) {
          gamePayload.home_team_id = data.currentTeamId;
        }
      }

      // Add expected attendance if provided
      if (data.expectedAttendance) {
        gamePayload.expected_attendance = data.expectedAttendance;
      }

      // Add event type
      if (data.eventType) {
        gamePayload.event_type = data.eventType;
      }
      
      // Add event type-specific fields
      if (data.donationGoal) {
        gamePayload.donation_goal = data.donationGoal;
      }
      if (data.watchLocation) {
        gamePayload.watch_location = data.watchLocation;
        if (data.watchLocationLat) gamePayload.watch_location_lat = data.watchLocationLat;
        if (data.watchLocationLng) gamePayload.watch_location_lng = data.watchLocationLng;
        if (data.watchLocationPlaceId) gamePayload.watch_location_place_id = data.watchLocationPlaceId;
      }
      if (data.destination) {
        gamePayload.destination = data.destination;
      }

      if (data.banner_url) {
        gamePayload.banner_url = data.banner_url;
        gamePayload.cover_image_url = data.banner_url;
      } else if (data.cover_image_url) {
        gamePayload.cover_image_url = data.cover_image_url;
      }

      if (data.appearance) {
        gamePayload.appearance = data.appearance;
      }

      // Create game using the API
      await Game.create(gamePayload);

      setCreateEventModalOpen(false);
      
      // Refresh the events list
      await loadPendingEvents();
      
      // Show success message
      Alert.alert('Success', data.isCompetitive ? 'Game added successfully!' : 'Event added successfully!');
    } catch (error) {
      console.error('Error adding quick game:', error);
      Alert.alert('Error', `Failed to add event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);
  
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
      <Text style={[styles.emptyTitle, { color: Colors[colorScheme].mutedText }]}>The approval queue is empty.</Text>
      <Text style={[styles.emptyText, { color: Colors[colorScheme].text }]}>
        Submitted events will appear here.
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Approvals', headerShown: true }} />
      
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={[styles.iconContainer, { backgroundColor: '#F59E0B' }]}>
          <Ionicons name="notifications" size={32} color="#fff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Approval Queue</Text>
          <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>
            Review events submitted by the community.
          </Text>
        </View>
      </View>
      
      {/* Section Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.sectionTabBar, { borderBottomColor: Colors[colorScheme].border }]}
        contentContainerStyle={styles.sectionTabContent}
      >
        <Pressable
          style={[
            styles.sectionTab,
            sectionTab === 'team-hub' && { borderBottomColor: Colors[colorScheme].text, borderBottomWidth: 2 }
          ]}
          onPress={() => setSectionTab('team-hub')}
        >
          <Text style={[
            styles.sectionTabLabel,
            {
              color: sectionTab === 'team-hub' ? Colors[colorScheme].text : Colors[colorScheme].mutedText,
              fontWeight: sectionTab === 'team-hub' ? '600' : '400'
            }
          ]}>
            Team Hub
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.sectionTab,
            sectionTab === 'create-event' && { borderBottomColor: Colors[colorScheme].text, borderBottomWidth: 2 }
          ]}
          onPress={() => {
            // Role-based navigation
            if (me?.role === 'coach') {
              router.push('/manage-season');
            } else {
              setCreateEventModalOpen(true);
            }
          }}
        >
          <Text style={[
            styles.sectionTabLabel,
            {
              color: sectionTab === 'create-event' ? Colors[colorScheme].text : Colors[colorScheme].mutedText,
              fontWeight: sectionTab === 'create-event' ? '600' : '400'
            }
          ]}>
            {me?.role === 'coach' ? 'Team Schedule' : 'Add Event'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.sectionTab,
            sectionTab === 'approvals' && { borderBottomColor: Colors[colorScheme].text, borderBottomWidth: 2 }
          ]}
          onPress={() => setSectionTab('approvals')}
        >
          <Text style={[
            styles.sectionTabLabel,
            {
              color: sectionTab === 'approvals' ? Colors[colorScheme].text : Colors[colorScheme].mutedText,
              fontWeight: sectionTab === 'approvals' ? '600' : '400'
            }
          ]}>
            Approvals
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.sectionTab,
            sectionTab === 'organization' && { borderBottomColor: Colors[colorScheme].text, borderBottomWidth: 2 }
          ]}
          onPress={() => setSectionTab('organization')}
        >
          <Text style={[
            styles.sectionTabLabel,
            {
              color: sectionTab === 'organization' ? Colors[colorScheme].text : Colors[colorScheme].mutedText,
              fontWeight: sectionTab === 'organization' ? '600' : '400'
            }
          ]}>
            Organization
          </Text>
        </Pressable>
      </ScrollView>
      
      {/* Content based on selected tab */}
      {sectionTab === 'approvals' ? (
        loading ? (
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
        )
      ) : sectionTab === 'team-hub' ? (
        <View style={styles.contentSection}>
          <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </View>
              <View style={styles.sectionCardTextContainer}>
                <Text style={[styles.sectionCardTitle, { color: Colors[colorScheme].text }]}>Team Management</Text>
                <Text style={[styles.sectionCardSubtitle, { color: Colors[colorScheme].mutedText }]}>
                  Create new teams and manage existing ones.
                </Text>
              </View>
            </View>
            <View style={[styles.emptyStateBox, { borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.emptyStateText, { color: Colors[colorScheme].mutedText }]}>
                You haven't created your organization yet.
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: Colors[colorScheme].mutedText }]}>
                Set up your school or league page to get started.
              </Text>
              <Pressable
                style={[styles.createButton, { backgroundColor: '#3B82F6' }]}
                onPress={() => router.push('/create-team')}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Organization</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : sectionTab === 'organization' ? (
        <View style={styles.contentSection}>
          <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="business" size={28} color="#fff" />
              </View>
              <View style={styles.sectionCardTextContainer}>
                <Text style={[styles.sectionCardTitle, { color: Colors[colorScheme].text }]}>Organizations</Text>
                <Text style={[styles.sectionCardSubtitle, { color: Colors[colorScheme].mutedText }]}>
                  View and manage your organizations.
                </Text>
              </View>
            </View>
            <View style={[styles.emptyStateBox, { borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.emptyStateText, { color: Colors[colorScheme].mutedText }]}>
                No organizations found.
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: Colors[colorScheme].mutedText }]}>
                Create your first organization to get started.
              </Text>
              <Pressable
                style={[styles.createButton, { backgroundColor: '#8B5CF6' }]}
                onPress={() => router.push('/create-team')}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Organization</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Add Event Modal */}
      <QuickAddGameModal
        visible={createEventModalOpen}
        onClose={() => setCreateEventModalOpen(false)}
        onSave={handleQuickGameSave}
        currentTeamName={me?.team?.name}
        currentTeamId={me?.team?.id}
        userRole={me?.role || 'fan'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
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
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    borderStyle: 'dashed',
    borderRadius: 12,
    margin: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  sectionTabContent: {
    paddingVertical: 2,
    gap: 16,
  },
  sectionTab: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sectionTabLabel: {
    fontSize: 13,
  },
  contentSection: {
    flex: 1,
    padding: 0,
  },
  sectionCard: {
    borderRadius: 0,
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCardTextContainer: {
    flex: 1,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyStateBox: {
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginTop: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
