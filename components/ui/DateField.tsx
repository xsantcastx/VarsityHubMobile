import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

export default function DateField({ label, value, onChange, placeholder }: DateFieldProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(value ? new Date(value) : new Date());

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      // Format as YYYY-MM-DD
      const formatted = selectedDate.toISOString().split('T')[0];
      onChange(formatted);
    }
  };

  const displayValue = value 
    ? new Date(value).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : placeholder || 'Select date';

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: Colors[colorScheme].text }]}>{label}</Text>
      <Pressable
        onPress={() => setShow(true)}
        style={[
          styles.input,
          {
            backgroundColor: Colors[colorScheme].background,
            borderColor: Colors[colorScheme].border,
          },
        ]}
      >
        <Text style={[styles.text, { color: value ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
          {displayValue}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  text: {
    fontSize: 16,
  },
});
