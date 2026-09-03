import { Colors } from '@/constants/Colors';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AdminAccessStateProps = {
  colorScheme: 'light' | 'dark';
  state: 'loading' | 'denied';
};

export function AdminAccessState({ colorScheme, state }: AdminAccessStateProps) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors[colorScheme].background,
      }}
    >
      {state === 'loading' ? (
        <ActivityIndicator color={Colors[colorScheme].tint} />
      ) : (
        <Text style={{ color: Colors[colorScheme].text }}>Admin access required</Text>
      )}
    </SafeAreaView>
  );
}
