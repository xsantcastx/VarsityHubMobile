import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlaceSuggestion } from '@/api/geocoding';

type LocationSuggestionListSharedProps = {
  suggestions: PlaceSuggestion[];
  querying: boolean;
  onSelect: (suggestion: PlaceSuggestion) => void;
  tintColor: string;
  textColor: string;
  mutedTextColor: string;
  backgroundColor: string;
  borderColor: string;
  spinnerStyle?: StyleProp<ViewStyle>;
  listStyle?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
  lastItemStyle?: StyleProp<ViewStyle>;
  mainTextStyle?: StyleProp<TextStyle>;
  secondaryTextStyle?: StyleProp<TextStyle>;
};

export function LocationSuggestionListShared({
  suggestions,
  querying,
  onSelect,
  tintColor,
  textColor,
  mutedTextColor,
  backgroundColor,
  borderColor,
  spinnerStyle,
  listStyle,
  itemStyle,
  lastItemStyle,
  mainTextStyle,
  secondaryTextStyle,
}: LocationSuggestionListSharedProps) {
  return (
    <>
      {querying ? (
        <ActivityIndicator
          size="small"
          color={tintColor}
          style={spinnerStyle}
        />
      ) : null}

      {suggestions.length > 0 ? (
        <View
          style={[
            listStyle,
            {
              backgroundColor,
              borderColor,
            },
          ]}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.place_id}
              style={[
                itemStyle,
                { borderBottomColor: borderColor },
                index === suggestions.length - 1 ? lastItemStyle : null,
              ]}
              onPress={() => onSelect(suggestion)}
            >
              <MaterialIcons
                name="location-on"
                size={16}
                color={tintColor}
                style={styles.icon}
              />
              <View style={styles.content}>
                <Text style={[mainTextStyle, { color: textColor }]}>
                  {suggestion.structured_formatting?.main_text ||
                    suggestion.description}
                </Text>
                {suggestion.structured_formatting?.secondary_text ? (
                  <Text
                    style={[
                      secondaryTextStyle,
                      { color: mutedTextColor },
                    ]}
                  >
                    {suggestion.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
});
