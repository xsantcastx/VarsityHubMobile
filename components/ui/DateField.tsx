import { Colors } from '@/constants/Colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

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
    }
  };

  const handleConfirm = () => {
    // Format as YYYY-MM-DD
    const formatted = date.toISOString().split('T')[0];
    onChange(formatted);
    setShow(false);
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
                setDate(selectedDate);
                const formatted = selectedDate.toISOString().split('T')[0];
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
