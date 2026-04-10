/**
 * Zip Code Alternatives Modal
 * 
 * Displays alternative zip codes when requested zip is at capacity
 * Shows nearby options within 20-mile radius with distance and availability
 */

import CustomActionModal from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { formatDistance } from '../utils/zipCodeUtils';

interface ZipCodeAvailability {
  zip: string;
  available: boolean;
  capacity: number;
  reserved: number;
  distance?: number;
  city?: string;
  state?: string;
}

interface ZipAlternativesModalProps {
  visible: boolean;
  requestedZip: string;
  alternatives: ZipCodeAvailability[];
  onSelectZip: (zip: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function ZipAlternativesModal({
  visible,
  requestedZip,
  alternatives,
  onSelectZip,
  onClose,
  loading = false,
}: ZipAlternativesModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <CustomActionModal
      visible={visible}
      title="Ad Slots Full"
      onClose={onClose}
      options={[
        {
          label: 'Cancel',
          onPress: onClose,
          color: theme.mutedText,
        },
      ]}
    >
      <ScrollView style={styles.content}>
        {/* Error message */}
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={24} color="#DC2626" />
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>
            Zip code <Text style={styles.zipHighlight}>{requestedZip}</Text> is fully booked for
            your selected dates.
          </Text>
        </View>

        {/* Coverage info */}
        <View style={styles.infoContainer}>
          <MaterialIcons name="info-outline" size={20} color="#2563EB" />
          <Text style={styles.infoText}>
            We found nearby zip codes within 20 miles that have availability:
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#2563EB" />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>Checking nearby availability...</Text>
          </View>
        )}

        {!loading && alternatives.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="sentiment-dissatisfied" size={48} color="#9CA3AF" />
            <Text style={[styles.emptyText, { color: Colors[colorScheme].text }]}>
              No nearby zip codes with availability found.
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.mutedText }]}>
              Try selecting different dates or check back later.
            </Text>
          </View>
        )}

        {!loading && alternatives.length > 0 && (
          <View style={styles.alternativesList}>
            <Text style={[styles.listTitle, { color: Colors[colorScheme].text }]}>
              Available Nearby Zip Codes
            </Text>
            {alternatives.map((alt) => (
              <Pressable
                key={alt.zip}
                style={[
                  styles.alternativeCard,
                  { backgroundColor: Colors[colorScheme].background },
                ]}
                onPress={() => {
                  onSelectZip(alt.zip);
                  onClose();
                }}
              >
                {/* Zip and Distance */}
                <View style={styles.alternativeHeader}>
                  <View style={styles.zipContainer}>
                    <Text style={[styles.zipCode, { color: Colors[colorScheme].text }]}>
                      {alt.zip}
                    </Text>
                    {alt.city && alt.state && (
                      <Text style={[styles.zipLocation, { color: theme.mutedText }]}>
                        {alt.city}, {alt.state}
                      </Text>
                    )}
                  </View>
                  {alt.distance !== undefined && (
                    <View style={styles.distanceBadge}>
                      <MaterialIcons name="location-on" size={14} color={theme.mutedText} />
                      <Text style={[styles.distanceText, { color: theme.mutedText }]}>{formatDistance(alt.distance)}</Text>
                    </View>
                  )}
                </View>

                {/* Availability */}
                <View style={styles.availabilityContainer}>
                  <View style={styles.availabilityBar}>
                    <View
                      style={[
                        styles.availabilityFill,
                        {
                          width: `${((alt.capacity - alt.reserved) / alt.capacity) * 100}%`,
                          backgroundColor: alt.available ? '#10B981' : '#EF4444',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.availabilityText, { color: theme.mutedText }]}>
                    {alt.capacity - alt.reserved} of {alt.capacity} slots available
                  </Text>
                </View>

                {/* Select button */}
                <View style={styles.selectButton}>
                  <Text style={styles.selectButtonText}>Select This Zip</Text>
                  <MaterialIcons name="chevron-right" size={16} color="#2563EB" />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Coverage explanation */}
        <View style={styles.explanationContainer}>
          <Text style={[styles.explanationText, { color: Colors[colorScheme].text }]}>
            <Text style={styles.bold}>20-Mile Radius Coverage:</Text> Your ad will reach users
            within 20 miles of the selected zip code. Selecting a nearby zip ensures you still reach
            your target audience.
          </Text>
        </View>
      </ScrollView>
    </CustomActionModal>
  );
}

const styles = StyleSheet.create({
  content: {
    maxHeight: 500,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  zipHighlight: {
    fontWeight: '700',
    color: '#DC2626',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  alternativesList: {
    gap: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  alternativeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 12,
  },
  alternativeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  zipContainer: {
    flex: 1,
  },
  zipCode: {
    fontSize: 18,
    fontWeight: '700',
  },
  zipLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availabilityContainer: {
    gap: 6,
  },
  availabilityBar: {
    height: 8,
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  availabilityFill: {
    height: '100%',
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 12,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  explanationContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
});
