import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface VideoTrimmerProps {
  uri: string;
  onTrimComplete: (trimmedUri: string) => void;
  onTrimReset: () => void;
}

export default function VideoTrimmer({ uri, onTrimComplete, onTrimReset }: VideoTrimmerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <View style={[styles.container, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Text style={[styles.title, { color: palette.text }]}>Video trimming is available in the mobile app</Text>
      <Text style={[styles.body, { color: palette.mutedText }]}>
        Web preview can keep the original video, but native trimming requires the iOS or Android build.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onTrimComplete(uri)}
          style={[styles.button, { backgroundColor: palette.tint }]}
        >
          <Text style={styles.buttonText}>Use Original Video</Text>
        </Pressable>
        <Pressable
          onPress={onTrimReset}
          style={[styles.secondaryButton, { borderColor: palette.border }]}
        >
          <Text style={[styles.secondaryText, { color: palette.text }]}>Remove Video</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 8,
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
