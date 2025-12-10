import { useAuth } from '@/context/AuthProvider';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { loading } = useAuth();
  
  // AuthProvider handles all routing logic
  // This screen always shows loading state while AuthProvider determines where to navigate
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
