import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  value?: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  // Optional column count. When provided (>0), segments wrap into a grid
  // with the specified number of columns to improve label legibility.
  columns?: number;
}

export default function Segmented({ value, onChange, options, columns = 0 }: SegmentedProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
          borderColor: isDark ? '#374151' : '#E5E7EB',
          flexWrap: columns && columns > 0 ? 'wrap' : 'nowrap',
        },
      ]}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: isSelected
                  ? isDark
                    ? '#3B82F6'
                    : '#2563EB'
                  : 'transparent',
                // When wrapping into columns, make each segment a rounded pill
                // and use margins to create spacing. Otherwise, behave as a classic segmented control.
                borderTopLeftRadius: columns && columns > 0 ? 8 : isFirst ? 8 : 0,
                borderBottomLeftRadius: columns && columns > 0 ? 8 : isFirst ? 8 : 0,
                borderTopRightRadius: columns && columns > 0 ? 8 : isLast ? 8 : 0,
                borderBottomRightRadius: columns && columns > 0 ? 8 : isLast ? 8 : 0,
                margin: columns && columns > 0 ? 2 : 0,
                flexBasis: columns && columns > 0 ? `${100 / columns}%` : undefined,
                flexGrow: columns && columns > 0 ? 0 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? '#FFFFFF'
                    : isDark
                    ? '#D1D5DB'
                    : '#6B7280',
                  fontWeight: isSelected ? '600' : '500',
                },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    textAlign: 'center',
  },
});
