import { GamePostListScreen } from '@/components/GamePostListScreen';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

function GameReviewsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { game_id, id } = useLocalSearchParams<{ game_id?: string; id?: string }>();

  return (
    <GamePostListScreen
      title="Reviews"
      gameId={game_id ?? id}
      postType="review"
      pageSize={20}
      emptyText="No reviews yet."
      itemSeparatorHeight={8}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            },
          ]}
        >
          {item.title ? (
            <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
              {String(item.title)}
            </Text>
          ) : null}
          {item.content ? (
            <Text style={[styles.content, { color: Colors[colorScheme].text }]}>
              {String(item.content)}
            </Text>
          ) : (
            <Text style={[styles.contentMuted, { color: Colors[colorScheme].mutedText }]}>
              No content
            </Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontWeight: '700', marginBottom: 6 },
  content: {},
  contentMuted: {},
});

export default GameReviewsScreen;
