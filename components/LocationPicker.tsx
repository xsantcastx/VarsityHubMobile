import { getConfig } from '@/config/env';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore — install with: npx expo install react-native-google-places-autocomplete
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

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

  // Resolve API key: env var first, then app.json native config fallback
  const apiKey =
    getConfig().mapsKey ||
    (Constants.expoConfig as any)?.ios?.config?.googleMapsApiKey ||
    (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ||
    '';

  // Pre-fill the input when editing an existing venue
  const autocompleteRef = useRef<any>(null);
  useEffect(() => {
    if (autocompleteRef.current && value) {
      autocompleteRef.current.setAddressText(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback: plain TextInput when API key is unavailable
  if (!apiKey) {
    return (
      <View>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.surface,
            borderColor: error ? '#EF4444' : theme.border,
            color: theme.text,
          }]}
          placeholder={placeholder}
          placeholderTextColor={theme.mutedText}
          value={value}
          onChangeText={(text) => onLocationSelect({ address: text })}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  return (
    <View>
      <GooglePlacesAutocomplete
        ref={autocompleteRef}
        placeholder={placeholder}
        fetchDetails
        query={{
          key: apiKey,
          language: 'en',
          types: 'establishment|geocode',
        }}
        onPress={(data: any, details: any = null) => {
          onLocationSelect({
            address: data.description,
            placeId: data.place_id,
            latitude: details?.geometry?.location?.lat,
            longitude: details?.geometry?.location?.lng,
          });
        }}
        onFail={(err: any) => console.warn('[LocationPicker] Places error:', err)}
        textInputProps={{
          placeholderTextColor: theme.mutedText,
          onChangeText: (text: string) => {
            // Clear stored coordinates when user clears the field
            if (!text) onLocationSelect({ address: '' });
          },
        }}
        styles={{
          container: { flex: 0 },
          textInputContainer: {
            backgroundColor: 'transparent',
          },
          textInput: {
            height: 50,
            color: theme.text,
            fontSize: 16,
            fontWeight: '500',
            backgroundColor: theme.surface,
            borderRadius: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: error ? '#EF4444' : theme.border,
            paddingHorizontal: 16,
            margin: 0,
          },
          listView: {
            backgroundColor: theme.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            borderRadius: 12,
            marginTop: 4,
          },
          row: {
            backgroundColor: theme.surface,
            paddingVertical: 12,
            paddingHorizontal: 16,
          },
          description: {
            color: theme.text,
            fontSize: 14,
          },
          separator: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.border,
          },
        }}
        enablePoweredByContainer={false}
        minLength={2}
        debounce={300}
        keepResultsAfterBlur={false}
        listViewDisplayed="auto"
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
});
