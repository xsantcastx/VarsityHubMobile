import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FavoritesScreen() {
  return (
    <SafeAreaView>
      <Stack.Screen options={{ title: 'Favorites' }} />
      <View style={{ padding: 24 }}>
        <Text>Favorites</Text>
      </View>
    </SafeAreaView>
  );
}
