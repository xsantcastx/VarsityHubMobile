import { UserConnectionListScreen } from '@/components/UserConnectionListScreen';
import { useLocalSearchParams } from 'expo-router';

export default function FollowingScreen() {
  const { id, username } = useLocalSearchParams<{ id?: string; username?: string }>();
  return <UserConnectionListScreen mode="following" userId={id} username={username} />;
}
