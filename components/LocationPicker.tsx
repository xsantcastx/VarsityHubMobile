import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore - No type declarations available

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
  error 
}: LocationPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Always use simple text input for now to avoid GooglePlacesAutocomplete crashes
  if (!apiKey || true) {
    // Fallback to simple text input if no API key
    return (
      <View>
        <TextInput
          style={[styles.input, { 
            backgroundColor: Colors[colorScheme].surface,
            borderColor: error ? '#EF4444' : Colors[colorScheme].border,
            color: Colors[colorScheme].text,
          }]}
          placeholder={placeholder}
          placeholderTextColor={Colors[colorScheme].mutedText}
          value={value}
          onChangeText={(text) => onLocationSelect({ address: text })}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

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
  autocompleteContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8,
    minHeight: 200,
    zIndex: 1000,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
});
