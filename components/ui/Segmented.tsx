import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  value?: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
}

export default function Segmented({ value, onChange, options }: SegmentedProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
          borderColor: isDark ? '#374151' : '#E5E7EB',
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
                borderTopLeftRadius: isFirst ? 8 : 0,
                borderBottomLeftRadius: isFirst ? 8 : 0,
                borderTopRightRadius: isLast ? 8 : 0,
                borderBottomRightRadius: isLast ? 8 : 0,
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
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
  },
});
