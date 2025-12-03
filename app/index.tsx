import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/AuthProvider';

export default function Index() {
  const { loading } = useAuth();
  
  // AuthProvider handles all routing logic
  // This screen just shows loading state
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      {loading && <ActivityIndicator size="large" />}
    </View>
  );
}
