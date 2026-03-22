import { autocompleteLocations, PlaceSuggestion } from '@/api/geocoding';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  }) => void;
  placeholder?: string;
  error?: string;
}

export default function LocationPicker({
  value,
  onLocationSelect,
  placeholder = 'Enter location',
  error,
}: LocationPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [querying, setQuerying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether a suggestion was just selected to avoid re-fetching
  const justSelectedRef = useRef(false);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
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
        const results = await autocompleteLocations(text, 6);
        setSuggestions(results);
      } catch (err) {
        if (__DEV__) console.warn('[LocationPicker] Autocomplete failed:', err);
        setSuggestions([]);
      } finally {
        setQuerying(false);
      }
    }, 300);
  }, []);

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
      onLocationSelect({
        address: suggestion.description,
        placeId: suggestion.place_id,
      });
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

      {querying && (
        <ActivityIndicator
          size="small"
          color={theme.tint}
          style={styles.spinner}
        />
      )}

      {suggestions.length > 0 && (
        <View
          style={[
            styles.listView,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.place_id}
              style={[
                styles.row,
                { borderBottomColor: theme.border },
                index === suggestions.length - 1 && styles.rowLast,
              ]}
              onPress={() => handleSelect(suggestion)}
            >
              <MaterialIcons
                name="location-on"
                size={16}
                color={theme.tint}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mainText, { color: theme.text }]}>
                  {suggestion.structured_formatting?.main_text ||
                    suggestion.description}
                </Text>
                {suggestion.structured_formatting?.secondary_text && (
                  <Text
                    style={[
                      styles.secondaryText,
                      { color: theme.mutedText },
                    ]}
                  >
                    {suggestion.structured_formatting.secondary_text}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}

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
