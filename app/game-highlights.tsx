import { GamePostListScreen } from '@/components/GamePostListScreen';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

function GameHighlightsScreen() {
  const { game_id, id } = useLocalSearchParams<{ game_id?: string; id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <GamePostListScreen
      title="Highlights"
      gameId={game_id ?? id}
      postType="highlight"
      pageSize={24}
      emptyText="No highlights yet."
      numColumns={3}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => void router.push(`/post-detail?id=${encodeURIComponent(String(item.id))}`)}
          accessibilityRole="button"
          accessibilityLabel="View highlight"
        >
          <View style={[styles.cellVideo, { backgroundColor: Colors[colorScheme].surface }]}>
            <MaterialIcons name="play-arrow" size={22} color="#fff" />
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  cellVideo: {
    width: 110,
    height: 110,
    margin: 2,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GameHighlightsScreen;
