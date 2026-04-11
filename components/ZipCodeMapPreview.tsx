import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type ZipCodeMapPreviewProps = {
  zipCode?: string | null;
  title?: string;
  subtitle?: string;
  showCircle?: boolean;
};

export function ZipCodeMapPreview({
  zipCode,
  title = 'Postal code',
  subtitle = 'Area near {zip}',
  showCircle = false,
}: ZipCodeMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const resolvedZip = zipCode?.trim() || 'your area';

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.tint}18` }]}>
          <MaterialIcons name="place" size={18} color={theme.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {subtitle.replace('{zip}', resolvedZip)}
          </Text>
        </View>
      </View>
      <View style={[styles.preview, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#EFF6FF' }]}>
        {showCircle ? <View style={[styles.circle, { borderColor: `${theme.tint}66` }]} /> : null}
        <Text style={[styles.previewLabel, { color: theme.mutedText }]}>{resolvedZip}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  preview: {
    height: 96,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  previewLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
