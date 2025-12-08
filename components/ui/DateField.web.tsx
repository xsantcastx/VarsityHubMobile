/**
 * Web version of DateField - Uses HTML5 date input
 */

import { Colors } from '@/constants/Colors';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

export default function DateField({ label, value, onChange, placeholder }: DateFieldProps) {
  const colorScheme = useColorScheme() ?? 'light';

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    if (newValue) {
      onChange(newValue);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: Colors[colorScheme].text }]}>{label}</Text>
      <input
        type="date"
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder || 'Select date'}
        max={new Date().toISOString().split('T')[0]} // Today's date as max
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '16px',
          borderRadius: '12px',
          border: `1px solid ${Colors[colorScheme].border}`,
          backgroundColor: Colors[colorScheme].background,
          color: Colors[colorScheme].text,
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = Colors[colorScheme].tint;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = Colors[colorScheme].border;
        }}
      />
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
});
