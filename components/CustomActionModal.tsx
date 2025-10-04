import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface ActionModalOption {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: string;
  isDestructive?: boolean;
}

import { ReactNode } from 'react';

interface CustomActionModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  options: ActionModalOption[];
  onClose: () => void;
  children?: ReactNode;
}

export default function CustomActionModal({
  visible,
  title,
  message,
  options,
  onClose,
  children,
}: CustomActionModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: Colors[colorScheme].background }]}> 
          {title && <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{title}</Text>}
          {message && <Text style={[styles.message, { color: Colors[colorScheme].mutedText }]}>{message}</Text>}
          {children}
          <View style={styles.optionsRow}>
            {options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.optionBtn,
                  opt.isDestructive && { backgroundColor: '#fee2e2' },
                  { flex: 1 },
                ]}
                onPress={() => {
                  onClose();
                  setTimeout(opt.onPress, 150);
                }}
              >
                {opt.icon && (
                  <Ionicons name={opt.icon as any} size={18} color={opt.color || Colors[colorScheme].tint} style={{ marginRight: 6 }} />
                )}
                <Text style={[styles.optionText, opt.isDestructive && { color: '#dc2626' }, opt.color && { color: opt.color }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    marginBottom: 18,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'space-between',
  },
  optionBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
