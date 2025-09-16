import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Color, Radius, Spacing, Type } from './tokens';

type Props = {
  label: string;
  value?: string; // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  minDate?: Date;
  maxDate?: Date;
  helpText?: string;
};

export default function DateField({ label, value, onChange, minDate, maxDate, helpText }: Props) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : new Date();

  const onPicked = (_: any, selected?: Date) => {
    setOpen(false);
    if (!selected) return;
    const iso = selected.toISOString().slice(0, 10);
    onChange(iso);
  };

  return (
    <View style={{ marginVertical: Spacing.sm }}>
      <Text style={Type.body}>{label}</Text>
      <Pressable style={S.field} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? Color.text : Color.subtext }}>{value || 'YYYY-MM-DD'}</Text>
      </Pressable>
      {helpText ? <Text style={{ ...Type.sub, marginTop: 4 }}>{helpText}</Text> : null}
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          onChange={onPicked}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: Color.line,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    marginTop: 6,
    backgroundColor: Color.surface,
  },
});

