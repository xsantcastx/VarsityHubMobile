import { UserConnectionListScreen } from '@/components/UserConnectionListScreen';
import { useLocalSearchParams } from 'expo-router';

export default function FollowersScreen() {
  const { id, username } = useLocalSearchParams<{ id?: string; username?: string }>();
  return <UserConnectionListScreen mode="followers" userId={id} username={username} />;
}
