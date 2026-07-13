import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

interface SegmentedControlProps {
  tabs: string[];
  selected: string;
  onChange: (tab: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl({ tabs, selected, onChange, style }: SegmentedControlProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <View
      style={[
        styles.container,
        { borderColor: palette.border, backgroundColor: palette.surface },
        style,
      ]}
    >
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            selected === tab && { backgroundColor: palette.background },
            selected === tab && styles.selectedTab,
          ]}
          onPress={() => onChange(tab)}
        >
          <Text
            style={[styles.tabText, { color: selected === tab ? palette.text : palette.mutedText }]}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTab: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.1)' }
      : {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.1,
          shadowRadius: 1,
        }),
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
