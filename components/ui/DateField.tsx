import { Colors } from '@/constants/Colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

// Format a Date to YYYY-MM-DD using local timezone (not UTC)
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse YYYY-MM-DD as local midnight (not UTC)
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DateField({ label, value, onChange, placeholder }: DateFieldProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(value ? parseLocalDate(value) : new Date());
  // Ref to avoid stale closure in handleConfirm — spinner onChange fires
  // rapidly and React state may lag by one render cycle
  const dateRef = useRef(date);

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (selectedDate) {
      // Normalize to local midnight to prevent timezone offset shifting the day
      const normalized = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(normalized);
      dateRef.current = normalized;
    }
  };

  const handleConfirm = () => {
    // Use ref to get the latest value (avoids stale state from rapid spinner changes)
    const formatted = formatLocalDate(dateRef.current);
    onChange(formatted);
    setShow(false);
  };

  const displayValue = value
    ? parseLocalDate(value).toLocaleDateString('en-US', {
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
      
      {Platform.OS === 'ios' ? (
        <Modal
          visible={show}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme].background }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShow(false)}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>Select Date</Text>
                <Pressable onPress={handleConfirm}>
                  <Text style={styles.doneButton}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={handleChange}
                maximumDate={new Date()}
                textColor={Colors[colorScheme].text}
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShow(false);
              if (selectedDate) {
                const normalized = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                setDate(normalized);
                const formatted = formatLocalDate(normalized);
                onChange(formatted);
              }
            }}
            maximumDate={new Date()}
          />
        )
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
});
