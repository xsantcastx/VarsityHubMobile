import { Colors } from '@/constants/Colors';
import { Button } from '@/components/ui/button';
import { useColorScheme } from '@/hooks/useColorScheme';
import { StyleSheet, Text, View } from 'react-native';

export function AuthenticatedEntryGuard(props: {
  email?: string | null;
  onContinue: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: palette.text }]}>You are already signed in</Text>
      <Text style={[styles.body, { color: palette.mutedText }]}>
        Signed in as {props.email || 'this account'}. Sign out before using a different login on this device.
      </Text>
      <Button onPress={props.onContinue}>Continue to app</Button>
      <View style={styles.spacer} />
      <Button variant="outline" onPress={props.onSignOut} disabled={props.signingOut}>
        {props.signingOut ? 'Signing out…' : 'Sign out to continue'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  spacer: {
    height: 4,
  },
});
