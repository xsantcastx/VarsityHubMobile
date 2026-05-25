import { autocompleteLocations, geocodeLocation, PlaceSuggestion } from '@/api/geocoding';
import { LocationSuggestionListShared } from '@/components/LocationSuggestionListShared';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface LocationPickerProps {
  value: string;
  onLocationSelect: (location: {
    address: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
    postalCode?: string;
  }) => void;
  placeholder?: string;
  error?: string;
  /** When set (e.g. user zip from onboarding), biases Google Places autocomplete toward that area */
  zipBias?: string;
}

function extractPostalCode(address?: string): string | undefined {
  if (!address) return undefined;
  const zipMatch = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return zipMatch?.[0]?.slice(0, 5);
}

export default function LocationPicker({
  value,
  onLocationSelect,
  placeholder = 'Enter location',
  error,
  zipBias,
}: LocationPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [querying, setQuerying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether a suggestion was just selected to avoid re-fetching
  const justSelectedRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup timer on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const fetchSuggestions = useCallback((text: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (text.trim().length < 3) {
      setSuggestions([]);
      setQuerying(false);
      return;
    }

    setQuerying(true);
    timerRef.current = setTimeout(async () => {
      try {
        const zip = zipBias?.replace(/\D/g, '').slice(0, 5);
        const results = await autocompleteLocations(text, 6, zip?.length === 5 ? zip : undefined);
        setSuggestions(results);
      } catch (err) {
        if (__DEV__) console.warn('[LocationPicker] Autocomplete failed:', err);
        setSuggestions([]);
      } finally {
        setQuerying(false);
      }
    }, 300);
  }, [zipBias]);

  const handleChangeText = useCallback(
    (text: string) => {
      // Always notify parent so form validation stays in sync
      onLocationSelect({ address: text });

      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }

      fetchSuggestions(text);
    },
    [onLocationSelect, fetchSuggestions],
  );

  const handleSelect = useCallback(
    (suggestion: PlaceSuggestion) => {
      justSelectedRef.current = true;
      setSuggestions([]);
      setQuerying(false);
      // Immediately notify parent with address + placeId (coordinates resolve async below)
      onLocationSelect({
        address: suggestion.description,
        placeId: suggestion.place_id,
      });
      // Resolve coordinates from the selected address via geocoding API.
      // Previously this was never done — latitude/longitude were always undefined.
      void (async () => {
        try {
          const geo = await geocodeLocation(suggestion.description);
          if (mountedRef.current && geo?.latitude != null && geo?.longitude != null) {
            onLocationSelect({
              address: geo.formatted_address || suggestion.description,
              placeId: suggestion.place_id,
              latitude: geo.latitude,
              longitude: geo.longitude,
              postalCode: extractPostalCode(geo.formatted_address || suggestion.description),
            });
          }
        } catch {
          // Non-critical — server-side auto-geocoding on save covers this gap
          if (__DEV__) console.warn('[LocationPicker] Failed to geocode selected location');
        }
      })();
    },
    [onLocationSelect],
  );

  return (
    <View style={{ zIndex: 9999, position: 'relative' }}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? '#EF4444' : theme.border,
            color: theme.text,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedText}
        value={value}
        onChangeText={handleChangeText}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <LocationSuggestionListShared
        suggestions={suggestions}
        querying={querying}
        onSelect={handleSelect}
        tintColor={theme.tint}
        textColor={theme.text}
        mutedTextColor={theme.mutedText}
        backgroundColor={theme.surface}
        borderColor={theme.border}
        spinnerStyle={styles.spinner}
        listStyle={styles.listView}
        itemStyle={styles.row}
        lastItemStyle={styles.rowLast}
        mainTextStyle={styles.mainText}
        secondaryTextStyle={styles.secondaryText}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    borderRadius: 12,
    borderWidth: 1,
  },
  spinner: {
    position: 'absolute',
    right: 14,
    top: 16,
  },
  listView: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 240,
    overflow: 'hidden',
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  mainText: {
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryText: {
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
});
