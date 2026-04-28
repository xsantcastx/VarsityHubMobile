import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type CoachAccessRedirectingProps = {
  backgroundColor: string;
  spinnerColor?: string;
  textColor?: string;
  message?: string;
  edges?: readonly Edge[];
};

export default function CoachAccessRedirecting({
  backgroundColor,
  spinnerColor,
  textColor = '#6B7280',
  message = 'Redirecting to the right coach screen...',
  edges = ['top', 'bottom'],
}: CoachAccessRedirectingProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={edges}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={spinnerColor} />
        <Text style={[styles.message, { color: textColor }]}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
  },
});
