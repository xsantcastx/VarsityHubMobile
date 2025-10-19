import { Colors } from '@/constants/Colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View, useColorScheme } from 'react-native';
import { Radius, Spacing, Type } from './tokens';

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
  const colorScheme = useColorScheme();
  const date = value ? new Date(value + 'T00:00:00') : new Date();

  const onPicked = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (!selected) {
      if (Platform.OS === 'ios') {
        setOpen(false);
      }
      return;
    }
    const iso = selected.toISOString().slice(0, 10);
    onChange(iso);
    if (Platform.OS === 'ios') {
      setOpen(false);
    }
  };

  const formatDisplayDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate + 'T00:00:00');
      if (isNaN(date.getTime())) return 'YYYY-MM-DD';
      return date.toLocaleDateString();
    } catch {
      return 'YYYY-MM-DD';
    }
  };

  return (
    <View style={{ marginVertical: Spacing.sm }}>
      <Text style={{ ...Type.body, color: Colors[colorScheme].text }}>{label}</Text>
      <Pressable 
        style={{
          borderWidth: 1,
          borderColor: Colors[colorScheme].border,
          borderRadius: Radius.md,
          paddingVertical: 14,
          paddingHorizontal: Spacing.lg,
          marginTop: 6,
          backgroundColor: Colors[colorScheme].surface,
        }} 
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: value ? Colors[colorScheme].text : Colors[colorScheme].mutedText }}>
          {value ? formatDisplayDate(value) : 'Select date'}
        </Text>
      </Pressable>
      {helpText ? <Text style={{ ...Type.sub, color: Colors[colorScheme].mutedText, marginTop: 4 }}>{helpText}</Text> : null}
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'default' : 'default'}
          onChange={onPicked}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}
    </View>
  );
}

