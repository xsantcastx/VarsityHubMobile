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
  const errorSurface = colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2';
  const infoSurface = colorScheme === 'dark' ? 'rgba(37, 99, 235, 0.18)' : '#DBEAFE';
  const infoAccent = colorScheme === 'dark' ? '#93C5FD' : '#2563EB';
  const infoText = colorScheme === 'dark' ? '#DBEAFE' : '#1E40AF';
  const neutralSurface = colorScheme === 'dark' ? theme.surface : '#F3F4F6';
  const softSurface = colorScheme === 'dark' ? theme.card : '#F9FAFB';

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
        <View style={[styles.errorContainer, { backgroundColor: errorSurface }]}>
          <MaterialIcons name="error" size={24} color={theme.destructive} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            Zip code <Text style={styles.zipHighlight}>{requestedZip}</Text> is fully booked for
            your selected dates.
          </Text>
        </View>

        {/* Coverage info */}
        <View style={[styles.infoContainer, { backgroundColor: infoSurface }]}>
          <MaterialIcons name="info-outline" size={20} color={infoAccent} />
          <Text style={[styles.infoText, { color: infoText }]}>
            We found nearby zip codes within 20 miles that have availability:
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.tint} />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>Checking nearby availability...</Text>
          </View>
        )}

        {!loading && alternatives.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="sentiment-dissatisfied" size={48} color={theme.mutedText} />
            <Text style={[styles.emptyText, { color: theme.text }]}>
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
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
                onPress={() => {
                  onSelectZip(alt.zip);
                  onClose();
                }}
              >
                {/* Zip and Distance */}
                <View style={styles.alternativeHeader}>
                  <View style={styles.zipContainer}>
                    <Text style={[styles.zipCode, { color: theme.text }]}>
                      {alt.zip}
                    </Text>
                    {alt.city && alt.state && (
                      <Text style={[styles.zipLocation, { color: theme.mutedText }]}>
                        {alt.city}, {alt.state}
                      </Text>
                    )}
                  </View>
                  {alt.distance !== undefined && (
                    <View style={[styles.distanceBadge, { backgroundColor: neutralSurface }]}>
                      <MaterialIcons name="location-on" size={14} color={theme.mutedText} />
                      <Text style={[styles.distanceText, { color: theme.mutedText }]}>{formatDistance(alt.distance)}</Text>
                    </View>
                  )}
                </View>

                {/* Availability */}
                <View style={styles.availabilityContainer}>
                  <View style={[styles.availabilityBar, { backgroundColor: colorScheme === 'dark' ? theme.border : '#D1D5DB' }]}>
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
                  <Text style={[styles.selectButtonText, { color: theme.tint }]}>Select This Zip</Text>
                  <MaterialIcons name="chevron-right" size={16} color={theme.tint} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Coverage explanation */}
        <View style={[styles.explanationContainer, { backgroundColor: softSurface }]}>
          <Text style={[styles.explanationText, { color: theme.text }]}>
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
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
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
  },
  explanationContainer: {
    marginTop: 16,
    padding: 12,
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
