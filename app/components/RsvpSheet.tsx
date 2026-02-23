import { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type RsvpSheetProps = {
  visible: boolean;
  onClose: () => void;
  goingCount?: number;
  capacity?: number | null;
  isGoing?: boolean;
  onToggleRsvp: () => Promise<void> | void;
  busy?: boolean;
};

export default function RsvpSheet({ visible, onClose, goingCount = 0, capacity = null, isGoing = false, onToggleRsvp, busy = false }: RsvpSheetProps) {
  const remaining = useMemo(() => (typeof capacity === 'number' ? Math.max(0, capacity - (goingCount || 0)) : null), [capacity, goingCount]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={styles.handle} />
          </View>
          <Text style={styles.title}>RSVP</Text>
          <Text style={styles.meta}>Going: {goingCount}{typeof capacity === 'number' ? ` / ${capacity}` : ''}</Text>
          {typeof remaining === 'number' && <Text style={styles.metaMuted}>{remaining} spots remaining</Text>}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Pressable
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={onToggleRsvp}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.primaryBtnText}>{isGoing ? 'Cancel RSVP' : 'Confirm RSVP'}</Text>
              )}
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={onClose}>
              <Text style={styles.outlineBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  meta: { color: '#374151', marginTop: 6 },
  metaMuted: { color: '#6b7280' },
  primaryBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  outlineBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  outlineBtnText: { color: '#111827', fontWeight: '700' },
});
