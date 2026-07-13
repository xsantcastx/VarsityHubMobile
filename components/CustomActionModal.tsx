import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const theme = Colors[colorScheme];
  const destructiveButtonBackground =
    colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2';
  const destructiveButtonBorder = colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.32)' : '#FCA5A5';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          {title && <Text style={[styles.title, { color: theme.text }]}>{title}</Text>}
          {message && <Text style={[styles.message, { color: theme.mutedText }]}>{message}</Text>}
          {children}
          <View style={styles.optionsRow}>
            {options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor: opt.isDestructive
                      ? destructiveButtonBackground
                      : theme.surface,
                    borderColor: opt.isDestructive ? destructiveButtonBorder : theme.border,
                  },
                ]}
                onPress={() => {
                  onClose();
                  setTimeout(opt.onPress, 150);
                }}
              >
                {opt.icon && (
                  <MaterialIcons
                    name={opt.icon as any}
                    size={18}
                    color={opt.color || (opt.isDestructive ? theme.destructive : theme.tint)}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text
                  style={[
                    styles.optionText,
                    { color: opt.isDestructive ? theme.destructive : theme.text },
                    opt.color && { color: opt.color },
                  ]}
                >
                  {opt.label}
                </Text>
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
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.12)' }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }),
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
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  optionBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
