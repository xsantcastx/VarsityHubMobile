import { StyleSheet, Text, View } from 'react-native';

import type { PlaceSuggestion } from '@/api/geocoding';
import { LocationSuggestionListShared } from '@/components/LocationSuggestionListShared';

type EventFormHeaderProps = {
  title: string;
  subtitle: string;
  textColor: string;
  mutedTextColor: string;
};

type LocationSuggestionListProps = {
  suggestions: PlaceSuggestion[];
  querying: boolean;
  onSelect: (suggestion: PlaceSuggestion) => void;
  tintColor: string;
  textColor: string;
  mutedTextColor: string;
  cardColor: string;
  borderColor: string;
};

export function EventFormHeader({
  title,
  subtitle,
  textColor,
  mutedTextColor,
}: EventFormHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: mutedTextColor }]}>{subtitle}</Text>
    </View>
  );
}

export function LocationSuggestionList({
  suggestions,
  querying,
  onSelect,
  tintColor,
  textColor,
  mutedTextColor,
  cardColor,
  borderColor,
}: LocationSuggestionListProps) {
  return (
    <LocationSuggestionListShared
      suggestions={suggestions}
      querying={querying}
      onSelect={onSelect}
      tintColor={tintColor}
      textColor={textColor}
      mutedTextColor={mutedTextColor}
      backgroundColor={cardColor}
      borderColor={borderColor}
      spinnerStyle={styles.locationSpinner}
      listStyle={styles.locationSuggestionList}
      itemStyle={styles.locationSuggestionItem}
      lastItemStyle={styles.locationSuggestionItemLast}
      mainTextStyle={styles.locationSuggestionMain}
      secondaryTextStyle={styles.locationSuggestionSecondary}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationSpinner: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  locationSuggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    zIndex: 1000,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    elevation: 5,
  },
  locationSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  locationSuggestionItemLast: {
    borderBottomWidth: 0,
  },
  locationSuggestionMain: {
    fontSize: 15,
    fontWeight: '500',
  },
  locationSuggestionSecondary: {
    fontSize: 13,
    marginTop: 2,
  },
});
