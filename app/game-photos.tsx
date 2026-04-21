import { GamePostListScreen } from '@/components/GamePostListScreen';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { optimizeImageUrl } from '@/utils/imageUrl';

function GamePhotosScreen() {
  const { game_id, id } = useLocalSearchParams<{ game_id?: string; id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <GamePostListScreen
      title="Photos"
      gameId={game_id ?? id}
      postType="photo"
      pageSize={24}
      emptyText="No photos yet"
      numColumns={3}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => void router.push(`/post-detail?id=${encodeURIComponent(String(item.id))}`)}
          accessibilityRole="button"
          accessibilityLabel="View photo"
        >
          <Image
            source={{ uri: optimizeImageUrl(String(item.media_url || ''), 400) || '' }}
            style={[styles.cell, { backgroundColor: Colors[colorScheme].surface }]}
            contentFit="cover"
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  cell: { width: 110, height: 110, margin: 2, borderRadius: 8 },
});

export default GamePhotosScreen;
