/**
 * Event Merge Suggestion Modal
 * 
 * Displays merge suggestions when duplicate events are detected
 * Allows coaches to merge or dismiss duplicate game events
 */

import CustomActionModal from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

interface EventLocation {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

interface MergeableEvent {
  id: string;
  title?: string;
  date?: string;
  location?: EventLocation;
  team_id?: string;
  opponent_team_id?: string;
  cover_image_url?: string;
}

interface MergeSuggestion {
  primaryEvent: MergeableEvent;
  duplicateEvent: MergeableEvent;
  matchScore: number;
  reasons: string[];
}

interface EventMergeSuggestionModalProps {
  visible: boolean;
  suggestion: MergeSuggestion | null;
  onMerge: (primaryEventId: string, duplicateEventId: string) => Promise<void>;
  onDismiss: () => void;
  loading?: boolean;
}

export function EventMergeSuggestionModal({
  visible,
  suggestion,
  onMerge,
  onDismiss,
  loading = false,
}: EventMergeSuggestionModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [merging, setMerging] = useState(false);
  const [actionModal, setActionModal] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    options: Array<{ label: string; onPress: () => void; color?: string }>;
  } | null>(null);

  if (!suggestion) return null;

  const { primaryEvent, duplicateEvent, matchScore, reasons } = suggestion;

  const formatEventDate = (date?: string) => {
    if (!date) return 'TBD';
    try {
      return format(new Date(date), 'EEE, MMM d · h:mm a');
    } catch {
      return date;
    }
  };

  const formatLocation = (location?: EventLocation) => {
    if (location?.address) return location.address;
    if (location?.latitude && location?.longitude) {
      return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }
    return 'Location TBD';
  };

  const handleMerge = async () => {
    setMerging(true);
    try {
      await onMerge(primaryEvent.id, duplicateEvent.id);
      setActionModal({
        visible: true,
        title: 'Events Merged',
        message: 'The duplicate events have been successfully merged into a single game.',
        options: [
          {
            label: 'OK',
            onPress: () => {
              setActionModal(null);
              onDismiss();
            },
            color: '#2563EB',
          },
        ],
      });
    } catch (error: any) {
      console.error('Failed to merge events:', error);
      setActionModal({
        visible: true,
        title: 'Merge Failed',
        message: error?.message || 'Unable to merge events. Please try again.',
        options: [
          {
            label: 'OK',
            onPress: () => setActionModal(null),
            color: '#DC2626',
          },
        ],
      });
    } finally {
      setMerging(false);
    }
  };

  const handleDismiss = () => {
    setActionModal({
      visible: true,
      title: 'Keep Both Events?',
      message: 'Are you sure these are not duplicates? Both events will remain separate.',
      options: [
        {
          label: 'Cancel',
          onPress: () => setActionModal(null),
          color: '#6B7280',
        },
        {
          label: 'Keep Separate',
          onPress: () => {
            setActionModal(null);
            onDismiss();
          },
          color: '#2563EB',
        },
      ],
    });
  };

  return (
    <>
      <CustomActionModal
        visible={visible}
        title="Duplicate Event Detected"
        onClose={onDismiss}
        options={[
          {
            label: 'Keep Separate',
            onPress: handleDismiss,
            color: '#6B7280',
          },
          {
            label: merging ? 'Merging...' : 'Merge Events',
            onPress: merging ? () => {} : handleMerge,
            color: '#2563EB',
          },
        ]}
      >
        <ScrollView style={styles.content}>
          {/* Match Score */}
          <View style={styles.scoreContainer}>
            <Ionicons name="git-merge" size={24} color="#2563EB" />
            <Text style={[styles.scoreText, { color: Colors[colorScheme].text }]}>
              {matchScore}% Match
            </Text>
          </View>

          {/* Reasons */}
          <View style={styles.reasonsContainer}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
              Why we think these are duplicates:
            </Text>
            {reasons.map((reason, index) => (
              <View key={index} style={styles.reasonRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.reasonText, { color: Colors[colorScheme].text }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>

          {/* Event Comparison */}
          <View style={styles.comparisonContainer}>
            {/* Primary Event */}
            <View style={[styles.eventCard, { backgroundColor: Colors[colorScheme].background }]}>
              <Text style={[styles.eventLabel, { color: '#2563EB' }]}>Event 1</Text>
              <Text style={[styles.eventTitle, { color: Colors[colorScheme].text }]}>
                {primaryEvent.title || 'Untitled Event'}
              </Text>
              <View style={styles.eventDetail}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.eventDetailText}>{formatEventDate(primaryEvent.date)}</Text>
              </View>
              <View style={styles.eventDetail}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.eventDetailText}>{formatLocation(primaryEvent.location)}</Text>
              </View>
            </View>

            {/* Merge Icon */}
            <View style={styles.mergeIconContainer}>
              <Ionicons name="arrow-down" size={24} color="#6B7280" />
            </View>

            {/* Duplicate Event */}
            <View style={[styles.eventCard, { backgroundColor: Colors[colorScheme].background }]}>
              <Text style={[styles.eventLabel, { color: '#DC2626' }]}>Event 2 (Duplicate)</Text>
              <Text style={[styles.eventTitle, { color: Colors[colorScheme].text }]}>
                {duplicateEvent.title || 'Untitled Event'}
              </Text>
              <View style={styles.eventDetail}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.eventDetailText}>{formatEventDate(duplicateEvent.date)}</Text>
              </View>
              <View style={styles.eventDetail}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.eventDetailText}>
                  {formatLocation(duplicateEvent.location)}
                </Text>
              </View>
            </View>
          </View>

          {/* Explanation */}
          <View style={styles.explanationContainer}>
            <Text style={[styles.explanationText, { color: Colors[colorScheme].text }]}>
              Merging will combine both events into a single game. All RSVPs, posts, and content
              from both events will be preserved.
            </Text>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#2563EB" />
            </View>
          )}
        </ScrollView>
      </CustomActionModal>

      {/* Confirmation modals */}
      {actionModal && (
        <CustomActionModal
          visible={actionModal.visible}
          title={actionModal.title}
          message={actionModal.message}
          options={actionModal.options}
          onClose={() => setActionModal(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    maxHeight: 500,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
  },
  reasonsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  reasonText: {
    fontSize: 14,
    flex: 1,
  },
  comparisonContainer: {
    marginTop: 8,
  },
  eventCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  eventLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventDetailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  mergeIconContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  explanationContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
