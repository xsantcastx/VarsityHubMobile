import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeamViewerScreen() {
  return (
    <SafeAreaView>
      <Stack.Screen options={{ title: 'Team' }} />
      <View style={{ padding: 24 }}>
        <Text>Team Viewer</Text>
      </View>
    </SafeAreaView>
  );
}
