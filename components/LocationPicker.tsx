import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore - No type declarations available
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
  error 
}: LocationPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
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

  if (showAutocomplete) {
    return (
      <View style={[styles.autocompleteContainer, { 
        backgroundColor: Colors[colorScheme].surface,
        borderColor: Colors[colorScheme].border,
      }]}>
        <GooglePlacesAutocomplete
          placeholder={placeholder}
          onPress={(data, details = null) => {
            onLocationSelect({
              address: data.description,
              placeId: data.place_id,
              latitude: details?.geometry?.location?.lat,
              longitude: details?.geometry?.location?.lng,
            });
            setShowAutocomplete(false);
          }}
          query={{
            key: apiKey,
            language: 'en',
          }}
          fetchDetails={true}
          enablePoweredByContainer={false}
          onFail={(error) => {
            console.error('Google Places error:', error);
          }}
          listViewDisplayed={false}
          styles={{
            textInput: {
              backgroundColor: Colors[colorScheme].surface,
              color: Colors[colorScheme].text,
              fontSize: 16,
              borderWidth: 1,
              borderColor: Colors[colorScheme].border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
            },
            listView: {
              backgroundColor: Colors[colorScheme].surface,
              borderRadius: 12,
              marginTop: 8,
            },
            row: {
              backgroundColor: Colors[colorScheme].surface,
              padding: 13,
              height: 56,
            },
            separator: {
              height: StyleSheet.hairlineWidth,
              backgroundColor: Colors[colorScheme].border,
            },
            description: {
              color: Colors[colorScheme].text,
            },
            predefinedPlacesDescription: {
              color: Colors[colorScheme].tint,
            },
          }}
          textInputProps={{
            placeholderTextColor: Colors[colorScheme].mutedText,
            returnKeyType: 'search',
            autoFocus: true,
            onBlur: () => setShowAutocomplete(false),
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        style={[styles.input, { 
          backgroundColor: Colors[colorScheme].surface,
          borderColor: error ? '#EF4444' : Colors[colorScheme].border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }]}
        onPress={() => setShowAutocomplete(true)}
      >
        <Text style={[{ 
          color: value ? Colors[colorScheme].text : Colors[colorScheme].mutedText,
          flex: 1,
        }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="location-outline" size={20} color={Colors[colorScheme].mutedText} />
      </Pressable>
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
