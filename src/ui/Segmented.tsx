import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Color, Radius, Spacing, Type } from './tokens';

type Option = { value: string; label: string };
type Props = { value?: string; options: Option[]; onChange: (v: string) => void };

export default function Segmented({ value, options, onChange }: Props) {
  const multiRow = options.length > 3;
  return (
    <View style={[S.wrap, multiRow && S.wrapMulti]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[S.item, multiRow ? S.itemMulti : S.itemSingleRow, on && S.on]}
          >
            <Text style={[Type.body, on && { color: Color.accentPill }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: Spacing.sm },
  wrapMulti: { flexWrap: 'wrap' as const },
  item: {
    borderWidth: 1,
    borderColor: Color.line,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Color.surface,
  },
  itemSingleRow: { flex: 1 },
  itemMulti: {
    flexBasis: '48%',
    minWidth: '48%',
    flexGrow: 1,
  },
  on: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
});

